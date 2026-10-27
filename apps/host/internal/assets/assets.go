// Package assets stores icon files addressed by content hash.
package assets

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/paneel-nx/paneel/host/internal/atomicfile"
)

const (
	MaxSize = 5 << 20
	// sniffBytes is how much of a file http.DetectContentType needs to recognise an image.
	sniffBytes = 1024
	// Assets are not secret, but they live in the user's private config folder.
	filePermissions = 0o600
)

var ErrTooLarge = errors.New("asset exceeds 5 MB")
var ErrUnsupported = errors.New("unsupported image type")

var hashPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

var extensionByContentType = map[string]string{
	"image/png":                ".png",
	"image/jpeg":               ".jpg",
	"image/gif":                ".gif",
	"image/webp":               ".webp",
	"image/svg+xml":            ".svg",
	"image/x-icon":             ".ico",
	"image/vnd.microsoft.icon": ".ico",
}

var contentTypeByExtension = map[string]string{
	".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif",
	".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
}

type Store struct {
	dir string
}

func New(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	return &Store{dir: dir}, nil
}

// Put stores the bytes and returns the content hash. Storing the same bytes twice is a no-op.
func (store *Store) Put(data []byte) (string, error) {
	if len(data) > MaxSize {
		return "", ErrTooLarge
	}
	contentType := detectContentType(data)
	extension, ok := extensionByContentType[contentType]
	if !ok {
		return "", fmt.Errorf("%w: %s", ErrUnsupported, contentType)
	}
	sum := sha256.Sum256(data)
	hash := hex.EncodeToString(sum[:])
	path := filepath.Join(store.dir, hash+extension)
	if _, err := os.Stat(path); err == nil {
		return hash, nil
	}
	if err := atomicfile.Write(path, data, filePermissions); err != nil {
		return "", err
	}
	return hash, nil
}

// Open returns the path and content type for a hash, or os.ErrNotExist.
func (store *Store) Open(hash string) (string, string, error) {
	if !hashPattern.MatchString(hash) {
		return "", "", os.ErrNotExist
	}
	matches, err := filepath.Glob(filepath.Join(store.dir, hash+".*"))
	if err != nil || len(matches) == 0 {
		return "", "", os.ErrNotExist
	}
	path := matches[0]
	return path, contentTypeByExtension[strings.ToLower(filepath.Ext(path))], nil
}

// detectContentType sniffs the image type; SVG needs its own check because it is text.
func detectContentType(data []byte) string {
	head := data
	if len(head) > sniffBytes {
		head = head[:sniffBytes]
	}
	trimmed := bytes.TrimSpace(head)
	if bytes.HasPrefix(trimmed, []byte("<svg")) || (bytes.HasPrefix(trimmed, []byte("<?xml")) && bytes.Contains(head, []byte("<svg"))) {
		return "image/svg+xml"
	}
	contentType := http.DetectContentType(head)
	// Drop parameters such as "; charset=utf-8".
	if index := strings.Index(contentType, ";"); index >= 0 {
		contentType = contentType[:index]
	}
	return contentType
}

// Dir is where the asset files live; backups read and write it directly.
func (store *Store) Dir() string { return store.dir }
