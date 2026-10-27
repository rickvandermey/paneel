//go:build windows

package actions

import (
	"fmt"
	"os/exec"
	"strings"
)

// notify uses a tray balloon through .NET; it needs no extra module and works on every Windows 10+.
func notify(title, body string) error {
	escape := func(value string) string { return strings.ReplaceAll(value, "'", "''") }
	script := fmt.Sprintf(`Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(5000, '%s', '%s', [System.Windows.Forms.ToolTipIcon]::Info); Start-Sleep -Seconds 6; $n.Dispose()`, escape(title), escape(body))
	return exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script).Start()
}
