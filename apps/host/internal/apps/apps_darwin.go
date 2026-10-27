//go:build darwin

package apps

import (
	"context"
	"os"
	"path/filepath"
	"strings"
)

// Application folders in the order Finder shows them; one level of subfolders (Utilities) is included.
func applicationDirs() []string {
	home, _ := os.UserHomeDir()
	return []string{
		"/Applications",
		"/System/Applications",
		"/System/Applications/Utilities",
		filepath.Join(home, "Applications"),
	}
}

func scan(ctx context.Context) ([]App, error) {
	var result []App
	for _, dir := range applicationDirs() {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		result = append(result, scanDir(dir, true)...)
	}
	return result, nil
}

func scanDir(dir string, recurse bool) []App {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var result []App
	for _, entry := range entries {
		name := entry.Name()
		full := filepath.Join(dir, name)
		if strings.HasSuffix(name, ".app") {
			title := strings.TrimSuffix(name, ".app")
			result = append(result, App{Name: title, Target: title, Path: full})
			continue
		}
		if recurse && entry.IsDir() && !strings.HasPrefix(name, ".") {
			result = append(result, scanDir(full, false)...)
		}
	}
	return result
}
