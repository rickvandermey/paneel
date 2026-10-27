//go:build darwin

package actions

import "strings"

// appleScriptString quotes a value as an AppleScript string literal.
func appleScriptString(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, `"`, `\"`)
	return `"` + value + `"`
}
