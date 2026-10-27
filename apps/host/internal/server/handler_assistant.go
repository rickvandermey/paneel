package server

import (
	"errors"
	"net/http"

	"github.com/paneel-nx/paneel/host/internal/assistant"
)

func (server *Server) handleAssistantStatus(w http.ResponseWriter, _ *http.Request) {
	if server.opts.Assistant == nil {
		writeJSON(w, assistant.Status{})
		return
	}
	writeJSON(w, server.opts.Assistant.Status())
}

// handleAssistant runs one conversation turn; the deck applies an accepted plan itself.
func (server *Server) handleAssistant(w http.ResponseWriter, r *http.Request) {
	if server.opts.Assistant == nil {
		http.Error(w, "assistant is not available", http.StatusNotFound)
		return
	}
	var request assistant.Request
	if err := decodeJSONBody(r, assistantBodyLimit, &request); err != nil {
		http.Error(w, "malformed request", http.StatusBadRequest)
		return
	}
	reply, err := server.opts.Assistant.Plan(r.Context(), request)
	if err != nil {
		status := http.StatusBadGateway
		if errors.Is(err, assistant.ErrNotConfigured) {
			status = http.StatusPreconditionFailed
		}
		http.Error(w, err.Error(), status)
		return
	}
	writeJSON(w, reply)
}
