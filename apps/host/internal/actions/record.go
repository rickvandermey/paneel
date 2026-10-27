package actions

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/paneel-nx/paneel/host/internal/appcontrol"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// Record is one line of the record file: the action plus what the platform would run for it.
type Record struct {
	protocol.Action
	Script string `json:"script,omitempty"`
}

// record validates the action the way a real run would and writes it down instead of running it.
func (runner *Runner) record(action protocol.Action) error {
	entry := Record{Action: action}
	switch action.Kind {
	case protocol.ActionAppControl:
		script, err := appcontrol.Describe(action.App, action.Control, action.Value)
		if err != nil {
			return err
		}
		entry.Script = script
	case protocol.ActionHotkey:
		if action.Key == "" {
			return fmt.Errorf("hotkey without key")
		}
	case protocol.ActionText, protocol.ActionLaunch, protocol.ActionURL, protocol.ActionShell,
		protocol.ActionTerminal, protocol.ActionMedia, protocol.ActionSwitchProfile:
	default:
		return fmt.Errorf("unknown action kind %q", action.Kind)
	}
	line, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("recording action: %w", err)
	}
	runner.recordMu.Lock()
	defer runner.recordMu.Unlock()
	if err := appendLine(runner.recordFile, line); err != nil {
		return fmt.Errorf("recording action: %w", err)
	}
	return nil
}

// appendLine adds one line to the file, creating it when needed. The close error is checked
// because that is where a full disk shows up.
func appendLine(path string, line []byte) error {
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	if _, err := file.Write(append(line, '\n')); err != nil {
		_ = file.Close()
		return err
	}
	return file.Close()
}
