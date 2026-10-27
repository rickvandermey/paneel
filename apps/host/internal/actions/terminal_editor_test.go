package actions

import (
	"testing"

	"github.com/paneel-nx/paneel/host/internal/activeapp"
)

func TestEditorFor(t *testing.T) {
	cases := []struct {
		name string
		app  activeapp.App
		want editorFamily
		ok   bool
	}{
		{"VS Code on macOS", activeapp.App{Name: "Code", ID: "com.microsoft.VSCode"}, editorVSCode, true},
		{"VS Code on Windows", activeapp.App{Name: "Code", ID: "Code.exe"}, editorVSCode, true},
		{"Cursor by bundle id", activeapp.App{Name: "Cursor", ID: "com.todesktop.230313mzl4w4u92"}, editorVSCode, true},
		{"Zed", activeapp.App{Name: "Zed", ID: "dev.zed.Zed"}, editorZed, true},
		{"WebStorm on macOS", activeapp.App{Name: "WebStorm", ID: "com.jetbrains.WebStorm"}, editorJetBrains, true},
		{"unknown JetBrains product by bundle prefix", activeapp.App{Name: "Aqua", ID: "com.jetbrains.aqua"}, editorJetBrains, true},
		{"IntelliJ on Windows", activeapp.App{Name: "idea64", ID: "idea64.exe"}, editorJetBrains, true},
		{"Android Studio", activeapp.App{Name: "Android Studio", ID: "com.google.android.studio"}, editorJetBrains, true},
		{"Xcode has no terminal", activeapp.App{Name: "Xcode", ID: "com.apple.dt.Xcode"}, 0, false},
		{"a browser is not an editor", activeapp.App{Name: "Google Chrome", ID: "com.google.Chrome"}, 0, false},
		{"nothing in front", activeapp.App{}, 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := editorFor(tc.app)
			if ok != tc.ok || got != tc.want {
				t.Fatalf("editorFor(%+v) = %v, %v; want %v, %v", tc.app, got, ok, tc.want, tc.ok)
			}
		})
	}
}

func TestFocusSequenceLeavesTerminalFocused(t *testing.T) {
	mac := focusSequence(editorVSCode, true)
	if len(mac) != 2 || mac[0].key != "1" || mac[0].modifiers[0] != "cmd" || mac[1].key != "`" {
		t.Fatalf("VS Code on macOS: %+v", mac)
	}
	win := focusSequence(editorVSCode, false)
	if win[0].modifiers[0] != "ctrl" {
		t.Fatalf("VS Code elsewhere uses ctrl+1: %+v", win)
	}
	jet := focusSequence(editorJetBrains, true)
	if len(jet) != 2 || jet[0].key != "escape" || jet[1].key != "f12" {
		t.Fatalf("JetBrains: %+v", jet)
	}
	if got := focusSequence(editorZed, true); len(got) != 1 || got[0].key != "`" {
		t.Fatalf("Zed: %+v", got)
	}
}

func TestSurveyTerminalsTellsIdleBusyAndRunningPrograms(t *testing.T) {
	table := `
  1     0 ??       Ss   /sbin/launchd
 900     1 ??       S    /Applications/Visual Studio Code.app/Contents/MacOS/Electron
 910   900 ??       S    /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin)
 920   910 ??       S    /Users/me/.vscode/extensions/claude-code/native-binary/claude
 930   900 ??       S    /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin)
 940   930 ttys003  Ss   /bin/zsh
 950   940 ttys003  S+   /opt/homebrew/bin/claude
 960   930 ttys004  Ss+  /bin/zsh
 970   930 ttys005  Ss   /bin/zsh
 980   970 ttys005  S+   go
 985   980 ttys005  S+   hostd
 800     1 ??       S    /System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal
 810   800 ttys001  Ss   -zsh
 820   810 ttys001  S+   /opt/homebrew/bin/codex
`
	survey := surveyTerminals(parseProcesses(table), editorProcessNames[editorVSCode])
	if survey.idle != 1 || survey.busy != 2 {
		t.Fatalf("expected 1 idle and 2 busy VS Code terminals, got %+v", survey)
	}
	if !survey.runs("claude") || !survey.runs("hostd") {
		t.Fatalf("claude and hostd run in VS Code terminals: %+v", survey)
	}
	if survey.runs("codex") {
		t.Fatal("codex runs under Terminal, not under VS Code")
	}
	headlessOnly := surveyTerminals(parseProcesses(`
 900     1 ??       S    /Applications/Visual Studio Code.app/Contents/MacOS/Electron
 910   900 ??       S    /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin)
 920   910 ??       S+   /Users/me/.vscode/extensions/claude-code/native-binary/claude
`), editorProcessNames[editorVSCode])
	if headlessOnly.idle != 0 || headlessOnly.busy != 0 || headlessOnly.runs("claude") {
		t.Fatalf("an extension's headless claude has no tty and must not count: %+v", headlessOnly)
	}
	if got := surveyTerminals(parseProcesses(table), editorProcessNames[editorJetBrains]); got.idle != 0 || got.busy != 0 {
		t.Fatalf("no JetBrains terminals in the tree: %+v", got)
	}
}

func TestNewTerminalSequence(t *testing.T) {
	if got := newTerminalSequence(editorVSCode, true); len(got) != 1 || got[0].key != "`" || len(got[0].modifiers) != 2 {
		t.Fatalf("VS Code: %+v", got)
	}
	if got := newTerminalSequence(editorJetBrains, true); len(got) != 3 || got[2].key != "t" || got[2].modifiers[0] != "cmd" {
		t.Fatalf("JetBrains on macOS: %+v", got)
	}
	if got := newTerminalSequence(editorJetBrains, false); got[2].modifiers[0] != "ctrl" {
		t.Fatalf("JetBrains elsewhere: %+v", got)
	}
}
