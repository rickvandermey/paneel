// Package apps lists the applications installed on the host so the editor can offer them by name.
package apps

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"
)

// App is one launchable application. Target is what the launch action needs: the app name on
// macOS (open -a), the shortcut path on Windows, the Exec command on Linux.
type App struct {
	Name   string `json:"name"`
	Target string `json:"target"`
	Path   string `json:"path"`
}

const cacheTTL = 60 * time.Second

var (
	cacheMu  sync.Mutex
	cached   []App
	cachedAt time.Time
)

// List returns the installed applications sorted by name, cached briefly because scanning
// application folders is slow enough to notice while typing.
func List(ctx context.Context) ([]App, error) {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	if cached != nil && time.Since(cachedAt) < cacheTTL {
		return cached, nil
	}
	list, err := scan(ctx)
	if err != nil {
		return nil, err
	}
	cached = dedupe(list)
	cachedAt = time.Now()
	return cached, nil
}

func dedupe(list []App) []App {
	seen := map[string]bool{}
	result := make([]App, 0, len(list))
	for _, app := range list {
		key := strings.ToLower(app.Name)
		if app.Name == "" || seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, app)
	}
	sort.Slice(result, func(i, j int) bool {
		return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name)
	})
	return result
}
