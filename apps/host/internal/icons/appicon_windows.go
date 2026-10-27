//go:build windows

package icons

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// appIconPNG extracts the associated icon through PowerShell and System.Drawing.
// Untested until a Windows machine is available; see PLAN.md.
func appIconPNG(ctx context.Context, target string) ([]byte, error) {
	dir, err := os.MkdirTemp("", "sd-icon-*")
	if err != nil {
		return nil, err
	}
	defer func() { _ = os.RemoveAll(dir) }()
	output := filepath.Join(dir, "icon.png")
	script := fmt.Sprintf(`Add-Type -AssemblyName System.Drawing; $p = (Get-Command %q -ErrorAction SilentlyContinue).Source; if (-not $p) { $p = %q }; [System.Drawing.Icon]::ExtractAssociatedIcon($p).ToBitmap().Save(%q)`,
		target, target, output)
	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("%w: powershell: %s", ErrNoIcon, strings.TrimSpace(string(out)))
	}
	return os.ReadFile(output)
}
