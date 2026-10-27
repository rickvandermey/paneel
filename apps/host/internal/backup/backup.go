// Package backup bundles the config and its icon assets into one zip and restores from it, so a
// deck can be moved to another computer or put back after a mistake.
package backup

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

const configEntry = "config.json"
const assetsPrefix = "assets/"

// MaxSize bounds a restore upload: thousands of icons still fit comfortably.
const MaxSize = 200 << 20

var assetName = regexp.MustCompile(`^[a-f0-9]{64}\.[a-z0-9]{2,5}$`)

var ErrInvalid = errors.New("invalid backup")

// Write streams a zip with the client-facing config and every asset file. Token and port stay
// out: a backup may travel to another machine.
func Write(w io.Writer, cfg protocol.Config, assetsDir string) error {
	archive := zip.NewWriter(w)
	entry, err := archive.Create(configEntry)
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(entry)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(cfg); err != nil {
		return err
	}
	entries, err := os.ReadDir(assetsDir)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	for _, file := range entries {
		if file.IsDir() || !assetName.MatchString(file.Name()) {
			continue
		}
		data, err := os.ReadFile(filepath.Join(assetsDir, file.Name()))
		if err != nil {
			return err
		}
		asset, err := archive.Create(assetsPrefix + file.Name())
		if err != nil {
			return err
		}
		if _, err := asset.Write(data); err != nil {
			return err
		}
	}
	return archive.Close()
}

// Read parses a backup, writes its assets next to the existing ones and returns the config.
// Assets are content-addressed, so restoring never overwrites a different file.
func Read(data []byte, assetsDir string) (protocol.Config, error) {
	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return protocol.Config{}, fmt.Errorf("%w: not a zip file", ErrInvalid)
	}
	var cfg protocol.Config
	found := false
	for _, file := range archive.File {
		switch {
		case file.Name == configEntry:
			if err := readJSON(file, &cfg); err != nil {
				return protocol.Config{}, fmt.Errorf("%w: %v", ErrInvalid, err)
			}
			found = true
		case strings.HasPrefix(file.Name, assetsPrefix):
			name := strings.TrimPrefix(file.Name, assetsPrefix)
			if !assetName.MatchString(name) {
				return protocol.Config{}, fmt.Errorf("%w: unexpected asset %q", ErrInvalid, file.Name)
			}
			if err := extract(file, filepath.Join(assetsDir, name)); err != nil {
				return protocol.Config{}, err
			}
		}
	}
	if !found {
		return protocol.Config{}, fmt.Errorf("%w: config.json missing", ErrInvalid)
	}
	if cfg.SchemaVersion == 0 || cfg.Profiles == nil {
		return protocol.Config{}, fmt.Errorf("%w: config.json is not a deck config", ErrInvalid)
	}
	return cfg, nil
}

func readJSON(file *zip.File, target any) error {
	reader, err := file.Open()
	if err != nil {
		return err
	}
	defer func() { _ = reader.Close() }()
	return json.NewDecoder(io.LimitReader(reader, MaxSize)).Decode(target)
}

func extract(file *zip.File, path string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	}
	reader, err := file.Open()
	if err != nil {
		return err
	}
	defer func() { _ = reader.Close() }()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := io.ReadAll(io.LimitReader(reader, MaxSize))
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}
