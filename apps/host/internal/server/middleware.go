package server

import (
	"net/http"
	"strings"
	"time"
)

// withToken rejects requests that do not carry the pairing token as a query value or bearer header.
func (server *Server) withToken(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !server.authorized(r) {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (server *Server) authorized(r *http.Request) bool {
	server.mu.Lock()
	token := server.token
	server.mu.Unlock()
	if token == "" {
		return true
	}
	if r.URL.Query().Get("token") == token {
		return true
	}
	return strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ") == token
}

// withAPILog writes one line per API call: debug when it went well, warn when it did not, so a
// failing icon resolve or restore shows up in a bug report without logging in every handler.
func (server *Server) withAPILog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Fetching the log itself would only add noise to it.
		if !strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/api/logs" {
			next.ServeHTTP(w, r)
			return
		}
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		started := time.Now()
		next.ServeHTTP(recorder, r)
		attrs := []any{
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"took", time.Since(started).Round(time.Millisecond),
		}
		if recorder.status >= http.StatusBadRequest {
			server.opts.Logger.Warn("api", attrs...)
		} else {
			server.opts.Logger.Debug("api", attrs...)
		}
	})
}

// statusRecorder remembers the status code a handler wrote, which http.ResponseWriter does not expose.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (recorder *statusRecorder) WriteHeader(status int) {
	recorder.status = status
	recorder.ResponseWriter.WriteHeader(status)
}

// Unwrap lets http.ResponseController reach the real writer (needed for websocket hijacking).
func (recorder *statusRecorder) Unwrap() http.ResponseWriter { return recorder.ResponseWriter }

// withCORS lets the desktop webview (wails://) and a packaged mobile app (capacitor://) call the
// API; the bearer token stays the real gate, so any origin may try.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
