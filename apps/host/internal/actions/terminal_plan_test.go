package actions

import (
	"testing"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

func TestPlanTerminal(t *testing.T) {
	claudeTests := protocol.Action{
		Kind:    protocol.ActionTerminal,
		Command: "claude",
		Prompt:  "run the tests and fix failures",
	}
	gitStatus := protocol.Action{Kind: protocol.ActionTerminal, Command: "git status"}
	idle := sessionState{Exists: true, Processes: []string{"login", "-zsh"}}
	runningClaude := sessionState{Exists: true, Busy: true, Processes: []string{"login", "-zsh", "claude"}}
	runningServe := sessionState{Exists: true, Busy: true, Processes: []string{"login", "-zsh", "node"}}

	cases := []struct {
		name   string
		action protocol.Action
		state  sessionState
		want   terminalMode
	}{
		{"no window opens a new one", gitStatus, sessionState{}, terminalNewWindow},
		{"idle session runs the command", gitStatus, idle, terminalRunInSession},
		{"busy session is not interrupted", gitStatus, runningServe, terminalNewWindow},
		{"running program gets the prompt", claudeTests, runningClaude, terminalSendPrompt},
		{"idle session starts the program with its prompt", claudeTests, idle, terminalRunInSession},
		{"other program running means a new window", claudeTests, runningServe, terminalNewWindow},
		{"explicit new window wins over an idle session",
			protocol.Action{Kind: protocol.ActionTerminal, Command: "git status", Window: protocol.TerminalWindowNew},
			idle, terminalNewWindow},
		{"a prompt without a running program does not reuse a busy session",
			claudeTests, sessionState{Exists: true, Busy: true, Processes: []string{"zsh", "/usr/local/bin/codex"}},
			terminalNewWindow},
		{"full process paths match the program",
			protocol.Action{Kind: protocol.ActionTerminal, Command: "/opt/bin/codex --full-auto", Prompt: "fix lint"},
			sessionState{Exists: true, Busy: true, Processes: []string{"zsh", "/opt/bin/codex"}},
			terminalSendPrompt},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := planTerminal(tc.action, tc.state); got != tc.want {
				t.Fatalf("planTerminal = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestTerminalText(t *testing.T) {
	quote := func(value string) string { return "'" + value + "'" }
	action := protocol.Action{Command: "claude", Prompt: "explain this"}
	if got := terminalText(action, terminalSendPrompt, quote); got != "explain this" {
		t.Fatalf("prompt only, got %q", got)
	}
	if got := terminalText(action, terminalRunInSession, quote); got != "claude 'explain this'" {
		t.Fatalf("command with prompt, got %q", got)
	}
	plain := protocol.Action{Command: "git status"}
	if got := terminalText(plain, terminalNewWindow, quote); got != "git status" {
		t.Fatalf("plain command, got %q", got)
	}
}

func TestIsShellProcess(t *testing.T) {
	for _, process := range []string{"-zsh", "login", "/bin/bash", "fish"} {
		if !isShellProcess(process) {
			t.Fatalf("%q should count as a shell", process)
		}
	}
	for _, process := range []string{"claude", "node", "/usr/bin/vim"} {
		if isShellProcess(process) {
			t.Fatalf("%q should not count as a shell", process)
		}
	}
}
