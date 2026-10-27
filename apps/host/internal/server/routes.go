package server

import "net/http"

// Handler builds the routes; exposed so tests can mount them on httptest.
func (server *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws", server.handleWebSocket)
	mux.HandleFunc("GET /api/info", server.handleInfo)
	mux.HandleFunc("GET /api/session", server.withToken(server.handleSession))
	mux.HandleFunc("GET /api/apps", server.withToken(server.handleApps))
	mux.HandleFunc("GET /assets/{hash}", server.withToken(server.handleGetAsset))
	mux.HandleFunc("POST /api/assets", server.withToken(server.handleUpload))
	mux.HandleFunc("POST /api/icons/resolve", server.withToken(server.handleResolveIcon))
	mux.HandleFunc("POST /api/icons/logo", server.withToken(server.handleLogo))
	mux.HandleFunc("POST /api/network", server.withToken(server.handleNetwork))
	mux.HandleFunc("POST /api/reset", server.withToken(server.handleReset))
	mux.HandleFunc("GET /api/backup", server.withToken(server.handleBackup))
	mux.HandleFunc("POST /api/restore", server.withToken(server.handleRestore))
	mux.HandleFunc("GET /api/assistant", server.withToken(server.handleAssistantStatus))
	mux.HandleFunc("POST /api/assistant", server.withToken(server.handleAssistant))
	mux.HandleFunc("GET /api/logs", server.withToken(server.handleLogs))
	mux.HandleFunc("POST /api/logs/clear", server.withToken(server.handleClearLogs))
	if server.opts.Static != nil {
		mux.Handle("/", spaHandler(server.opts.Static))
	}
	return withCORS(server.withAPILog(mux))
}
