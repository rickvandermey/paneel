//go:build !darwin

package actions

import (
	"context"

	"github.com/go-vgo/robotgo"
)

// A running app is raised by window title; one that is not running is launched instead.
func bringToFront(ctx context.Context, target string) error {
	if err := robotgo.ActiveName(target); err == nil {
		return nil
	}
	return launch(ctx, target)
}
