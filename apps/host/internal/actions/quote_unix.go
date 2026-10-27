//go:build !windows

package actions

import (
	"fmt"
	"strings"
)

// shellQuote wraps a value in single quotes for POSIX shells; an inner quote ends the string,
// adds an escaped quote and starts it again.
func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", `'\''`) + "'"
}

// argQuote quotes a prompt when it is typed as an argument of a command.
var argQuote = shellQuote

// withWorkDir prefixes the command with a cd when the action names a working directory.
func withWorkDir(text, workDir string) string {
	if workDir == "" {
		return text
	}
	return fmt.Sprintf("cd %s && %s", shellQuote(workDir), text)
}
