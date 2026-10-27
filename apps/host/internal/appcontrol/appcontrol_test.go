package appcontrol

import (
	"strings"
	"testing"
)

func TestAppleScriptSetsSpotifyShuffle(t *testing.T) {
	script, err := appleScript("spotify", "shuffle", "on")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if want := `tell application "Spotify" to set shuffling to true`; script != want {
		t.Fatalf("script = %q, want %q", script, want)
	}
}

func TestAppleScriptTogglesByReadingTheCurrentValue(t *testing.T) {
	script, err := appleScript("spotify", "repeat", "toggle")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, want := range []string{"if repeating then", "set repeating to false", "set repeating to true"} {
		if !strings.Contains(script, want) {
			t.Fatalf("script %q lacks %q", script, want)
		}
	}
}

func TestAppleScriptUsesMusicVocabulary(t *testing.T) {
	shuffle, _ := appleScript("music", "shuffle", "off")
	if want := `tell application "Music" to set shuffle enabled to false`; shuffle != want {
		t.Fatalf("shuffle = %q, want %q", shuffle, want)
	}
	repeat, _ := appleScript("music", "repeat", "on")
	if want := `tell application "Music" to set song repeat to all`; repeat != want {
		t.Fatalf("repeat = %q, want %q", repeat, want)
	}
	next, _ := appleScript("music", "next", "")
	if want := `tell application "Music" to next track`; next != want {
		t.Fatalf("next = %q, want %q", next, want)
	}
}

func TestValidateDefaultsToToggleAndRejectsUnknowns(t *testing.T) {
	value, err := validate("spotify", "shuffle", "")
	if err != nil || value != "toggle" {
		t.Fatalf("validate = %q, %v; want toggle", value, err)
	}
	if _, err := validate("winamp", "shuffle", "on"); err == nil {
		t.Fatalf("expected an error for an unknown app")
	}
	if _, err := validate("spotify", "eject", ""); err == nil {
		t.Fatalf("expected an error for an unknown control")
	}
	if _, err := validate("spotify", "shuffle", "maybe"); err == nil {
		t.Fatalf("expected an error for an unknown value")
	}
}

func TestShortcutFollowsSpotifyDocumentation(t *testing.T) {
	mac, ok := shortcutFor("darwin", "spotify", "shuffle")
	if !ok || mac.Key != "s" || strings.Join(mac.Modifiers, "+") != "alt" || mac.Target != "Spotify" {
		t.Fatalf("mac shuffle = %+v", mac)
	}
	win, ok := shortcutFor("windows", "spotify", "next")
	if !ok || win.Key != "right" || strings.Join(win.Modifiers, "+") != "ctrl" {
		t.Fatalf("windows next = %+v", win)
	}
	if _, ok := shortcutFor("windows", "music", "shuffle"); ok {
		t.Fatalf("Music has no shortcut fallback")
	}
}
