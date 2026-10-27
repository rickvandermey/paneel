package server

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/paneel-nx/paneel/host/internal/actions"
	"github.com/paneel-nx/paneel/host/internal/assets"
	"github.com/paneel-nx/paneel/host/internal/config"
	"github.com/paneel-nx/paneel/host/internal/logs"
	"github.com/paneel-nx/paneel/host/internal/protocol"
	"github.com/paneel-nx/paneel/host/internal/store"
)

func testStore() *store.Store {
	file := &config.File{Config: protocol.Config{SchemaVersion: 1, Profiles: []protocol.Profile{{
		ID: "p", Name: "Test",
		Buttons: []protocol.Button{
			{ID: "wait", Label: "Wait", Color: "#000000",
				Actions: []protocol.Action{{Kind: protocol.ActionDelay, Millis: 1}}},
			{ID: "mute", Label: "Mute", Color: "#000000",
				Actions: []protocol.Action{{Kind: protocol.ActionDelay, Millis: 1}},
				Toggle:  &protocol.ToggleState{Label: "Unmute", Actions: []protocol.Action{{Kind: protocol.ActionDelay, Millis: 1}}}},
		},
	}}}}
	return store.New(file, nil)
}

func startTestServer(t *testing.T, token string) (*httptest.Server, *store.Store) {
	t.Helper()
	assetStore, err := assets.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	configStore := testStore()
	server := New(Options{
		Token:    token,
		HostName: "testhost",
		Store:    configStore,
		Assets:   assetStore,
		Runner:   actions.NewRunner(actions.Options{}),
		Logger:   slog.New(slog.DiscardHandler),
	})
	ts := httptest.NewServer(server.Handler())
	t.Cleanup(ts.Close)
	return ts, configStore
}

func dial(t *testing.T, ts *httptest.Server, token string) *websocket.Conn {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	url := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws?token=" + token
	conn, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { _ = conn.CloseNow() })
	return conn
}

func read[T any](t *testing.T, conn *websocket.Conn) T {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var value T
	if err := wsjson.Read(ctx, conn, &value); err != nil {
		t.Fatalf("read: %v", err)
	}
	return value
}

func write(t *testing.T, conn *websocket.Conn, value any) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := wsjson.Write(ctx, conn, value); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func handshake(t *testing.T, conn *websocket.Conn) protocol.ConfigMessage {
	t.Helper()
	welcome := read[protocol.Welcome](t, conn)
	if welcome.Type != protocol.TypeWelcome || welcome.HostName != "testhost" {
		t.Fatalf("unexpected welcome: %+v", welcome)
	}
	cfg := read[protocol.ConfigMessage](t, conn)
	if cfg.Type != protocol.TypeConfig || len(cfg.Config.Profiles) != 1 {
		t.Fatalf("unexpected config: %+v", cfg)
	}
	state := read[protocol.ButtonState](t, conn)
	if state.Type != protocol.TypeButtonState {
		t.Fatalf("unexpected button state: %+v", state)
	}
	return cfg
}

func TestHandshakeSendsWelcomeAndConfig(t *testing.T) {
	ts, _ := startTestServer(t, "secret")
	conn := dial(t, ts, "secret")
	cfg := handshake(t, conn)
	if cfg.Config.Revision != 0 {
		t.Fatalf("revision = %d", cfg.Config.Revision)
	}
}

func TestRejectsWrongToken(t *testing.T) {
	ts, _ := startTestServer(t, "secret")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, resp, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(ts.URL, "http")+"/ws?token=wrong", nil)
	if err == nil || resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got err=%v resp=%+v", err, resp)
	}
	resp2, _ := http.Get(ts.URL + "/api/assets")
	if resp2.StatusCode != http.StatusMethodNotAllowed && resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected method/auth rejection, got %d", resp2.StatusCode)
	}
	if denied, _ := http.Get(ts.URL + "/api/session?token=wrong"); denied.StatusCode != http.StatusUnauthorized {
		t.Fatalf("session with a stale token should be 401, got %d", denied.StatusCode)
	}
	if ok, _ := http.Get(ts.URL + "/api/session?token=secret"); ok.StatusCode != http.StatusNoContent {
		t.Fatalf("session with the token should be 204, got %d", ok.StatusCode)
	}
}

func TestPingPongAndPress(t *testing.T) {
	ts, _ := startTestServer(t, "")
	conn := dial(t, ts, "")
	handshake(t, conn)

	write(t, conn, protocol.Ping{Type: protocol.TypePing, SentAt: 42})
	if pong := read[protocol.Pong](t, conn); pong.SentAt != 42 {
		t.Fatalf("unexpected pong: %+v", pong)
	}
	write(t, conn, protocol.Press{Type: protocol.TypePress, ButtonID: "wait", SentAt: 7})
	ack := read[protocol.Ack](t, conn)
	if !ack.OK || ack.ButtonID != "wait" || ack.SentAt != 7 {
		t.Fatalf("unexpected ack: %+v", ack)
	}
	write(t, conn, protocol.Press{Type: protocol.TypePress, ButtonID: "missing"})
	if ack := read[protocol.Ack](t, conn); ack.OK || ack.Error != "unknown button" {
		t.Fatalf("expected unknown button ack, got %+v", ack)
	}
}

func TestCommandIsAppliedAndBroadcastToAllClients(t *testing.T) {
	ts, configStore := startTestServer(t, "")
	editor := dial(t, ts, "")
	handshake(t, editor)
	deck := dial(t, ts, "")
	handshake(t, deck)

	write(t, editor, protocol.CommandMessage{Type: protocol.TypeCommand, CommandID: "c1", BaseRevision: 0, Command: protocol.Command{
		Type: protocol.CmdButtonCreate, ProfileID: "p",
		Button: &protocol.Button{Label: "New", Color: "#123456", Actions: []protocol.Action{}},
	}})
	// The editor receives both the broadcast and its result; order between them is not fixed.
	var result protocol.CommandResult
	var changed protocol.Changed
	for i := 0; i < 2; i++ {
		raw := read[json.RawMessage](t, editor)
		var envelope protocol.Envelope
		_ = json.Unmarshal(raw, &envelope)
		switch envelope.Type {
		case protocol.TypeCommandResult:
			_ = json.Unmarshal(raw, &result)
		case protocol.TypeChanged:
			_ = json.Unmarshal(raw, &changed)
		default:
			t.Fatalf("unexpected message %s", raw)
		}
	}
	if !result.OK || result.CommandID != "c1" || result.Revision != 1 {
		t.Fatalf("result = %+v", result)
	}
	if changed.Revision != 1 || changed.Command.Button == nil || changed.Command.Button.ID == "" {
		t.Fatalf("changed = %+v", changed)
	}
	deckChanged := read[protocol.Changed](t, deck)
	if deckChanged.Revision != 1 || deckChanged.Command.Button.ID != changed.Command.Button.ID {
		t.Fatalf("deck did not receive the change: %+v", deckChanged)
	}
	if configStore.Revision() != 1 {
		t.Fatalf("store revision = %d", configStore.Revision())
	}

	write(t, editor, protocol.CommandMessage{Type: protocol.TypeCommand, CommandID: "c2", Command: protocol.Command{Type: protocol.CmdButtonDelete, ID: "nope"}})
	if bad := read[protocol.CommandResult](t, editor); bad.OK || bad.Error != `unknown button "nope"` {
		t.Fatalf("expected validation error, got %+v", bad)
	}

	write(t, deck, protocol.Sync{Type: protocol.TypeSync})
	if cfg := read[protocol.ConfigMessage](t, deck); cfg.Config.Revision != 1 || len(cfg.Config.Profiles[0].Buttons) != 3 {
		t.Fatalf("sync config = %+v", cfg.Config)
	}
}

func TestAssetUploadAndDownload(t *testing.T) {
	ts, _ := startTestServer(t, "tok")
	var buf bytes.Buffer
	_ = png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 1, 1)))
	request, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/assets", bytes.NewReader(buf.Bytes()))
	request.Header.Set("Authorization", "Bearer tok")
	resp, err := http.DefaultClient.Do(request)
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("upload: err=%v status=%v", err, resp)
	}
	var icon protocol.IconRef
	_ = json.NewDecoder(resp.Body).Decode(&icon)
	_ = resp.Body.Close()
	if icon.Source != protocol.IconAsset || icon.Hash == "" {
		t.Fatalf("icon = %+v", icon)
	}
	get, err := http.Get(ts.URL + "/assets/" + icon.Hash + "?token=tok")
	if err != nil || get.StatusCode != http.StatusOK || get.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("download: err=%v resp=%+v", err, get)
	}
	_ = get.Body.Close()
	if denied, _ := http.Get(ts.URL + "/assets/" + icon.Hash); denied.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", denied.StatusCode)
	}
}

// readUntil skips messages until one of the wanted type arrives.
func readUntil(t *testing.T, conn *websocket.Conn, wanted string) json.RawMessage {
	t.Helper()
	for i := 0; i < 5; i++ {
		raw := read[json.RawMessage](t, conn)
		var head struct {
			Type string `json:"type"`
		}
		_ = json.Unmarshal(raw, &head)
		if head.Type == wanted {
			return raw
		}
	}
	t.Fatalf("no %s message received", wanted)
	return nil
}

func TestTogglePressFlipsStateAndBroadcasts(t *testing.T) {
	ts, _ := startTestServer(t, "tok")
	conn := dial(t, ts, "tok")
	handshake(t, conn)

	write(t, conn, protocol.Press{Type: protocol.TypePress, ButtonID: "mute"})
	var state protocol.ButtonState
	_ = json.Unmarshal(readUntil(t, conn, protocol.TypeButtonState), &state)
	if !state.States["mute"] {
		t.Fatalf("expected mute on after first press, got %+v", state.States)
	}
	write(t, conn, protocol.Press{Type: protocol.TypePress, ButtonID: "mute"})
	// Unmarshal adds to an existing map instead of replacing it, so read into a fresh value.
	var after protocol.ButtonState
	_ = json.Unmarshal(readUntil(t, conn, protocol.TypeButtonState), &after)
	if after.States["mute"] {
		t.Fatalf("expected mute off after second press, got %+v", after.States)
	}
}

func TestRunExecutesAdHocActions(t *testing.T) {
	ts, _ := startTestServer(t, "tok")
	conn := dial(t, ts, "tok")
	handshake(t, conn)
	write(t, conn, protocol.Run{Type: protocol.TypeRun, RunID: "example-1", Actions: []protocol.Action{{Kind: protocol.ActionDelay, Millis: 1}}})
	ack := read[protocol.Ack](t, conn)
	if !ack.OK || ack.ButtonID != "example-1" {
		t.Fatalf("unexpected ack: %+v", ack)
	}
	write(t, conn, protocol.Run{Type: protocol.TypeRun, RunID: "empty"})
	if ack := read[protocol.Ack](t, conn); ack.OK || ack.Error == "" {
		t.Fatalf("expected an error for an empty run, got %+v", ack)
	}
}

func TestLogsCollectHostAndDeckLines(t *testing.T) {
	assetStore, err := assets.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	logHandler, err := logs.New(logs.Options{})
	if err != nil {
		t.Fatal(err)
	}
	configStore := testStore()
	server := New(Options{
		Token:    "secret",
		HostName: "testhost",
		Store:    configStore,
		Assets:   assetStore,
		Runner:   actions.NewRunner(actions.Options{RecordFile: filepath.Join(t.TempDir(), "actions.jsonl")}),
		Logger:   slog.New(logHandler),
		Logs:     logHandler,
	})
	ts := httptest.NewServer(server.Handler())
	t.Cleanup(ts.Close)

	conn := dial(t, ts, "secret")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = wsjson.Write(ctx, conn, protocol.Hello{Type: protocol.TypeHello, ClientID: "c1", Name: "test deck", Version: protocol.Version})
	_ = wsjson.Write(ctx, conn, protocol.Press{Type: protocol.TypePress, ButtonID: "wait"})
	_ = wsjson.Write(ctx, conn, protocol.LogMessage{Type: protocol.TypeLog, Level: "warn", Message: "deck says hi", Fields: "url=http://h/?token=abc"})
	_ = wsjson.Write(ctx, conn, protocol.Ping{Type: protocol.TypePing, SentAt: 1})
	for {
		var raw json.RawMessage
		if err := wsjson.Read(ctx, conn, &raw); err != nil {
			t.Fatal(err)
		}
		var envelope protocol.Envelope
		_ = json.Unmarshal(raw, &envelope)
		if envelope.Type == protocol.TypePong {
			break
		}
	}

	resp, err := http.Get(ts.URL + "/api/logs?token=secret")
	if err != nil {
		t.Fatal(err)
	}
	var body struct {
		Header  []map[string]string `json:"header"`
		Entries []logs.Entry        `json:"entries"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	joined := ""
	for _, entry := range body.Entries {
		joined += logs.Line(entry) + "\n"
	}
	for _, want := range []string{"client connected", "button pressed", `actions=`, "deck deck says hi", "token=***"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("log should contain %q, got:\n%s", want, joined)
		}
	}
	if strings.Contains(joined, "token=abc") {
		t.Fatalf("token leaked: %s", joined)
	}
	if len(body.Header) == 0 || body.Header[0]["key"] != "app" {
		t.Fatalf("header = %v", body.Header)
	}

	text, _ := http.Get(ts.URL + "/api/logs?token=secret&format=text")
	if text.Header.Get("Content-Disposition") == "" {
		t.Fatal("text export should be an attachment")
	}
	cleared, _ := http.Post(ts.URL+"/api/logs/clear?token=secret", "", nil)
	if cleared.StatusCode != http.StatusNoContent {
		t.Fatalf("clear = %d", cleared.StatusCode)
	}
	if entries := logHandler.Buffer().Entries(); len(entries) != 1 || entries[0].Message != "log cleared from a deck" {
		t.Fatalf("after clear: %+v", entries)
	}
}
