// Package appcontrol drives a specific application, such as Spotify's shuffle, through the
// scripting interface the platform offers for it: AppleScript on macOS, MPRIS on Linux. Where
// no such interface exists the caller falls back to the app's keyboard shortcut.
package appcontrol

import (
	"context"
	"errors"
	"fmt"
	"runtime"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// ErrNotSupported means this platform has no scripting interface for the app; the caller
// should fall back to Shortcut.
var ErrNotSupported = errors.New("app control not supported on this platform")

// Shortcut is the keyboard fallback for a control: focus Target and press the key.
type Shortcut struct {
	Target    string
	Key       string
	Modifiers []string
}

var knownApps = map[string]bool{protocol.AppSpotify: true, protocol.AppMusic: true}

// twoStateControls take a value (on, off or toggle); the transport controls do not.
var twoStateControls = map[string]bool{protocol.AppControlShuffle: true, protocol.AppControlRepeat: true}

var knownControls = map[string]bool{
	protocol.AppControlShuffle: true, protocol.AppControlRepeat: true,
	protocol.MediaPlayPause: true, protocol.MediaNext: true, protocol.MediaPrevious: true,
}

var knownValues = map[string]bool{protocol.AppValueOn: true, protocol.AppValueOff: true, protocol.AppValueToggle: true}

// validate normalises an empty value to toggle so a bare "shuffle" behaves like the button in
// the app itself.
func validate(app, control, value string) (string, error) {
	if !knownApps[app] {
		return "", fmt.Errorf("unknown app %q", app)
	}
	if !knownControls[control] {
		return "", fmt.Errorf("unknown control %q", control)
	}
	if !twoStateControls[control] {
		return "", nil
	}
	if value == "" {
		value = protocol.AppValueToggle
	}
	if !knownValues[value] {
		return "", fmt.Errorf("unknown value %q", value)
	}
	return value, nil
}

// Run performs the control on the app. It returns ErrNotSupported when the platform cannot
// script the app, after validating the request so a bad action still fails loudly.
func Run(ctx context.Context, app, control, value string) error {
	normalised, err := validate(app, control, value)
	if err != nil {
		return err
	}
	return run(ctx, app, control, normalised)
}

// Describe validates the request and returns the AppleScript it would run on macOS, for
// recording what a press would do without touching any player.
func Describe(app, control, value string) (string, error) {
	normalised, err := validate(app, control, value)
	if err != nil {
		return "", err
	}
	return appleScript(app, control, normalised)
}

// ShortcutFor returns the keyboard shortcut that performs the control in the app on this
// platform, for apps without a scripting interface.
func ShortcutFor(app, control string) (Shortcut, bool) {
	return shortcutFor(runtime.GOOS, app, control)
}

// Spotify's desktop shortcuts are documented at support.spotify.com/article/keyboard-shortcuts.
// Shuffle and repeat use Option on macOS and Ctrl elsewhere; next and previous use the
// platform's primary modifier.
func shortcutFor(goos, app, control string) (Shortcut, bool) {
	if app != protocol.AppSpotify {
		return Shortcut{}, false
	}
	primaryModifier := "ctrl"
	toggleModifier := "ctrl"
	if goos == "darwin" {
		primaryModifier = "cmd"
		toggleModifier = "alt"
	}
	target := "Spotify"
	if goos == "linux" {
		target = "spotify"
	}
	switch control {
	case protocol.AppControlShuffle:
		return Shortcut{Target: target, Key: "s", Modifiers: []string{toggleModifier}}, true
	case protocol.AppControlRepeat:
		return Shortcut{Target: target, Key: "r", Modifiers: []string{toggleModifier}}, true
	case protocol.MediaPlayPause:
		return Shortcut{Target: target, Key: "space"}, true
	case protocol.MediaNext:
		return Shortcut{Target: target, Key: "right", Modifiers: []string{primaryModifier}}, true
	case protocol.MediaPrevious:
		return Shortcut{Target: target, Key: "left", Modifiers: []string{primaryModifier}}, true
	}
	return Shortcut{}, false
}
