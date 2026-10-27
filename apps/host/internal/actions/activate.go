package actions

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/paneel-nx/paneel/host/internal/activeapp"
)

const (
	focusTimeout  = 1500 * time.Millisecond
	focusInterval = 25 * time.Millisecond
	// Without active-app detection there is nothing to wait for but the window manager.
	focusGuess = 250 * time.Millisecond
)

// activate brings target to the front and waits until it has the focus, so a hotkey that
// follows lands in the right app instead of whatever was focused before.
func activate(ctx context.Context, target string) error {
	if target == "" {
		return nil
	}
	if err := bringToFront(ctx, target); err != nil {
		return fmt.Errorf("activating %q: %w", target, err)
	}
	return waitForFocus(ctx, target)
}

func waitForFocus(ctx context.Context, target string) error {
	if _, err := activeapp.Current(); errors.Is(err, activeapp.ErrNotSupported) {
		return pause(ctx, focusGuess)
	}
	deadline := time.Now().Add(focusTimeout)
	for {
		current, err := activeapp.Current()
		if err == nil && matchesApp(current, target) {
			return nil
		}
		if time.Now().After(deadline) {
			// The key is sent anyway: some apps report a helper process as focused.
			return nil
		}
		if err := pause(ctx, focusInterval); err != nil {
			return err
		}
	}
}

// matchesApp compares loosely because targets are typed by hand ("zoom.us", "Spotify.exe").
func matchesApp(current activeapp.App, target string) bool {
	wanted := normalizeAppName(target)
	for _, candidate := range []string{current.Name, current.ID} {
		have := normalizeAppName(candidate)
		if have == "" || wanted == "" {
			continue
		}
		if have == wanted || strings.Contains(have, wanted) || strings.Contains(wanted, have) {
			return true
		}
	}
	return false
}

// normalizeAppName reduces a path, bundle name or executable to a lower-case bare name.
func normalizeAppName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if index := strings.LastIndex(value, "/"); index >= 0 {
		value = value[index+1:]
	}
	if index := strings.LastIndex(value, `\`); index >= 0 {
		value = value[index+1:]
	}
	for _, suffix := range []string{".app", ".exe", ".lnk"} {
		value = strings.TrimSuffix(value, suffix)
	}
	return value
}
