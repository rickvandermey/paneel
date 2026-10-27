//go:build windows

package appcontrol

import "context"

// Windows has no scripting interface for Spotify; the runner falls back to its shortcuts.
func run(_ context.Context, _, _, _ string) error {
	return ErrNotSupported
}
