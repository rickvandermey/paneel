package server

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"runtime"
	"time"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

const deckBuildInterval = 3 * time.Second

// deckBuildID fingerprints the served deck so a phone that stayed open across a host upgrade
// notices it runs stale code. Angular hashes its bundle names, so index.html changes per build.
func deckBuildID(static fs.FS) string {
	if static == nil {
		return ""
	}
	data, err := fs.ReadFile(static, "index.html")
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:6])
}

// watchDeckBuild re-reads the served deck every few seconds; a new build (a dev rebuild or an
// upgrade) is announced with a fresh welcome so open decks reload themselves.
func (server *Server) watchDeckBuild() {
	if server.opts.Static == nil {
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	server.stopDeckBuildWatch = cancel
	go func() {
		ticker := time.NewTicker(deckBuildInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if build, changed := server.updateDeckBuild(); changed {
					server.opts.Logger.Info("deck build changed, decks reload", "build", build)
					server.Broadcast(ctx, server.welcome())
				}
			}
		}
	}()
}

// updateDeckBuild stores the current fingerprint and reports whether it differs from the last one.
func (server *Server) updateDeckBuild() (string, bool) {
	current := deckBuildID(server.opts.Static)
	server.mu.Lock()
	defer server.mu.Unlock()
	changed := current != "" && current != server.deckBuild
	if changed {
		server.deckBuild = current
	}
	return current, changed
}

func (server *Server) currentDeckBuild() string {
	server.mu.Lock()
	defer server.mu.Unlock()
	return server.deckBuild
}

func (server *Server) welcome() protocol.Welcome {
	return protocol.Welcome{
		Type:      protocol.TypeWelcome,
		HostName:  server.opts.HostName,
		Platform:  runtime.GOOS,
		Version:   protocol.Version,
		DeckBuild: server.currentDeckBuild(),
	}
}
