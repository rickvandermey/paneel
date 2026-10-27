package server

import (
	"io"
	"net/http"

	"github.com/paneel-nx/paneel/host/internal/backup"
	"github.com/paneel-nx/paneel/host/internal/config"
)

// handleBackup downloads pages, settings and icons as one zip file.
func (server *Server) handleBackup(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="paneel-backup.zip"`)
	if err := backup.Write(w, server.opts.Store.Snapshot(), server.assetsDir()); err != nil {
		server.opts.Logger.Warn("backup failed", "err", err)
	}
}

// handleRestore replaces pages and settings with a backup; token and port stay as they are.
func (server *Server) handleRestore(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(io.LimitReader(r.Body, backup.MaxSize+1))
	if err != nil || len(data) > backup.MaxSize {
		http.Error(w, "backup too large", http.StatusRequestEntityTooLarge)
		return
	}
	cfg, err := backup.Read(data, server.assetsDir())
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	restored := func() *config.File { return &config.File{Config: cfg} }
	if err := server.opts.Store.Reset(restored); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	server.announceReplacedConfig()
	server.opts.Logger.Info("config restored from backup", "pages", len(cfg.Profiles))
	writeJSON(w, map[string]int{"pages": len(cfg.Profiles)})
}

// handleReset starts clean: default pages and settings, toggles off, every deck gets the config.
func (server *Server) handleReset(w http.ResponseWriter, _ *http.Request) {
	if err := server.opts.Store.Reset(config.Defaults); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	server.announceReplacedConfig()
	server.opts.Logger.Info("config reset to defaults")
	writeJSON(w, map[string]bool{"ok": true})
}

// announceReplacedConfig follows a reset or restore: the old toggle states belong to buttons
// that may no longer exist, and every deck must render the new config.
func (server *Server) announceReplacedConfig() {
	server.resetToggles()
	server.broadcastInBackground(server.configMessage())
	server.broadcastInBackground(server.buttonState())
}

// assetsDir is where icons live, or empty when the host runs without an asset store (tests).
func (server *Server) assetsDir() string {
	if server.opts.Assets == nil {
		return ""
	}
	return server.opts.Assets.Dir()
}
