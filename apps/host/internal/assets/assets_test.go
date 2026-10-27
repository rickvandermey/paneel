package assets

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/png"
	"os"
	"testing"
)

func pngBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestPutAndOpenRoundTrip(t *testing.T) {
	store, err := New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	data := pngBytes(t)
	hash, err := store.Put(data)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	again, err := store.Put(data)
	if err != nil || again != hash {
		t.Fatalf("second put: hash=%s err=%v", again, err)
	}
	path, contentType, err := store.Open(hash)
	if err != nil || contentType != "image/png" {
		t.Fatalf("open: path=%s type=%s err=%v", path, contentType, err)
	}
	stored, _ := os.ReadFile(path)
	if !bytes.Equal(stored, data) {
		t.Fatalf("stored bytes differ")
	}
}

func TestSVGDetectionAndRejections(t *testing.T) {
	store, _ := New(t.TempDir())
	if _, err := store.Put([]byte(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>`)); err != nil {
		t.Fatalf("svg: %v", err)
	}
	if _, err := store.Put([]byte("just text")); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("expected ErrUnsupported, got %v", err)
	}
	if _, _, err := store.Open("../etc/passwd"); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected ErrNotExist for bad hash, got %v", err)
	}
}
