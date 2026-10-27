package actions

import (
	"context"
	"os/exec"
)

// shell runs a command through the platform's shell and returns everything it printed. Each
// platform only names its shell in shellCommand.
func shell(ctx context.Context, command, workDir string) (string, error) {
	args := shellCommand(command)
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Dir = workDir
	output, err := cmd.CombinedOutput()
	return string(output), err
}
