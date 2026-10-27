package apps

import (
	"context"
	"runtime"
	"testing"
)

func TestListFindsCommonApps(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("needs a macOS application folder")
	}
	list, err := List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, app := range list {
		if app.Name == "Calculator" && app.Target == "Calculator" {
			found = true
		}
	}
	if !found {
		t.Fatalf("Calculator not found in %d apps", len(list))
	}
	for i := 1; i < len(list); i++ {
		if list[i-1].Name == list[i].Name {
			t.Fatalf("duplicate app %q", list[i].Name)
		}
	}
}
