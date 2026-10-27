//go:build darwin

package activeapp

import (
	"os"
	"testing"
	"time"
)

// TestProbeSamples prints the focused app for a few seconds; run with SD_PROBE=1 while switching apps.
func TestProbeSamples(t *testing.T) {
	if os.Getenv("SD_PROBE") == "" {
		t.Skip("manual probe")
	}
	t.Logf("%s accessibility trusted: %v", time.Now().Format("15:04:05.0"), Trusted())
	deadline := time.Now().Add(20 * time.Second)
	last := App{}
	for time.Now().Before(deadline) {
		app, _ := Current()
		if app != last {
			t.Logf("%s focused: %q (%s)", time.Now().Format("15:04:05.0"), app.Name, app.ID)
			last = app
		}
		time.Sleep(300 * time.Millisecond)
	}
}
