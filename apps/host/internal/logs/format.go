package logs

import (
	"fmt"
	"strings"
)

// Line renders an entry the way the file and the text export show it.
func Line(entry Entry) string {
	line := fmt.Sprintf("%s %-5s %-4s %s", entry.Time.Format("2006-01-02 15:04:05.000"), entry.Level, entry.Source, entry.Message)
	if entry.Fields != "" {
		line += " " + entry.Fields
	}
	return line
}

// HeaderField is one line of the context block above an exported log, such as the host name.
type HeaderField struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Text renders the header fields and the entries as the plain-text export a bug report attaches.
func Text(header []HeaderField, entries []Entry) string {
	var builder strings.Builder
	for _, field := range header {
		fmt.Fprintf(&builder, "%s: %s\n", field.Key, field.Value)
	}
	builder.WriteString("\n")
	for _, entry := range entries {
		builder.WriteString(Line(entry))
		builder.WriteString("\n")
	}
	return builder.String()
}
