//go:build windows

package actions

import (
	"context"
	"os/exec"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// runInTerminalApp runs the command in Windows Terminal: as a new tab of the most recent window
// when the action reuses the terminal, otherwise in a new window. Typing into an existing tab is
// not scriptable there, so the prompt is always passed as an argument. Without Windows Terminal
// a plain cmd window opens.
func (runner *Runner) runInTerminalApp(ctx context.Context, action protocol.Action) error {
	text := terminalText(action, terminalNewWindow, cmdQuote)
	reuseWindow := action.Window != protocol.TerminalWindowNew
	runner.logger.Debug("terminal", "app", "wt", "reuseWindow", reuseWindow)
	args := []string{}
	if reuseWindow {
		args = append(args, "-w", "0", "nt")
	}
	if action.WorkDir != "" {
		args = append(args, "-d", action.WorkDir)
	}
	args = append(args, "cmd", "/k", text)
	if err := exec.CommandContext(ctx, "wt", args...).Start(); err == nil {
		return nil
	}
	cmd := exec.CommandContext(ctx, "cmd", "/c", "start", "cmd", "/k", text)
	cmd.Dir = action.WorkDir
	return cmd.Start()
}
