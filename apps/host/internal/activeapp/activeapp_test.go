package activeapp

import (
	"runtime"
	"testing"
)

func TestCurrentReportsAnApp(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("needs a desktop session")
	}
	app, err := Current()
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("frontmost: %q (%s)", app.Name, app.ID)
	if app.Name == "" && app.ID == "" {
		t.Skip("no frontmost app in this session")
	}
}
