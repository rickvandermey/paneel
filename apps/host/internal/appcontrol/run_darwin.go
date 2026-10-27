//go:build darwin

package appcontrol

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// runOSAScript is replaced in tests so no player is touched.
var runOSAScript = func(ctx context.Context, script string) (string, error) {
	output, err := exec.CommandContext(ctx, "osascript", "-e", script).CombinedOutput()
	return string(output), err
}

func run(ctx context.Context, app, control, value string) error {
	script, err := appleScript(app, control, value)
	if err != nil {
		return err
	}
	output, err := runOSAScript(ctx, script)
	if err != nil {
		if message := strings.TrimSpace(output); message != "" {
			return fmt.Errorf("%s %s: %s", app, control, message)
		}
		return fmt.Errorf("%s %s: %w", app, control, err)
	}
	return nil
}
