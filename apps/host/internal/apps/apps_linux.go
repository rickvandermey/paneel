//go:build linux

package apps

import (
	"bufio"
	"context"
	"os"
	"path/filepath"
	"strings"
)

func desktopDirs() []string {
	home, _ := os.UserHomeDir()
	return []string{
		"/usr/share/applications",
		"/usr/local/share/applications",
		filepath.Join(home, ".local/share/applications"),
	}
}

// Desktop entries name the program and its Exec line; field codes like %U are stripped.
func scan(ctx context.Context) ([]App, error) {
	var result []App
	for _, dir := range desktopDirs() {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".desktop") {
				continue
			}
			if app, ok := parseDesktop(filepath.Join(dir, entry.Name())); ok {
				result = append(result, app)
			}
		}
	}
	return result, nil
}

func parseDesktop(path string) (App, bool) {
	file, err := os.Open(path)
	if err != nil {
		return App{}, false
	}
	defer func() { _ = file.Close() }()
	app := App{Path: path}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "Name=") && app.Name == "":
			app.Name = strings.TrimPrefix(line, "Name=")
		case strings.HasPrefix(line, "Exec=") && app.Target == "":
			exec := strings.TrimPrefix(line, "Exec=")
			if index := strings.Index(exec, " %"); index >= 0 {
				exec = exec[:index]
			}
			app.Target = exec
		case line == "NoDisplay=true":
			return App{}, false
		}
	}
	return app, app.Name != "" && app.Target != ""
}
