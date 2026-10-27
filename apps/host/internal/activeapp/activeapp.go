// Package activeapp reports which application has the focus on the host, so decks can switch to
// the page that belongs to it.
package activeapp

import (
	"context"
	"errors"
	"time"
)

var ErrNotSupported = errors.New("active app detection not supported on this platform")

// App is the frontmost application. ID is the bundle identifier on macOS and the executable
// name on Windows; Name is what the user sees.
type App struct {
	Name string `json:"name"`
	ID   string `json:"id"`
}

// Watch polls the frontmost application and calls onChange whenever it differs from the last
// report. It returns when ctx is done. Polling is cheap and avoids platform event loops.
func Watch(ctx context.Context, interval time.Duration, onChange func(App)) error {
	if _, err := Current(); errors.Is(err, ErrNotSupported) {
		return err
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	var last App
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			current, err := Current()
			if err != nil || current == last || current.Name == "" {
				continue
			}
			last = current
			onChange(current)
		}
	}
}
