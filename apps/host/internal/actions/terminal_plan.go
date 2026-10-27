package actions

import (
	"path/filepath"
	"strings"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// sessionState is what the platform could learn about the frontmost terminal session.
type sessionState struct {
	// Exists is false when the terminal app has no window to reuse.
	Exists bool
	// Busy means a foreground process other than the shell is running, so typing into the
	// session would reach that process instead of the shell.
	Busy bool
	// Processes are the names of the processes attached to the session, shell included.
	Processes []string
}

type terminalMode int

const (
	// terminalNewWindow opens a new window and runs the full command there.
	terminalNewWindow terminalMode = iota
	// terminalRunInSession types the full command into the open, idle session.
	terminalRunInSession
	// terminalSendPrompt sends only the prompt, because the program is already running there.
	terminalSendPrompt
)

func (mode terminalMode) String() string {
	switch mode {
	case terminalRunInSession:
		return "reuse session"
	case terminalSendPrompt:
		return "send prompt"
	default:
		return "new window"
	}
}

// planTerminal decides where a terminal action runs. Reuse is the default because project
// commands belong in the directory the user already works in; a busy session is never
// interrupted, and a program that is already running gets the prompt instead of being started
// a second time.
func planTerminal(action protocol.Action, state sessionState) terminalMode {
	if action.Window == protocol.TerminalWindowNew || !state.Exists {
		return terminalNewWindow
	}
	if action.Prompt != "" && runsProgram(state.Processes, commandProgram(action.Command)) {
		return terminalSendPrompt
	}
	if state.Busy {
		return terminalNewWindow
	}
	return terminalRunInSession
}

// commandProgram is the executable a command starts: "claude" for `claude --verbose`.
func commandProgram(command string) string {
	fields := strings.Fields(command)
	if len(fields) == 0 {
		return ""
	}
	return filepath.Base(fields[0])
}

var shellNames = map[string]bool{
	"sh": true, "bash": true, "zsh": true, "fish": true, "login": true, "nu": true, "pwsh": true,
	"powershell": true, "cmd": true,
}

func runsProgram(processes []string, program string) bool {
	if program == "" {
		return false
	}
	for _, process := range processes {
		if processName(process) == program {
			return true
		}
	}
	return false
}

// processName normalizes what terminals report: login shells carry a leading dash ("-zsh") and
// some report full paths.
func processName(process string) string {
	return strings.TrimPrefix(filepath.Base(strings.TrimSpace(process)), "-")
}

func isShellProcess(process string) bool {
	return shellNames[processName(process)]
}

// terminalText is what gets typed for the chosen mode: the prompt alone, or the command with
// the prompt as a single quoted argument.
func terminalText(action protocol.Action, mode terminalMode, quote func(string) string) string {
	if mode == terminalSendPrompt {
		return action.Prompt
	}
	if action.Prompt == "" {
		return action.Command
	}
	return action.Command + " " + quote(action.Prompt)
}
