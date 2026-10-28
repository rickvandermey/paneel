package logs

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"strings"
	"time"
)

// Options configures a Handler. Dir may be empty to skip the file; Stderr may be nil.
type Options struct {
	Dir      string
	Stderr   io.Writer
	Verbose  bool
	Capacity int
}

// Handler is a slog.Handler that fans out to the buffer, the file and stderr.
type Handler struct {
	buffer *Buffer
	file   *rotatingFile
	stderr slog.Handler
	level  *slog.LevelVar
	attrs  []slog.Attr
}

func New(opts Options) (*Handler, error) {
	level := &slog.LevelVar{}
	handler := &Handler{buffer: NewBuffer(opts.Capacity), level: level}
	handler.SetVerbose(opts.Verbose)
	if opts.Stderr != nil {
		handler.stderr = slog.NewTextHandler(opts.Stderr, &slog.HandlerOptions{Level: level})
	}
	if opts.Dir != "" {
		file, err := openRotating(filepath.Join(opts.Dir, FileName))
		if err != nil {
			return nil, fmt.Errorf("opening log file: %w", err)
		}
		handler.file = file
	}
	return handler, nil
}

func (handler *Handler) Buffer() *Buffer { return handler.buffer }

// Close releases the log file; lines logged afterwards still reach the buffer and stderr.
func (handler *Handler) Close() error {
	if handler.file == nil {
		return nil
	}
	err := handler.file.Close()
	handler.file = nil
	return err
}

// SetVerbose switches between info and debug level for every output at once.
func (handler *Handler) SetVerbose(verbose bool) {
	if verbose {
		handler.level.Set(slog.LevelDebug)
	} else {
		handler.level.Set(slog.LevelInfo)
	}
}

func (handler *Handler) Verbose() bool { return handler.level.Level() <= slog.LevelDebug }

func (handler *Handler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= handler.level.Level()
}

func (handler *Handler) Handle(ctx context.Context, record slog.Record) error {
	var fields []string
	for _, attr := range handler.attrs {
		fields = append(fields, formatAttr(attr))
	}
	record.Attrs(func(attr slog.Attr) bool {
		fields = append(fields, formatAttr(attr))
		return true
	})
	entry := Entry{
		Time:    record.Time,
		Level:   strings.ToLower(record.Level.String()),
		Source:  SourceHost,
		Message: Redact(record.Message),
		Fields:  strings.Join(fields, " "),
	}
	handler.Append(entry)
	if handler.stderr != nil {
		return handler.stderr.Handle(ctx, record)
	}
	return nil
}

// Append stores an entry that did not come through slog, such as a line sent by a deck.
func (handler *Handler) Append(entry Entry) {
	if entry.Time.IsZero() {
		entry.Time = time.Now()
	}
	entry.Message = Redact(entry.Message)
	entry.Fields = Redact(entry.Fields)
	handler.buffer.Append(entry)
	if handler.file != nil {
		// A log line that cannot be written must not take the host down with it.
		_ = handler.file.Write(Line(entry) + "\n")
	}
}

func (handler *Handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	clone := *handler
	clone.attrs = append(append([]slog.Attr(nil), handler.attrs...), attrs...)
	if handler.stderr != nil {
		clone.stderr = handler.stderr.WithAttrs(attrs)
	}
	return &clone
}

// WithGroup is not used by the host; groups are flattened into plain attributes.
func (handler *Handler) WithGroup(string) slog.Handler { return handler }

func formatAttr(attr slog.Attr) string {
	value := attr.Value.Resolve()
	text := value.String()
	if value.Kind() == slog.KindString && strings.ContainsAny(text, " \"") {
		text = fmt.Sprintf("%q", text)
	}
	return attr.Key + "=" + Redact(text)
}
