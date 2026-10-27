//go:build linux

package actions

import "os/exec"

func notify(title, body string) error {
	return exec.Command("notify-send", title, body).Run()
}
