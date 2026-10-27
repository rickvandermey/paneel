//go:build darwin

package actions

import (
	"context"
	"fmt"
	"os/exec"
	"strings"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

func (runner *Runner) usesITerm() bool {
	switch strings.ToLower(runner.terminalAppName()) {
	case "iterm", "iterm2":
		return true
	}
	return false
}

// runInTerminalApp runs the command in the configured terminal app: in the frontmost session
// when it is idle (or when the program the action starts is already running there), otherwise
// in a new window.
func (runner *Runner) runInTerminalApp(ctx context.Context, action protocol.Action) error {
	state := sessionState{}
	if action.Window != protocol.TerminalWindowNew {
		state = runner.frontSession(ctx)
	}
	mode := planTerminal(action, state)
	runner.logger.Debug("terminal", "app", runner.terminalAppName(), "mode", mode.String(),
		"sessionBusy", state.Busy, "sessionExists", state.Exists)
	text := terminalText(action, mode, shellQuote)
	if mode != terminalSendPrompt {
		text = withWorkDir(text, action.WorkDir)
	}
	script := terminalAppleScript(runner.usesITerm(), mode == terminalNewWindow, text)
	return exec.CommandContext(ctx, "osascript", "-e", script).Run()
}

// terminalAppleScript types text into Terminal or iTerm, in a new window or the current session.
func terminalAppleScript(useITerm, newWindow bool, text string) string {
	quoted := appleScriptString(text)
	switch {
	case useITerm && newWindow:
		return fmt.Sprintf(`tell application "iTerm"
	activate
	set newWindow to (create window with default profile)
	tell current session of newWindow to write text %s
end tell`, quoted)
	case useITerm:
		return fmt.Sprintf(`tell application "iTerm"
	activate
	tell current session of current window to write text %s
end tell`, quoted)
	case newWindow:
		return fmt.Sprintf(`tell application "Terminal"
	activate
	do script %s
end tell`, quoted)
	default:
		return fmt.Sprintf(`tell application "Terminal"
	activate
	do script %s in selected tab of front window
end tell`, quoted)
	}
}

// frontSession asks the terminal app about its frontmost session. Terminal reports a busy flag
// and the process list of the tab; iTerm reports the foreground job name. Any scripting error
// counts as "no session", which falls back to a new window.
func (runner *Runner) frontSession(ctx context.Context) sessionState {
	script := `tell application "Terminal"
	if (count of windows) is 0 then return "none"
	set theTab to selected tab of front window
	set AppleScript's text item delimiters to ","
	return (busy of theTab as text) & "|" & (processes of theTab as text)
end tell`
	if runner.usesITerm() {
		script = `tell application "iTerm"
	if (count of windows) is 0 then return "none"
	tell current session of current window
		return "job|" & (variable named "jobName")
	end tell
end tell`
	}
	output, err := exec.CommandContext(ctx, "osascript", "-e", script).Output()
	if err != nil {
		return sessionState{}
	}
	return parseSession(strings.TrimSpace(string(output)))
}

// parseSession reads "none", "true|login,-zsh,claude" (Terminal) or "job|claude" (iTerm).
func parseSession(output string) sessionState {
	flag, list, found := strings.Cut(output, "|")
	if !found || output == "none" {
		return sessionState{}
	}
	processes := strings.Split(list, ",")
	state := sessionState{Exists: true, Processes: processes}
	switch flag {
	case "true":
		state.Busy = true
	case "job":
		state.Busy = list != "" && !isShellProcess(list)
	}
	return state
}
