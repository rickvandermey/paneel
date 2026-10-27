//go:build darwin

package actions

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// launch opens an app by name, or a file or folder by absolute path.
func launch(ctx context.Context, target string) error {
	if target == "" {
		return fmt.Errorf("launch without target")
	}
	if strings.HasPrefix(target, "/") {
		return exec.CommandContext(ctx, "open", target).Run()
	}
	return exec.CommandContext(ctx, "open", "-a", target).Run()
}

func openURL(ctx context.Context, url string) error {
	return exec.CommandContext(ctx, "open", url).Run()
}

// A login shell, so the user's PATH additions (Homebrew, nvm) are available to the command.
func shellCommand(command string) []string {
	return []string{"/bin/zsh", "-lc", command}
}

func defaultTerminal() string { return "Terminal" }
