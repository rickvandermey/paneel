// Package actions executes the actions attached to a deck button on the host machine.
//
// runner.go dispatches one action to its implementation. The platform differences live in
// launch_<os>.go (apps, URLs, shells), terminal_<os>.go (terminal apps) and notify_<os>.go;
// terminal_editor.go handles the integrated terminal of a focused editor, activate.go brings an
// app to the front, record.go is the dry-run used by the e2e suite.
package actions

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/paneel-nx/paneel/host/internal/appcontrol"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

type Options struct {
	// Terminal is the terminal application used by the terminal action (macOS: "Terminal" or "iTerm").
	Terminal string
	// RecordFile makes the runner a dry run: actions are validated and appended to this file as
	// JSON lines instead of being executed, so a test suite can assert what a press would do.
	RecordFile string
	// Logger receives the decisions worth seeing in a bug report, such as where a terminal
	// action ended up; nil means a discarded log.
	Logger *slog.Logger
}

type Runner struct {
	terminalMu   sync.RWMutex
	terminalName string
	recordFile   string
	recordMu     sync.Mutex
	logger       *slog.Logger
}

func NewRunner(opts Options) *Runner {
	runner := &Runner{recordFile: opts.RecordFile, logger: opts.Logger}
	if runner.logger == nil {
		runner.logger = slog.New(slog.DiscardHandler)
	}
	runner.SetTerminal(opts.Terminal)
	return runner
}

// SetTerminal follows the terminal setting so changes made in the editor apply without a restart.
func (runner *Runner) SetTerminal(terminal string) {
	if terminal == "" {
		terminal = defaultTerminal()
	}
	runner.terminalMu.Lock()
	defer runner.terminalMu.Unlock()
	runner.terminalName = terminal
}

func (runner *Runner) terminalAppName() string {
	runner.terminalMu.RLock()
	defer runner.terminalMu.RUnlock()
	return runner.terminalName
}

// Run executes the actions in order and stops at the first failure.
func (runner *Runner) Run(ctx context.Context, actions []protocol.Action) error {
	for index, action := range actions {
		if err := runner.runOne(ctx, action); err != nil {
			return fmt.Errorf("action %d (%s): %w", index+1, action.Kind, err)
		}
	}
	return nil
}

func (runner *Runner) runOne(ctx context.Context, action protocol.Action) error {
	// Delays still run in a dry run, so multi-action timing stays realistic.
	if runner.recordFile != "" && action.Kind != protocol.ActionDelay {
		return runner.record(action)
	}
	switch action.Kind {
	case protocol.ActionHotkey:
		if err := activate(ctx, action.Target); err != nil {
			return err
		}
		return hotkey(action.Key, action.Modifiers)
	case protocol.ActionText:
		return typeText(action.Text)
	case protocol.ActionLaunch:
		return launch(ctx, action.Target)
	case protocol.ActionURL:
		return openURL(ctx, action.URL)
	case protocol.ActionMedia:
		return media(action.Control)
	case protocol.ActionSwitchProfile:
		// Profile switching is a client-side navigation; the host has nothing to execute.
		return nil
	case protocol.ActionAppControl:
		return appControl(ctx, action)
	case protocol.ActionShell:
		return runner.runShellAndNotify(ctx, action)
	case protocol.ActionTerminal:
		if handled, err := runner.runInEditorTerminal(ctx, action); handled {
			return err
		}
		return runner.runInTerminalApp(ctx, action)
	case protocol.ActionDelay:
		return pause(ctx, time.Duration(action.Millis)*time.Millisecond)
	default:
		return fmt.Errorf("unknown action kind %q", action.Kind)
	}
}

// Notifier shows a desktop notification; replaced in tests and set per platform in notify_*.go.
var Notifier = notify

// maxNotificationLength keeps the body of a notification on one line of the banner.
const maxNotificationLength = 120

// runShellAndNotify runs a command without a window and tells the user how it went, because
// there is no other feedback on the desktop for a background command. Silent actions skip the
// notification.
func (runner *Runner) runShellAndNotify(ctx context.Context, action protocol.Action) error {
	output, err := shell(ctx, action.Command, action.WorkDir)
	if action.Silent {
		return err
	}
	title := "Done: " + action.Command
	body := lastLine(output)
	if err != nil {
		title = "Failed: " + action.Command
		if body == "" {
			body = err.Error()
		}
	}
	// The command itself is what matters; a missing notification tool is not an action failure.
	_ = Notifier(title, body)
	return err
}

// lastLine keeps notifications short: the final non-empty line of the output, trimmed.
func lastLine(output string) string {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	for index := len(lines) - 1; index >= 0; index-- {
		line := strings.TrimSpace(lines[index])
		if line == "" {
			continue
		}
		if len(line) > maxNotificationLength {
			return line[:maxNotificationLength-3] + "..."
		}
		return line
	}
	return ""
}

// appControl scripts the app where the platform allows it and otherwise focuses the app and
// presses its own shortcut, which is what a user would do by hand.
func appControl(ctx context.Context, action protocol.Action) error {
	err := appcontrol.Run(ctx, action.App, action.Control, action.Value)
	if !errors.Is(err, appcontrol.ErrNotSupported) {
		return err
	}
	shortcut, ok := appcontrol.ShortcutFor(action.App, action.Control)
	if !ok {
		return fmt.Errorf("%s %s is not available on this platform", action.App, action.Control)
	}
	if err := activate(ctx, shortcut.Target); err != nil {
		return err
	}
	return hotkey(shortcut.Key, shortcut.Modifiers)
}
