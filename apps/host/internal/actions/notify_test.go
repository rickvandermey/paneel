package actions

import (
	"context"
	"runtime"
	"testing"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

func TestSilentShellNotifiesWithTheLastOutputLine(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("uses a POSIX shell command")
	}
	var gotTitle, gotBody string
	previous := Notifier
	Notifier = func(title, body string) error {
		gotTitle, gotBody = title, body
		return nil
	}
	defer func() { Notifier = previous }()

	runner := NewRunner(Options{})
	err := runner.Run(context.Background(), []protocol.Action{{Kind: protocol.ActionShell, Command: "printf 'one\\ntwo\\n'"}})
	if err != nil {
		t.Fatal(err)
	}
	if gotTitle != "Done: printf 'one\\ntwo\\n'" || gotBody != "two" {
		t.Fatalf("notification = %q / %q", gotTitle, gotBody)
	}

	gotTitle, gotBody = "", ""
	err = runner.Run(context.Background(), []protocol.Action{{Kind: protocol.ActionShell, Command: "exit 3", Silent: true}})
	if err == nil {
		t.Fatal("expected the failing command to report an error")
	}
	if gotTitle != "" {
		t.Fatalf("silent action must not notify, got %q", gotTitle)
	}

	err = runner.Run(context.Background(), []protocol.Action{{Kind: protocol.ActionShell, Command: "exit 3"}})
	if err == nil || gotTitle != "Failed: exit 3" || gotBody == "" {
		t.Fatalf("failure notification = %q / %q (err %v)", gotTitle, gotBody, err)
	}
}
