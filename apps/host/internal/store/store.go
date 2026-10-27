// Package store holds the configuration in memory, applies commands and persists each change.
//
// store.go owns the locking and persistence; commands.go applies one command to a config,
// validate.go checks what a command may contain, patch.go merges JSON patches and
// button_tree.go walks pages and folders.
package store

import (
	"errors"
	"fmt"
	"sync"

	"github.com/paneel-nx/paneel/host/internal/config"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// ErrInvalid marks commands rejected by validation; the client gets the message as-is.
var ErrInvalid = errors.New("invalid command")

type Store struct {
	mu   sync.RWMutex
	file *config.File
	save func(*config.File) error
}

func New(file *config.File, save func(*config.File) error) *Store {
	if save == nil {
		save = func(*config.File) error { return nil }
	}
	return &Store{file: file, save: save}
}

func (store *Store) Revision() int64 {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return store.file.Revision
}

func (store *Store) Token() string {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return store.file.Token
}

func (store *Store) Port() int {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return store.file.Port
}

func (store *Store) Settings() protocol.Settings {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return store.file.Settings
}

// Snapshot returns a deep copy of the client-facing config.
func (store *Store) Snapshot() protocol.Config {
	store.mu.RLock()
	defer store.mu.RUnlock()
	return cloneConfig(store.file.Config)
}

// FindButton looks through all pages and folders.
func (store *Store) FindButton(id string) (protocol.Button, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	list, position := findButtonInConfig(&store.file.Config, id)
	if list == nil {
		return protocol.Button{}, false
	}
	return cloneJSON((*list)[position]), true
}

// Reset replaces every page and setting with the given file (the defaults, or a restored
// backup) while keeping the token and port, so connected decks stay paired and simply receive
// the fresh config.
func (store *Store) Reset(freshFile func() *config.File) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	fresh := freshFile()
	previous := *store.file
	store.file.Config = fresh.Config
	store.file.Revision = 0
	if err := store.save(store.file); err != nil {
		*store.file = previous
		return fmt.Errorf("saving config: %w", err)
	}
	return nil
}

// SetNetwork persists a new port and token; the caller restarts the listener and drops clients.
func (store *Store) SetNetwork(port int, token string) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	previousPort, previousToken := store.file.Port, store.file.Token
	store.file.Port = port
	store.file.Token = token
	if err := store.save(store.file); err != nil {
		store.file.Port, store.file.Token = previousPort, previousToken
		return fmt.Errorf("saving config: %w", err)
	}
	return nil
}

// Apply validates and applies one command, persists, and returns the new revision.
// The command is returned with server-filled fields (such as generated IDs) so it can be broadcast.
func (store *Store) Apply(command protocol.Command) (protocol.Command, int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	// Work on a copy so a command that fails halfway leaves the stored config untouched.
	working := cloneConfig(store.file.Config)
	filled, err := applyCommand(&working, command)
	if err != nil {
		return command, store.file.Revision, err
	}
	working.Revision = store.file.Revision + 1
	previous := store.file.Config
	store.file.Config = working
	if err := store.save(store.file); err != nil {
		store.file.Config = previous
		return command, store.file.Revision, fmt.Errorf("saving config: %w", err)
	}
	return filled, working.Revision, nil
}
