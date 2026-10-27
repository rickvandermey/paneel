package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/paneel-nx/paneel/host/internal/logs"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// handleWebSocket keeps one deck connected: it sends the initial state, then answers every
// message until the deck goes away.
func (server *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	if !server.authorized(r) {
		server.opts.Logger.Warn("deck rejected: stale or wrong token", "remote", r.RemoteAddr)
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		// Clients are served by this host or run inside Capacitor; the token check is the real gate.
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		server.opts.Logger.Warn("websocket accept failed", "err", err)
		return
	}
	defer func() { _ = conn.CloseNow() }()
	ctx := r.Context()
	logger := server.opts.Logger.With("remote", r.RemoteAddr)

	server.rememberConnection(conn, r.RemoteAddr)
	defer func() {
		server.forgetConnection(conn)
		logger.Info("client disconnected")
	}()

	if err := server.sendInitialState(ctx, conn); err != nil {
		return
	}
	for {
		var raw json.RawMessage
		if err := wsjson.Read(ctx, conn, &raw); err != nil {
			return
		}
		server.handleClientMessage(ctx, conn, raw, logger, r.RemoteAddr)
	}
}

func (server *Server) rememberConnection(conn *websocket.Conn, remoteAddr string) {
	server.mu.Lock()
	defer server.mu.Unlock()
	server.connections[conn] = remoteAddr
}

func (server *Server) forgetConnection(conn *websocket.Conn) {
	server.mu.Lock()
	defer server.mu.Unlock()
	delete(server.connections, conn)
}

// sendInitialState gives a fresh deck everything it needs to render: who the host is, the config,
// the focused app when known, and which toggle keys are on.
func (server *Server) sendInitialState(ctx context.Context, conn *websocket.Conn) error {
	if err := wsjson.Write(ctx, conn, server.welcome()); err != nil {
		return err
	}
	if err := server.sendConfig(ctx, conn); err != nil {
		return err
	}
	server.mu.Lock()
	activeApp := server.activeApp
	server.mu.Unlock()
	if activeApp != nil {
		_ = wsjson.Write(ctx, conn, *activeApp)
	}
	_ = wsjson.Write(ctx, conn, server.buttonState())
	return nil
}

func (server *Server) sendConfig(ctx context.Context, conn *websocket.Conn) error {
	return wsjson.Write(ctx, conn, server.configMessage())
}

func (server *Server) configMessage() protocol.ConfigMessage {
	return protocol.ConfigMessage{Type: protocol.TypeConfig, Config: server.opts.Store.Snapshot()}
}

// handleClientMessage answers one message from a deck. Replies are best effort: a deck that
// cannot be written to is found out by the next read, which ends the connection.
func (server *Server) handleClientMessage(ctx context.Context, conn *websocket.Conn, raw json.RawMessage, logger *slog.Logger, remoteAddr string) {
	var envelope protocol.Envelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		server.sendError(ctx, conn, "malformed message")
		return
	}
	switch envelope.Type {
	case protocol.TypeHello:
		var hello protocol.Hello
		_ = json.Unmarshal(raw, &hello)
		logger.Info("client connected", "name", hello.Name, "clientId", hello.ClientID)
	case protocol.TypePing:
		var ping protocol.Ping
		_ = json.Unmarshal(raw, &ping)
		_ = wsjson.Write(ctx, conn, protocol.Pong{Type: protocol.TypePong, SentAt: ping.SentAt})
	case protocol.TypePress:
		var press protocol.Press
		_ = json.Unmarshal(raw, &press)
		_ = wsjson.Write(ctx, conn, server.pressButton(ctx, press))
	case protocol.TypeRun:
		var run protocol.Run
		_ = json.Unmarshal(raw, &run)
		_ = wsjson.Write(ctx, conn, server.runAdHoc(ctx, run))
	case protocol.TypeRelease:
		// Older decks may still send it; hold-to-repeat now lives in the deck itself.
	case protocol.TypeCommand:
		var message protocol.CommandMessage
		if err := json.Unmarshal(raw, &message); err != nil {
			server.sendError(ctx, conn, "malformed command")
			return
		}
		_ = wsjson.Write(ctx, conn, server.applyCommand(ctx, message))
		server.applySettings()
	case protocol.TypeSync:
		_ = server.sendConfig(ctx, conn)
	case protocol.TypeLog:
		var line protocol.LogMessage
		_ = json.Unmarshal(raw, &line)
		server.appendDeckLog(line, remoteAddr)
	default:
		server.sendError(ctx, conn, fmt.Sprintf("unknown type %q", envelope.Type))
	}
}

func (server *Server) sendError(ctx context.Context, conn *websocket.Conn, message string) {
	_ = wsjson.Write(ctx, conn, protocol.ErrorMessage{Type: protocol.TypeError, Message: message})
}

// appendDeckLog adds a line a deck sent to the host log, tagged with where it came from.
func (server *Server) appendDeckLog(line protocol.LogMessage, remoteAddr string) {
	if server.opts.Logs == nil || line.Message == "" {
		return
	}
	server.opts.Logs.Append(logs.Entry{
		Level:   line.Level,
		Source:  logs.SourceDeck,
		Message: line.Message,
		Fields:  strings.TrimSpace("remote=" + remoteAddr + " " + line.Fields),
	})
}
