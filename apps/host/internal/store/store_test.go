package store

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/paneel-nx/paneel/host/internal/config"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

func newTestStore(t *testing.T) (*Store, *int) {
	t.Helper()
	saves := 0
	file := &config.File{Config: protocol.Config{SchemaVersion: 1, Profiles: []protocol.Profile{{
		ID: "p1", Name: "One", Buttons: []protocol.Button{
			{ID: "a", Label: "A", Color: "#111111", Actions: []protocol.Action{}},
			{ID: "b", Label: "B", Color: "#222222", Actions: []protocol.Action{}},
			{ID: "f", Label: "Folder", Color: "#333333", Actions: []protocol.Action{}, Folder: []protocol.Button{
				{ID: "c", Label: "C", Color: "#444444", Actions: []protocol.Action{}},
			}},
		},
	}}}}
	return New(file, func(*config.File) error { saves++; return nil }), &saves
}

func ids(list []protocol.Button) []string {
	var result []string
	for _, button := range list {
		result = append(result, button.ID)
	}
	return result
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for index := range a {
		if a[index] != b[index] {
			return false
		}
	}
	return true
}

func intPtr(value int) *int { return &value }

func TestButtonCreateGeneratesIDAndIncrementsRevision(t *testing.T) {
	store, saves := newTestStore(t)
	filled, revision, err := store.Apply(protocol.Command{
		Type: protocol.CmdButtonCreate, ProfileID: "p1", Index: intPtr(1),
		Button: &protocol.Button{Label: "New", Color: "#abcdef", Actions: []protocol.Action{{Kind: protocol.ActionDelay, Millis: 1}}},
	})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if revision != 1 || *saves != 1 {
		t.Fatalf("revision=%d saves=%d", revision, *saves)
	}
	if filled.Button.ID == "" {
		t.Fatalf("expected generated id")
	}
	got := ids(store.Snapshot().Profiles[0].Buttons)
	if !equal(got, []string{"a", filled.Button.ID, "b", "f"}) {
		t.Fatalf("order = %v", got)
	}
}

func TestButtonCreateIntoFolder(t *testing.T) {
	store, _ := newTestStore(t)
	_, _, err := store.Apply(protocol.Command{
		Type: protocol.CmdButtonCreate, ParentID: "f",
		Button: &protocol.Button{ID: "d", Color: "#000000"},
	})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	folder := store.Snapshot().Profiles[0].Buttons[2].Folder
	if !equal(ids(folder), []string{"c", "d"}) {
		t.Fatalf("folder = %v", ids(folder))
	}
}

func TestButtonUpdatePatchesAndRejectsForbiddenFields(t *testing.T) {
	store, _ := newTestStore(t)
	_, _, err := store.Apply(protocol.Command{Type: protocol.CmdButtonUpdate, ID: "c",
		Patch: json.RawMessage(`{"label":"Changed","icon":{"source":"emoji","value":"🚀"}}`)})
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	button, _ := store.FindButton("c")
	if button.Label != "Changed" || button.Icon == nil || button.Icon.Value != "🚀" {
		t.Fatalf("button = %+v", button)
	}
	_, _, err = store.Apply(protocol.Command{Type: protocol.CmdButtonUpdate, ID: "c", Patch: json.RawMessage(`{"id":"x"}`)})
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected ErrInvalid, got %v", err)
	}
	_, _, err = store.Apply(protocol.Command{Type: protocol.CmdButtonUpdate, ID: "c", Patch: json.RawMessage(`{"color":"red"}`)})
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected ErrInvalid for bad color, got %v", err)
	}
	_, _, err = store.Apply(protocol.Command{Type: protocol.CmdButtonUpdate, ID: "c",
		Patch: json.RawMessage(`{"actions":[{"kind":"terminal","command":"git status","window":"tab"}]}`)})
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected ErrInvalid for unknown terminal window, got %v", err)
	}
	_, _, err = store.Apply(protocol.Command{Type: protocol.CmdButtonUpdate, ID: "c",
		Patch: json.RawMessage(`{"actions":[{"kind":"terminal","command":"claude","prompt":"explain","window":"new"}]}`)})
	if err != nil {
		t.Fatalf("terminal action with prompt and window: %v", err)
	}
	_, _, err = store.Apply(protocol.Command{Type: protocol.CmdButtonUpdate, ID: "c", Patch: json.RawMessage(`{"icon":null}`)})
	if err != nil {
		t.Fatalf("clearing icon: %v", err)
	}
	if button, _ := store.FindButton("c"); button.Icon != nil {
		t.Fatalf("icon should be cleared")
	}
}

func TestButtonMoveBetweenListsAndSelfFolderGuard(t *testing.T) {
	store, _ := newTestStore(t)
	_, _, err := store.Apply(protocol.Command{Type: protocol.CmdButtonMove, ID: "c", ProfileID: "p1", Index: intPtr(0)})
	if err != nil {
		t.Fatalf("move out of folder: %v", err)
	}
	snapshot := store.Snapshot()
	if !equal(ids(snapshot.Profiles[0].Buttons), []string{"c", "a", "b", "f"}) {
		t.Fatalf("order = %v", ids(snapshot.Profiles[0].Buttons))
	}
	_, _, err = store.Apply(protocol.Command{Type: protocol.CmdButtonMove, ID: "f", ParentID: "f", Index: intPtr(0)})
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected self-folder guard, got %v", err)
	}
	_, _, err = store.Apply(protocol.Command{Type: protocol.CmdButtonMove, ID: "a", ProfileID: "p1", Index: intPtr(99)})
	if err != nil {
		t.Fatalf("move to end: %v", err)
	}
	if got := ids(store.Snapshot().Profiles[0].Buttons); !equal(got, []string{"c", "b", "f", "a"}) {
		t.Fatalf("order = %v", got)
	}
}

func TestButtonDeleteAndUnknown(t *testing.T) {
	store, _ := newTestStore(t)
	if _, _, err := store.Apply(protocol.Command{Type: protocol.CmdButtonDelete, ID: "c"}); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, ok := store.FindButton("c"); ok {
		t.Fatalf("c should be gone")
	}
	_, revision, err := store.Apply(protocol.Command{Type: protocol.CmdButtonDelete, ID: "nope"})
	if !errors.Is(err, ErrInvalid) || revision != 1 {
		t.Fatalf("expected ErrInvalid without revision bump, got err=%v revision=%d", err, revision)
	}
}

func TestProfileLifecycle(t *testing.T) {
	store, _ := newTestStore(t)
	filled, _, err := store.Apply(protocol.Command{Type: protocol.CmdProfileCreate, Profile: &protocol.Profile{Name: "Two"}})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, _, err := store.Apply(protocol.Command{Type: protocol.CmdProfileMove, ID: filled.Profile.ID, Index: intPtr(0)}); err != nil {
		t.Fatalf("move: %v", err)
	}
	if store.Snapshot().Profiles[0].Name != "Two" {
		t.Fatalf("expected Two first")
	}
	if _, _, err := store.Apply(protocol.Command{Type: protocol.CmdProfileUpdate, ID: filled.Profile.ID, Patch: json.RawMessage(`{"name":"Renamed"}`)}); err != nil {
		t.Fatalf("update: %v", err)
	}
	if _, _, err := store.Apply(protocol.Command{Type: protocol.CmdProfileDelete, ID: filled.Profile.ID}); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, _, err := store.Apply(protocol.Command{Type: protocol.CmdProfileDelete, ID: "p1"}); err != nil {
		t.Fatalf("the last profile must be deletable too, got %v", err)
	}
	if got := len(store.Snapshot().Profiles); got != 0 {
		t.Fatalf("expected no profiles left, got %d", got)
	}
}

func TestSaveFailureRollsBack(t *testing.T) {
	file := &config.File{Config: protocol.Config{SchemaVersion: 1, Profiles: []protocol.Profile{{ID: "p1", Name: "One", Buttons: []protocol.Button{}}}}}
	store := New(file, func(*config.File) error { return errors.New("disk full") })
	_, revision, err := store.Apply(protocol.Command{Type: protocol.CmdSettingsUpdate, Patch: json.RawMessage(`{"terminal":"iTerm"}`)})
	if err == nil || revision != 0 || store.Settings().Terminal != "" {
		t.Fatalf("expected rollback, got err=%v revision=%d settings=%+v", err, revision, store.Settings())
	}
}
