package actions

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/paneel-nx/paneel/host/internal/activeapp"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// editorFamily groups editors by the keystrokes that focus their integrated terminal.
type editorFamily int

const (
	editorVSCode editorFamily = iota + 1
	editorZed
	editorJetBrains
)

// editorNames are the app names and bundle or executable ids the active-app probes report,
// lower-cased and without ".exe". Xcode is deliberately absent: it has no terminal.
var editorNames = map[string]editorFamily{
	"code": editorVSCode, "visual studio code": editorVSCode, "code - insiders": editorVSCode,
	"com.microsoft.vscode": editorVSCode, "com.microsoft.vscodeinsiders": editorVSCode,
	"vscodium": editorVSCode, "com.vscodium": editorVSCode,
	"cursor": editorVSCode, "com.todesktop.230313mzl4w4u92": editorVSCode,
	"windsurf": editorVSCode, "com.exafunction.windsurf": editorVSCode,
	"zed": editorZed, "dev.zed.zed": editorZed,
	"intellij idea": editorJetBrains, "idea": editorJetBrains, "idea64": editorJetBrains,
	"webstorm": editorJetBrains, "webstorm64": editorJetBrains,
	"pycharm": editorJetBrains, "pycharm64": editorJetBrains,
	"goland": editorJetBrains, "goland64": editorJetBrains,
	"phpstorm": editorJetBrains, "phpstorm64": editorJetBrains,
	"rider": editorJetBrains, "rider64": editorJetBrains,
	"clion": editorJetBrains, "clion64": editorJetBrains,
	"rubymine": editorJetBrains, "rubymine64": editorJetBrains,
	"datagrip": editorJetBrains, "datagrip64": editorJetBrains,
	"android studio": editorJetBrains, "studio64": editorJetBrains,
	"com.google.android.studio": editorJetBrains,
}

// editorProcessNames are the executables (lower-cased basename) an editor's process tree is
// rooted in, used to tell a program in its integrated terminal from one elsewhere.
var editorProcessNames = map[editorFamily]map[string]bool{
	editorVSCode:    {"code": true, "code - insiders": true, "cursor": true, "windsurf": true, "vscodium": true, "electron": true},
	editorZed:       {"zed": true},
	editorJetBrains: {"idea": true, "webstorm": true, "pycharm": true, "goland": true, "phpstorm": true, "rider": true, "clion": true, "rubymine": true, "datagrip": true, "studio": true, "fleet": true},
}

// editorFor recognizes the editor that is in front. JetBrains bundle ids all start with
// "com.jetbrains.", so that prefix is enough for the whole family.
func editorFor(app activeapp.App) (editorFamily, bool) {
	for _, candidate := range []string{app.Name, app.ID} {
		key := strings.ToLower(strings.TrimSpace(candidate))
		key = strings.TrimSuffix(key, ".exe")
		if family, ok := editorNames[key]; ok {
			return family, true
		}
		if strings.HasPrefix(key, "com.jetbrains.") {
			return editorJetBrains, true
		}
	}
	return 0, false
}

// keystroke is one key with modifiers in a focus sequence.
type keystroke struct {
	key       string
	modifiers []string
}

// focusSequence returns the keys that leave the integrated terminal focused, whatever had the
// focus before. The toggle shortcuts alone would hide the terminal when it already has focus,
// so the sequence first moves the focus elsewhere: VS Code to the first editor group, JetBrains
// to the editor via Escape. Zed only has the toggle.
func focusSequence(family editorFamily, mac bool) []keystroke {
	primary := "ctrl"
	if mac {
		primary = "cmd"
	}
	switch family {
	case editorVSCode:
		return []keystroke{{"1", []string{primary}}, {"`", []string{"ctrl"}}}
	case editorZed:
		return []keystroke{{"`", []string{"ctrl"}}}
	case editorJetBrains:
		return []keystroke{{"escape", nil}, {"f12", []string{"alt"}}}
	}
	return nil
}

// newTerminalSequence opens a fresh integrated terminal, for when the active one is busy. VS Code
// and Zed create one directly; JetBrains needs the tool window focused first, then a new tab.
func newTerminalSequence(family editorFamily, mac bool) []keystroke {
	switch family {
	case editorVSCode, editorZed:
		return []keystroke{{"`", []string{"ctrl", "shift"}}}
	case editorJetBrains:
		if mac {
			return []keystroke{{"escape", nil}, {"f12", []string{"alt"}}, {"t", []string{"cmd"}}}
		}
		return []keystroke{{"escape", nil}, {"f12", []string{"alt"}}, {"t", []string{"ctrl", "shift"}}}
	}
	return nil
}

const (
	// editorKeyDelay gives the editor time to move the focus between two keystrokes.
	editorKeyDelay = 150 * time.Millisecond
	// newTerminalDelay is how long a fresh shell needs before it accepts input.
	newTerminalDelay = 700 * time.Millisecond
)

// runInEditorTerminal types the command into the integrated terminal of the editor that has the
// focus. Unless the action insists on a new window, the editor in front wins over the terminal
// app: that is where the user is working. It reports false when no known editor is in front, so
// the caller falls back to the system terminal.
func (runner *Runner) runInEditorTerminal(ctx context.Context, action protocol.Action) (bool, error) {
	if action.Window == protocol.TerminalWindowNew {
		return false, nil
	}
	current, err := activeapp.Current()
	if err != nil {
		return false, nil
	}
	family, ok := editorFor(current)
	if !ok {
		return false, nil
	}
	isMac := runtime.GOOS == "darwin"
	terminals := editorTerminals(family)
	mode, keys := planEditorTerminal(family, action, terminals, isMac)
	runner.logger.Info("terminal", "where", "editor", "app", current.Name, "mode", mode.String(),
		"idleTerminals", terminals.idle, "busyTerminals", terminals.busy)

	text := terminalText(action, mode, argQuote)
	if mode != terminalSendPrompt {
		text = withWorkDir(text, action.WorkDir)
	}
	if err := sendKeystrokes(ctx, keys); err != nil {
		return true, fmt.Errorf("focusing editor terminal: %w", err)
	}
	if mode == terminalNewWindow {
		if err := pause(ctx, newTerminalDelay); err != nil {
			return true, err
		}
	}
	if err := typeText(text); err != nil {
		return true, fmt.Errorf("typing into editor terminal: %w", err)
	}
	if err := pause(ctx, editorKeyDelay); err != nil {
		return true, err
	}
	return true, hotkey("enter", nil)
}

// planEditorTerminal decides what to type where. The editor cannot be asked which terminal is
// active, so the process table decides: when any of its terminals runs a foreground program (a
// dev server, the host itself), typing into the active one could feed that program, so a new
// terminal is opened instead. When the program the action starts already runs in one of them,
// only the prompt is typed.
func planEditorTerminal(family editorFamily, action protocol.Action, terminals terminalSurvey, isMac bool) (terminalMode, []keystroke) {
	switch {
	case action.Prompt != "" && terminals.runs(commandProgram(action.Command)):
		return terminalSendPrompt, focusSequence(family, isMac)
	case terminals.busy > 0:
		return terminalNewWindow, newTerminalSequence(family, isMac)
	default:
		return terminalRunInSession, focusSequence(family, isMac)
	}
}

// sendKeystrokes presses the keys one by one with a short pause, because editors process a
// focus change asynchronously.
func sendKeystrokes(ctx context.Context, keys []keystroke) error {
	for _, stroke := range keys {
		if err := hotkey(stroke.key, stroke.modifiers); err != nil {
			return err
		}
		if err := pause(ctx, editorKeyDelay); err != nil {
			return err
		}
	}
	return nil
}

// process is one row of the process table.
type process struct {
	pid        int
	parentPID  int
	tty        string
	foreground bool
	name       string
}

// terminalSurvey counts the editor's integrated terminals by state; programs lists what runs in
// the foreground of the busy ones.
type terminalSurvey struct {
	idle     int
	busy     int
	programs []string
}

func (survey terminalSurvey) runs(program string) bool {
	return program != "" && slices.Contains(survey.programs, program)
}

// editorTerminals reads the process table once. Windows has no comparable table, so every
// terminal counts as idle there.
func editorTerminals(family editorFamily) terminalSurvey {
	if runtime.GOOS == "windows" {
		return terminalSurvey{}
	}
	output, err := exec.Command("ps", "-axo", "pid=,ppid=,tty=,stat=,comm=").Output()
	if err != nil {
		return terminalSurvey{}
	}
	return surveyTerminals(parseProcesses(string(output)), editorProcessNames[family])
}

func parseProcesses(table string) []process {
	var processes []process
	for _, line := range strings.Split(table, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		pid, pidErr := strconv.Atoi(fields[0])
		parentPID, parentErr := strconv.Atoi(fields[1])
		if pidErr != nil || parentErr != nil {
			continue
		}
		processes = append(processes, process{
			pid:        pid,
			parentPID:  parentPID,
			tty:        fields[2],
			foreground: strings.Contains(fields[3], "+"),
			name:       strings.Join(fields[4:], " "),
		})
	}
	return processes
}

// maxParentDepth bounds the walk up the process tree; an editor terminal is never deeper.
const maxParentDepth = 16

// surveyTerminals groups the processes on a tty under the editor. The shell owns the terminal
// when it is the foreground process; any other foreground process means the terminal is busy.
func surveyTerminals(processes []process, editorExecutables map[string]bool) terminalSurvey {
	byPID := make(map[int]process, len(processes))
	for _, proc := range processes {
		byPID[proc.pid] = proc
	}
	// Every foreground process per tty: an idle terminal only has its shell there, a busy one
	// also the job (and whatever that job started, such as `go run` plus the built binary).
	foregroundByTTY := map[string][]string{}
	for _, proc := range processes {
		if !proc.foreground || !hasTerminal(proc) || !isUnderEditor(proc, byPID, editorExecutables) {
			continue
		}
		foregroundByTTY[proc.tty] = append(foregroundByTTY[proc.tty], processName(proc.name))
	}
	survey := terminalSurvey{}
	for _, names := range foregroundByTTY {
		busy := false
		for _, name := range names {
			if !isShellProcess(name) {
				busy = true
				survey.programs = append(survey.programs, name)
			}
		}
		if busy {
			survey.busy++
		} else {
			survey.idle++
		}
	}
	return survey
}

// hasTerminal reports whether the process is attached to a tty; ps prints "??" or "?" for none.
func hasTerminal(proc process) bool {
	return proc.tty != "??" && proc.tty != "?" && proc.tty != ""
}

// isUnderEditor walks up the parents until it meets one of the editor's executables.
func isUnderEditor(proc process, byPID map[int]process, editorExecutables map[string]bool) bool {
	current := proc
	for depth := 0; depth < maxParentDepth; depth++ {
		parent, ok := byPID[current.parentPID]
		if !ok || parent.pid == current.pid {
			return false
		}
		if editorExecutables[strings.ToLower(filepath.Base(parent.name))] {
			return true
		}
		current = parent
	}
	return false
}
