//go:build darwin

package actions

import (
	"context"
	"os/exec"
)

// open -a both launches and activates, so one call covers a closed and a background app.
func bringToFront(ctx context.Context, target string) error {
	return exec.CommandContext(ctx, "open", "-a", target).Run()
}
