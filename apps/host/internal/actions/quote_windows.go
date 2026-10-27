//go:build windows

package actions

import (
	"fmt"
	"strings"
)

// cmdQuote wraps a value in double quotes for cmd.exe; inner quotes are doubled, which is what
// most programs' argument parsing expects.
func cmdQuote(value string) string {
	return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
}

// argQuote quotes a prompt when it is typed as an argument of a command.
var argQuote = cmdQuote

// withWorkDir prefixes the command with a cd when the action names a working directory; /d also
// switches the drive.
func withWorkDir(text, workDir string) string {
	if workDir == "" {
		return text
	}
	return fmt.Sprintf("cd /d %s && %s", cmdQuote(workDir), text)
}
