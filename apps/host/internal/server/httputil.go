package server

import (
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
)

// Upper bounds for request bodies, so a misbehaving client cannot make the host allocate freely.
const (
	smallBodyLimit     = 4 << 10  // a few fields, such as a port or a logo slug
	actionBodyLimit    = 64 << 10 // one action, including a long text to type
	assistantBodyLimit = 1 << 20  // a whole conversation plus the page it may extend
)

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(value)
}

// decodeJSONBody reads at most limit bytes of the request body into target.
func decodeJSONBody(r *http.Request, limit int64, target any) error {
	return json.NewDecoder(io.LimitReader(r.Body, limit)).Decode(target)
}

// spaHandler serves static files and falls back to index.html for client-side routes.
func spaHandler(static fs.FS) http.Handler {
	fileServer := http.FileServerFS(static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			fileServer.ServeHTTP(w, r)
			return
		}
		if _, err := fs.Stat(static, path[1:]); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
