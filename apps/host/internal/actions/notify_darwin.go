//go:build darwin

package actions

import (
	"fmt"
	"os/exec"
)

func notify(title, body string) error {
	script := fmt.Sprintf("display notification %s with title %s", appleScriptString(body), appleScriptString(title))
	return exec.Command("osascript", "-e", script).Run()
}
