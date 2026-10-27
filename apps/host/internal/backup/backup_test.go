package backup

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

func TestRoundTripKeepsConfigAndAssets(t *testing.T) {
	source := t.TempDir()
	name := strings.Repeat("ab", 32) + ".png"
	if err := os.WriteFile(filepath.Join(source, name), []byte("png"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "notes.txt"), []byte("skip"), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := protocol.Config{SchemaVersion: 1, Revision: 7, Settings: protocol.Settings{Theme: "paper"}, Profiles: []protocol.Profile{{ID: "p", Name: "Music", Buttons: []protocol.Button{}}}}
	var buffer bytes.Buffer
	if err := Write(&buffer, cfg, source); err != nil {
		t.Fatal(err)
	}
	target := t.TempDir()
	restored, err := Read(buffer.Bytes(), target)
	if err != nil {
		t.Fatal(err)
	}
	if restored.Settings.Theme != "paper" || len(restored.Profiles) != 1 || restored.Profiles[0].Name != "Music" {
		t.Fatalf("restored config = %+v", restored)
	}
	if data, err := os.ReadFile(filepath.Join(target, name)); err != nil || string(data) != "png" {
		t.Fatalf("asset not restored: %v %q", err, data)
	}
	if _, err := os.Stat(filepath.Join(target, "notes.txt")); err == nil {
		t.Fatal("unexpected file restored")
	}
}

func TestReadRejectsGarbage(t *testing.T) {
	if _, err := Read([]byte("hello"), t.TempDir()); err == nil {
		t.Fatal("expected an error for a non-zip upload")
	}
}
