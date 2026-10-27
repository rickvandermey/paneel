package actions

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

func TestRunDelayWaits(t *testing.T) {
	runner := NewRunner(Options{})
	started := time.Now()
	err := runner.Run(context.Background(), []protocol.Action{{Kind: protocol.ActionDelay, Millis: 30}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if time.Since(started) < 30*time.Millisecond {
		t.Fatalf("delay returned too early")
	}
}

func TestRunStopsAtUnknownKind(t *testing.T) {
	runner := NewRunner(Options{})
	err := runner.Run(context.Background(), []protocol.Action{
		{Kind: protocol.ActionDelay, Millis: 1},
		{Kind: "teleport"},
		{Kind: protocol.ActionDelay, Millis: 1},
	})
	if err == nil {
		t.Fatalf("expected an error for an unknown action kind")
	}
	if got, want := err.Error(), `action 2 (teleport): unknown action kind "teleport"`; got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}
}

func TestRunDelayHonoursContext(t *testing.T) {
	runner := NewRunner(Options{})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer cancel()
	err := runner.Run(ctx, []protocol.Action{{Kind: protocol.ActionDelay, Millis: 5000}})
	if err == nil {
		t.Fatalf("expected context error")
	}
}

func TestHotkeyRejectsUnknownModifier(t *testing.T) {
	if err := hotkey("c", []string{"hyper"}); err == nil {
		t.Fatalf("expected error for unknown modifier")
	}
}

func TestRunRejectsUnknownAppControl(t *testing.T) {
	runner := NewRunner(Options{})
	err := runner.Run(context.Background(), []protocol.Action{
		{Kind: protocol.ActionAppControl, App: "winamp", Control: protocol.AppControlShuffle},
	})
	if err == nil {
		t.Fatalf("expected an error for an unknown app")
	}
	if got, want := err.Error(), `action 1 (appControl): unknown app "winamp"`; got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}
}

func TestRecordingRunnerWritesActionsInsteadOfRunningThem(t *testing.T) {
	file := filepath.Join(t.TempDir(), "actions.jsonl")
	runner := NewRunner(Options{RecordFile: file})
	err := runner.Run(context.Background(), []protocol.Action{
		{Kind: protocol.ActionHotkey, Key: "a", Modifiers: []string{"cmd", "shift"}, Target: "zoom.us"},
		{Kind: protocol.ActionAppControl, App: protocol.AppSpotify, Control: protocol.AppControlShuffle, Value: protocol.AppValueOn},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	data, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("read record: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 2 {
		t.Fatalf("got %d lines, want 2: %s", len(lines), data)
	}
	var second Record
	if err := json.Unmarshal([]byte(lines[1]), &second); err != nil {
		t.Fatalf("parse record: %v", err)
	}
	if second.App != "spotify" || second.Value != "on" || !strings.Contains(second.Script, "set shuffling to true") {
		t.Fatalf("record = %+v", second)
	}
}

func TestRecordingRunnerStillRejectsInvalidActions(t *testing.T) {
	runner := NewRunner(Options{RecordFile: filepath.Join(t.TempDir(), "actions.jsonl")})
	err := runner.Run(context.Background(), []protocol.Action{
		{Kind: protocol.ActionAppControl, App: "winamp", Control: protocol.AppControlShuffle},
	})
	if err == nil {
		t.Fatalf("expected an error for an unknown app")
	}
}
