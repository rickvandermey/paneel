package server

import (
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/paneel-nx/paneel/host/internal/logs"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

func (server *Server) handleLogs(w http.ResponseWriter, r *http.Request) {
	entries := []logs.Entry{}
	if server.opts.Logs != nil {
		entries = server.opts.Logs.Buffer().Entries()
	}
	header := server.logHeader()
	if r.URL.Query().Get("format") == "text" {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="paneel-log.txt"`)
		_, _ = w.Write([]byte(logs.Text(header, entries)))
		return
	}
	writeJSON(w, map[string]any{"header": header, "entries": entries})
}

func (server *Server) handleClearLogs(w http.ResponseWriter, _ *http.Request) {
	if server.opts.Logs != nil {
		server.opts.Logs.Buffer().Clear()
	}
	server.opts.Logger.Info("log cleared from a deck")
	w.WriteHeader(http.StatusNoContent)
}

// logHeader is what a bug report needs above the lines.
func (server *Server) logHeader() []logs.HeaderField {
	verbose := false
	if server.opts.Logs != nil {
		verbose = server.opts.Logs.Verbose()
	}
	return []logs.HeaderField{
		{Key: "app", Value: "Paneel"},
		{Key: "host", Value: server.opts.HostName},
		{Key: "platform", Value: runtime.GOOS + "/" + runtime.GOARCH},
		{Key: "protocol", Value: strconv.Itoa(protocol.Version)},
		{Key: "deckBuild", Value: server.currentDeckBuild()},
		{Key: "port", Value: strconv.Itoa(server.opts.Port)},
		{Key: "verbose", Value: strconv.FormatBool(verbose)},
		{Key: "exported", Value: time.Now().Format(time.RFC3339)},
	}
}
