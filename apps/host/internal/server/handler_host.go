package server

import (
	"net/http"
	"runtime"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// handleInfo is the only unauthenticated endpoint: the deck uses it to see whether a host answers.
func (server *Server) handleInfo(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{
		"hostName": server.opts.HostName,
		"platform": runtime.GOOS,
		"version":  protocol.Version,
	})
}

// handleSession only exists to answer "is this token still valid"; a browser cannot see the
// status of a rejected WebSocket handshake, so the deck asks here before it gives up.
func (server *Server) handleSession(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (server *Server) handleNetwork(w http.ResponseWriter, r *http.Request) {
	if server.opts.Network == nil {
		http.Error(w, "network changes disabled", http.StatusNotImplemented)
		return
	}
	var request NetworkRequest
	if err := decodeJSONBody(r, smallBodyLimit, &request); err != nil {
		http.Error(w, "expected port or rotateToken", http.StatusBadRequest)
		return
	}
	info, err := server.opts.Network(request)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, info)
}
