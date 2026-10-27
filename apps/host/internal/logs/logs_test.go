package logs

import (
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBufferKeepsTheMostRecentEntries(t *testing.T) {
	buffer := NewBuffer(3)
	for _, message := range []string{"a", "b", "c", "d"} {
		buffer.Append(Entry{Message: message})
	}
	entries := buffer.Entries()
	if len(entries) != 3 || entries[0].Message != "b" || entries[2].Message != "d" {
		t.Fatalf("entries = %+v", entries)
	}
	buffer.Clear()
	if len(buffer.Entries()) != 0 {
		t.Fatal("clear should empty the buffer")
	}
}

func TestRedactHidesTokens(t *testing.T) {
	cases := map[string]string{
		"http://10.0.0.2:48220/?token=abc123":   "http://10.0.0.2:48220/?token=***",
		"ws://h/ws?token=abc&x=1":               "ws://h/ws?token=***&x=1",
		"pairing url=http://h/?Token=ZZZ shown": "pairing url=http://h/?Token=*** shown",
		"nothing to hide":                       "nothing to hide",
	}
	for input, want := range cases {
		if got := Redact(input); got != want {
			t.Fatalf("Redact(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestHandlerRecordsFieldsAndRespectsLevel(t *testing.T) {
	handler, err := New(Options{})
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(handler).With("remote", "10.0.0.5:1234")
	logger.Debug("hidden while not verbose")
	logger.Info("button pressed", "button", "Git status", "url", "http://h/?token=secret")
	entries := handler.Buffer().Entries()
	if len(entries) != 1 {
		t.Fatalf("expected one entry, got %+v", entries)
	}
	entry := entries[0]
	if entry.Level != "info" || entry.Source != SourceHost || entry.Message != "button pressed" {
		t.Fatalf("entry = %+v", entry)
	}
	if !strings.Contains(entry.Fields, `remote=10.0.0.5:1234`) || !strings.Contains(entry.Fields, `button="Git status"`) {
		t.Fatalf("fields = %q", entry.Fields)
	}
	if strings.Contains(entry.Fields, "secret") {
		t.Fatalf("token leaked into fields: %q", entry.Fields)
	}
	handler.SetVerbose(true)
	logger.Debug("now visible")
	if entries := handler.Buffer().Entries(); len(entries) != 2 || entries[1].Level != "debug" {
		t.Fatalf("verbose should record debug lines, got %+v", entries)
	}
}

func TestAppendFromDeckGoesToBufferAndFile(t *testing.T) {
	dir := t.TempDir()
	handler, err := New(Options{Dir: dir})
	if err != nil {
		t.Fatal(err)
	}
	handler.Append(Entry{Level: "warn", Source: SourceDeck, Message: "reconnecting", Fields: "url=http://h/?token=abc"})
	data, err := os.ReadFile(filepath.Join(dir, FileName))
	if err != nil {
		t.Fatal(err)
	}
	line := string(data)
	if !strings.Contains(line, "warn  deck reconnecting url=http://h/?token=***") {
		t.Fatalf("file line = %q", line)
	}
	if entries := handler.Buffer().Entries(); len(entries) != 1 || entries[0].Time.IsZero() {
		t.Fatalf("buffer should hold a timestamped entry, got %+v", entries)
	}
}

func TestRotatingFileShiftsOldFiles(t *testing.T) {
	dir := t.TempDir()
	rotating, err := openRotating(filepath.Join(dir, FileName))
	if err != nil {
		t.Fatal(err)
	}
	line := strings.Repeat("x", 1024) + "\n"
	for index := 0; index < 3*1024+10; index++ {
		if err := rotating.Write(line); err != nil {
			t.Fatal(err)
		}
	}
	names, _ := filepath.Glob(filepath.Join(dir, FileName+"*"))
	if len(names) != keptFiles {
		t.Fatalf("expected %d files, got %v", keptFiles, names)
	}
	info, _ := os.Stat(filepath.Join(dir, FileName))
	if info.Size() > maxFileSize {
		t.Fatalf("current file should stay under the limit, got %d", info.Size())
	}
}

func TestTextRendersHeaderThenLines(t *testing.T) {
	text := Text([]HeaderField{{Key: "app", Value: "Paneel"}, {Key: "version", Value: "0.0.1"}}, []Entry{{Level: "info", Source: SourceHost, Message: "host started", Fields: "port=48220"}})
	if !strings.HasPrefix(text, "app: Paneel\nversion: 0.0.1\n\n") || !strings.Contains(text, "info  host host started port=48220") {
		t.Fatalf("text = %q", text)
	}
}
