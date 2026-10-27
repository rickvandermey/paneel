package server

import (
	"context"
	"errors"
	"io"
	"net/http"

	"github.com/paneel-nx/paneel/host/internal/apps"
	"github.com/paneel-nx/paneel/host/internal/assets"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

func (server *Server) handleApps(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), iconTimeout)
	defer cancel()
	list, err := apps.List(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []apps.App{}
	}
	writeJSON(w, list)
}

func (server *Server) handleGetAsset(w http.ResponseWriter, r *http.Request) {
	if server.opts.Assets == nil {
		http.NotFound(w, r)
		return
	}
	path, contentType, err := server.opts.Assets.Open(r.PathValue("hash"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", contentType)
	// Assets are addressed by their hash, so a cached copy can never go stale.
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, path)
}

func (server *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if server.opts.Assets == nil {
		http.Error(w, "assets disabled", http.StatusNotImplemented)
		return
	}
	// One byte over the limit is read on purpose, so the store can report "too large" itself.
	data, err := io.ReadAll(io.LimitReader(r.Body, assets.MaxSize+1))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	hash, err := server.opts.Assets.Put(data)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, assets.ErrTooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		http.Error(w, err.Error(), status)
		return
	}
	writeJSON(w, protocol.IconRef{Source: protocol.IconAsset, Hash: hash})
}

func (server *Server) handleResolveIcon(w http.ResponseWriter, r *http.Request) {
	if server.opts.Icons == nil {
		http.Error(w, "icons disabled", http.StatusNotImplemented)
		return
	}
	var action protocol.Action
	if err := decodeJSONBody(r, actionBodyLimit, &action); err != nil {
		http.Error(w, "expected an action", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), iconTimeout)
	defer cancel()
	icon, err := server.opts.Icons.ForAction(ctx, action)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, icon)
}

func (server *Server) handleLogo(w http.ResponseWriter, r *http.Request) {
	if server.opts.Icons == nil {
		http.Error(w, "icons disabled", http.StatusNotImplemented)
		return
	}
	var request struct {
		Slug  string `json:"slug"`
		Color string `json:"color"`
	}
	if err := decodeJSONBody(r, smallBodyLimit, &request); err != nil {
		http.Error(w, "expected slug and color", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), iconTimeout)
	defer cancel()
	icon, err := server.opts.Icons.Logo(ctx, request.Slug, request.Color)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, icon)
}
