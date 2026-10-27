package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

const spikeJSON = `{
  "token": "abc",
  "port": 48220,
  "profiles": [{
    "id": "default", "name": "Spike",
    "pages": [{"id": "page-1", "name": "Page 1", "rows": 2, "columns": 3, "buttons": [
      {"id": "btn-url", "row": 1, "column": 0, "label": "GitHub", "icon": "github-logo", "color": "#111827",
       "actions": [{"kind": "url", "target": "https://github.com"}]},
      {"id": "btn-copy", "row": 0, "column": 0, "label": "Copy", "icon": "copy", "color": "#2563eb",
       "actions": [{"kind": "hotkey", "key": "c", "modifiers": ["cmd"]}]},
      {"id": "btn-calc", "row": 0, "column": 2, "label": "Calculator", "icon": "calculator", "color": "#16a34a",
       "actions": [{"kind": "launch", "target": "Calculator"}]}
    ]}]
  }]
}`

func TestParseMigratesSpikeFormat(t *testing.T) {
	file, err := Parse([]byte(spikeJSON))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if file.SchemaVersion != CurrentSchemaVersion || file.Token != "abc" || file.Port != 48220 {
		t.Fatalf("header = %+v", file)
	}
	buttons := file.Profiles[0].Buttons
	if len(buttons) != 3 || buttons[0].ID != "btn-copy" || buttons[1].ID != "btn-calc" || buttons[2].ID != "btn-url" {
		t.Fatalf("expected row-major order, got %v", []string{buttons[0].ID, buttons[1].ID, buttons[2].ID})
	}
	if buttons[2].Actions[0].URL != "https://github.com" || buttons[2].Actions[0].Target != "" {
		t.Fatalf("url action not migrated: %+v", buttons[2].Actions[0])
	}
	if buttons[0].Icon == nil || buttons[0].Icon.Source != protocol.IconPhosphor || buttons[0].Icon.Name != "copy" {
		t.Fatalf("icon not migrated: %+v", buttons[0].Icon)
	}
	if !buttons[0].ShowLabel {
		t.Fatalf("labels should stay visible after migration")
	}
	if !file.Migrated {
		t.Fatalf("migrated files must be flagged so they get rewritten")
	}
}

func TestSaveAndLoadRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "config.json")
	file := Defaults()
	file.Revision = 7
	if err := SaveTo(path, file); err != nil {
		t.Fatalf("save: %v", err)
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("stat: err=%v mode=%v", err, info.Mode())
	}
	leftovers, _ := filepath.Glob(filepath.Join(filepath.Dir(path), "*.tmp"))
	if len(leftovers) != 0 {
		t.Fatalf("temp files left behind: %v", leftovers)
	}
	loaded, err := LoadFrom(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if loaded.Revision != 7 || loaded.Token != file.Token || len(loaded.Profiles) != 1 {
		t.Fatalf("round trip mismatch: %+v", loaded)
	}
}

func TestParseRejectsNewerSchema(t *testing.T) {
	if _, err := Parse([]byte(`{"schemaVersion": 99}`)); err == nil {
		t.Fatalf("expected error for newer schema")
	}
}

func TestParseSplitsPromptCommandsFromSchema1(t *testing.T) {
	data := []byte(`{"schemaVersion":1,"revision":3,"settings":{"terminal":""},"token":"t","port":48220,
	"profiles":[{"id":"p","name":"AI","buttons":[
		{"id":"a","label":"Claude: tests","showLabel":true,"color":"#000000","actions":[{"kind":"terminal","command":"claude \"run the tests and fix failures\""}]},
		{"id":"b","label":"Claude","showLabel":true,"color":"#000000","actions":[{"kind":"terminal","command":"claude"}]},
		{"id":"c","label":"Echo","showLabel":true,"color":"#000000","actions":[{"kind":"terminal","command":"echo \"hi\""}]},
		{"id":"f","label":"Folder","showLabel":true,"color":"#000000","actions":[],"folder":[
			{"id":"d","label":"Review","showLabel":true,"color":"#000000","actions":[{"kind":"terminal","command":"codex \"review my changes\""}]}]}
	]}]}`)
	file, err := Parse(data)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if file.SchemaVersion != CurrentSchemaVersion || !file.Migrated {
		t.Fatalf("schema should be bumped and flagged, got %d migrated=%v", file.SchemaVersion, file.Migrated)
	}
	buttons := file.Profiles[0].Buttons
	if buttons[0].Actions[0].Command != "claude" || buttons[0].Actions[0].Prompt != "run the tests and fix failures" {
		t.Fatalf("prompt not split: %+v", buttons[0].Actions[0])
	}
	if buttons[1].Actions[0].Command != "claude" || buttons[1].Actions[0].Prompt != "" {
		t.Fatalf("plain claude should stay as is: %+v", buttons[1].Actions[0])
	}
	if buttons[2].Actions[0].Command != `echo "hi"` {
		t.Fatalf("only claude and codex are split: %+v", buttons[2].Actions[0])
	}
	if buttons[3].Folder[0].Actions[0].Command != "codex" || buttons[3].Folder[0].Actions[0].Prompt != "review my changes" {
		t.Fatalf("folder buttons should migrate too: %+v", buttons[3].Folder[0].Actions[0])
	}
}
