//go:build linux

package actions

import (
	"context"
	"fmt"
	"os/exec"
)

func launch(ctx context.Context, target string) error {
	if target == "" {
		return fmt.Errorf("launch without target")
	}
	return exec.CommandContext(ctx, "xdg-open", target).Run()
}

func openURL(ctx context.Context, url string) error {
	return exec.CommandContext(ctx, "xdg-open", url).Run()
}

// A login shell, so the user's PATH additions are available to the command.
func shellCommand(command string) []string {
	return []string{"/bin/sh", "-lc", command}
}

func defaultTerminal() string { return "x-terminal-emulator" }
