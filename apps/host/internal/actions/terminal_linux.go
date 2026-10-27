//go:build linux

package actions

import (
	"context"
	"os/exec"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// runInTerminalApp always opens a new window: there is no portable way to find the frontmost
// terminal session on Linux, so the prompt is passed as an argument.
func (runner *Runner) runInTerminalApp(ctx context.Context, action protocol.Action) error {
	text := terminalText(action, terminalNewWindow, shellQuote)
	runner.logger.Debug("terminal", "app", runner.terminalAppName(), "mode", "new window")
	// exec $SHELL keeps the window open after the command finished.
	cmd := exec.CommandContext(ctx, runner.terminalAppName(), "-e", "sh", "-lc", text+"; exec $SHELL")
	cmd.Dir = action.WorkDir
	return cmd.Start()
}
