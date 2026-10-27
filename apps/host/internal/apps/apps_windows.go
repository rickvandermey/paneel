//go:build windows

package apps

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Start Menu shortcuts cover installed programs; launching the .lnk through "start" works for all.
func shortcutDirs() []string {
	return []string{
		filepath.Join(os.Getenv("ProgramData"), `Microsoft\Windows\Start Menu\Programs`),
		filepath.Join(os.Getenv("AppData"), `Microsoft\Windows\Start Menu\Programs`),
	}
}

func scan(ctx context.Context) ([]App, error) {
	var result []App
	for _, dir := range shortcutDirs() {
		_ = filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if ctxErr := ctx.Err(); ctxErr != nil {
				return ctxErr
			}
			name := entry.Name()
			if entry.IsDir() || !strings.EqualFold(filepath.Ext(name), ".lnk") {
				return nil
			}
			title := strings.TrimSuffix(name, filepath.Ext(name))
			if strings.HasPrefix(strings.ToLower(title), "uninstall") {
				return nil
			}
			result = append(result, App{Name: title, Target: path, Path: path})
			return nil
		})
	}
	return result, nil
}
