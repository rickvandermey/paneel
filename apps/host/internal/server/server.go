// Package server exposes the deck protocol over WebSocket and serves assets and the web deck client.
//
// The files are split by concern: routes.go lists the endpoints, middleware.go the request
// wrappers, websocket.go the deck connection, press.go what happens on a key press, commands.go
// the config changes, deck_build.go the reload-on-upgrade watch, and handler_*.go the REST
// endpoints per area.
package server

import (
	"context"
	"errors"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/paneel-nx/paneel/host/internal/actions"
	"github.com/paneel-nx/paneel/host/internal/assets"
	"github.com/paneel-nx/paneel/host/internal/assistant"
	"github.com/paneel-nx/paneel/host/internal/config"
	"github.com/paneel-nx/paneel/host/internal/icons"
	"github.com/paneel-nx/paneel/host/internal/logs"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

const (
	// actionTimeout bounds one key press or ad-hoc run, so a hung app cannot block the deck.
	actionTimeout = 30 * time.Second
	// iconTimeout bounds icon lookups, which may hit the network for favicons and logos.
	iconTimeout = 15 * time.Second
	// broadcastTimeout bounds a message to all decks from outside a request, such as a reset.
	broadcastTimeout  = 2 * time.Second
	readHeaderTimeout = 10 * time.Second
)

type ConfigStore interface {
	Snapshot() protocol.Config
	Apply(protocol.Command) (protocol.Command, int64, error)
	FindButton(string) (protocol.Button, bool)
	Settings() protocol.Settings
	Reset(func() *config.File) error
}

// NetworkRequest is what a client may change about how the host is reached.
type NetworkRequest struct {
	Port        int  `json:"port"`
	RotateToken bool `json:"rotateToken"`
}

// NetworkInfo is returned right away so the requesting client can reconnect.
type NetworkInfo struct {
	Port  int    `json:"port"`
	Token string `json:"token"`
}

type Options struct {
	Port     int
	Token    string
	HostName string
	Store    ConfigStore
	Assets   *assets.Store
	Icons    *icons.Resolver
	Runner   *actions.Runner
	// Static serves the web deck client (the mobile Angular build) at "/". Optional.
	Static fs.FS
	Logger *slog.Logger
	// Logs is the buffer behind Logger, served to decks and extended with their own lines. Optional.
	Logs *logs.Handler
	// Assistant builds pages from a conversation. Optional.
	Assistant *assistant.Service
	// Network applies a port or token change; the host owns the listener, so it is a callback.
	Network func(NetworkRequest) (NetworkInfo, error)
}

type Server struct {
	opts       Options
	httpServer *http.Server
	listener   net.Listener

	deckBuild          string
	stopDeckBuildWatch context.CancelFunc

	mu          sync.Mutex
	token       string
	connections map[*websocket.Conn]string
	activeApp   *protocol.ActiveApp
	// toggled holds the ids of toggle buttons that are on; not persisted, a restart resets them.
	toggled map[string]bool
}

func New(opts Options) *Server {
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	if opts.HostName == "" {
		opts.HostName, _ = os.Hostname()
	}
	return &Server{
		opts:        opts,
		token:       opts.Token,
		connections: map[*websocket.Conn]string{},
		toggled:     map[string]bool{},
		deckBuild:   deckBuildID(opts.Static),
	}
}

// Start listens on all interfaces; port 0 picks a free port. Returns the bound port.
func (server *Server) Start() (int, error) {
	listener, err := net.Listen("tcp", ":"+strconv.Itoa(server.opts.Port))
	if err != nil {
		return 0, err
	}
	server.listener = listener
	server.httpServer = &http.Server{Handler: server.Handler(), ReadHeaderTimeout: readHeaderTimeout}
	go func() {
		err := server.httpServer.Serve(listener)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			server.opts.Logger.Error("http server stopped", "err", err)
		}
	}()
	server.watchDeckBuild()
	return listener.Addr().(*net.TCPAddr).Port, nil
}

func (server *Server) Shutdown(ctx context.Context) error {
	if server.stopDeckBuildWatch != nil {
		server.stopDeckBuildWatch()
	}
	if server.httpServer == nil {
		return nil
	}
	return server.httpServer.Shutdown(ctx)
}

// SetToken swaps the pairing token; existing connections stay until CloseClients is called.
func (server *Server) SetToken(token string) {
	server.mu.Lock()
	defer server.mu.Unlock()
	server.token = token
}

// SetActiveApp remembers the focused application for new decks and tells the connected ones.
func (server *Server) SetActiveApp(name, id string) {
	message := protocol.ActiveApp{Type: protocol.TypeActiveApp, Name: name, ID: id}
	server.mu.Lock()
	server.activeApp = &message
	server.mu.Unlock()
	server.broadcastInBackground(message)
}

// CloseClients drops every deck so it has to pair again with the current token and port.
func (server *Server) CloseClients(reason string) {
	for _, conn := range server.openConnections() {
		_ = conn.Close(websocket.StatusPolicyViolation, reason)
	}
}

func (server *Server) ClientCount() int {
	server.mu.Lock()
	defer server.mu.Unlock()
	return len(server.connections)
}

// Broadcast sends a message to every connected client.
func (server *Server) Broadcast(ctx context.Context, message any) {
	for _, conn := range server.openConnections() {
		if err := wsjson.Write(ctx, conn, message); err != nil {
			server.opts.Logger.Warn("broadcast failed", "err", err)
		}
	}
}

// broadcastInBackground is Broadcast for callers that have no request context of their own.
func (server *Server) broadcastInBackground(message any) {
	ctx, cancel := context.WithTimeout(context.Background(), broadcastTimeout)
	defer cancel()
	server.Broadcast(ctx, message)
}

// openConnections copies the connection list so the lock is not held while writing to sockets.
func (server *Server) openConnections() []*websocket.Conn {
	server.mu.Lock()
	defer server.mu.Unlock()
	conns := make([]*websocket.Conn, 0, len(server.connections))
	for conn := range server.connections {
		conns = append(conns, conn)
	}
	return conns
}
