package actions

import (
	"context"
	"time"
)

// pause waits for the duration unless the context ends first, so a cancelled press does not
// keep a goroutine sleeping.
func pause(ctx context.Context, duration time.Duration) error {
	select {
	case <-time.After(duration):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
