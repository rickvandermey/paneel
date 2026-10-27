// Package logs keeps the host log where a user can get at it: a ring buffer the deck can show,
// a rotating file next to the config, and the usual stderr. It never stores the pairing token or
// the text an action types; callers keep those out, and Redact catches a token in a URL anyway.
//
// buffer.go is the ring buffer, handler.go the slog handler that fans out to buffer, file and
// stderr, format.go the text rendering and rotating_file.go the file on disk.
package logs

import (
	"regexp"
	"time"
)

// Entry is one log line as the deck receives it.
type Entry struct {
	Time    time.Time `json:"time"`
	Level   string    `json:"level"`
	Source  string    `json:"source"`
	Message string    `json:"message"`
	Fields  string    `json:"fields,omitempty"`
}

const (
	SourceHost = "host"
	SourceDeck = "deck"

	DefaultCapacity = 1000
	FileName        = "host.log"
)

var tokenPattern = regexp.MustCompile(`(?i)(token=)[^&\s"']+`)

// Redact hides a pairing token that slipped into a URL or query string.
func Redact(value string) string {
	return tokenPattern.ReplaceAllString(value, "${1}***")
}
