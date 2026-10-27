package logs

import "sync"

// Buffer holds the most recent entries in memory.
type Buffer struct {
	mu       sync.Mutex
	entries  []Entry
	capacity int
}

func NewBuffer(capacity int) *Buffer {
	if capacity <= 0 {
		capacity = DefaultCapacity
	}
	return &Buffer{capacity: capacity}
}

func (buffer *Buffer) Append(entry Entry) {
	buffer.mu.Lock()
	defer buffer.mu.Unlock()
	buffer.entries = append(buffer.entries, entry)
	if len(buffer.entries) > buffer.capacity {
		buffer.entries = buffer.entries[len(buffer.entries)-buffer.capacity:]
	}
}

// Entries returns the oldest first.
func (buffer *Buffer) Entries() []Entry {
	buffer.mu.Lock()
	defer buffer.mu.Unlock()
	return append([]Entry(nil), buffer.entries...)
}

func (buffer *Buffer) Clear() {
	buffer.mu.Lock()
	defer buffer.mu.Unlock()
	buffer.entries = nil
}
