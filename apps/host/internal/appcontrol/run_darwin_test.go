//go:build darwin

package appcontrol

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestRunPassesTheScriptToOSAScript(t *testing.T) {
	var got string
	previous := runOSAScript
	runOSAScript = func(_ context.Context, script string) (string, error) {
		got = script
		return "", nil
	}
	defer func() { runOSAScript = previous }()

	if err := Run(context.Background(), "spotify", "shuffle", "off"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if want := `tell application "Spotify" to set shuffling to false`; got != want {
		t.Fatalf("script = %q, want %q", got, want)
	}
}

func TestRunReportsTheScriptError(t *testing.T) {
	previous := runOSAScript
	runOSAScript = func(context.Context, string) (string, error) {
		return "execution error: Spotify got an error", errors.New("exit status 1")
	}
	defer func() { runOSAScript = previous }()

	err := Run(context.Background(), "music", "next", "")
	if err == nil || !strings.Contains(err.Error(), "Spotify got an error") {
		t.Fatalf("error = %v, want the osascript message", err)
	}
}
