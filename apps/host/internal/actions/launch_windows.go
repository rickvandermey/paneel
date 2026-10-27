//go:build windows

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
	// The empty argument is the window title "start" expects before the target.
	return exec.CommandContext(ctx, "cmd", "/c", "start", "", target).Run()
}

func openURL(ctx context.Context, url string) error {
	return exec.CommandContext(ctx, "rundll32", "url.dll,FileProtocolHandler", url).Run()
}

func shellCommand(command string) []string {
	return []string{"cmd", "/c", command}
}

func defaultTerminal() string { return "wt" }
