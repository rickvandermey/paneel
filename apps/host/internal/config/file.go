// Package config loads and saves the host configuration as JSON on disk.
//
// file.go reads, parses and writes the file, paths.go says where it lives, defaults.go builds
// a first config and migrate.go upgrades older files.
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/paneel-nx/paneel/host/internal/atomicfile"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

const (
	// CurrentSchemaVersion is bumped whenever an older file needs a migration to be read.
	CurrentSchemaVersion = 2
	// schemaVersionWithPromptField is the first schema that stores a terminal prompt apart from
	// the command; files before it go through migrateV1ToV2.
	schemaVersionWithPromptField = 2
	// Only the user may read the config: it holds the pairing token.
	filePermissions = 0o600
)

// File is what is stored on disk: the client-facing config plus host-only secrets.
type File struct {
	protocol.Config
	Token string `json:"token"`
	Port  int    `json:"port"`
	// Migrated is set when the file was read in an older format and should be rewritten.
	Migrated bool `json:"-"`
}

func Load() (*File, error) {
	path, err := Path()
	if err != nil {
		return nil, err
	}
	return LoadFrom(path)
}

func LoadFrom(path string) (*File, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return Parse(data)
}

// Parse decodes a config file, migrating older schema versions.
func Parse(data []byte) (*File, error) {
	var probe struct {
		SchemaVersion int `json:"schemaVersion"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}
	// The spike wrote no schema version at all.
	if probe.SchemaVersion == 0 {
		return migrateFromSpike(data)
	}
	if probe.SchemaVersion > CurrentSchemaVersion {
		return nil, fmt.Errorf("config schema version %d is newer than supported %d", probe.SchemaVersion, CurrentSchemaVersion)
	}
	var file File
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, fmt.Errorf("parsing config: %w", err)
	}
	if file.SchemaVersion < schemaVersionWithPromptField {
		migrateV1ToV2(&file)
	}
	normalize(&file)
	return &file, nil
}

// Save writes the config atomically, so a crash mid-write cannot leave a broken file behind.
func Save(file *File) error {
	path, err := Path()
	if err != nil {
		return err
	}
	return SaveTo(path, file)
}

func SaveTo(path string, file *File) error {
	data, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return err
	}
	return atomicfile.Write(path, data, filePermissions)
}

// LoadOrCreate returns the stored config, or writes and returns a fresh default one.
func LoadOrCreate(defaults func() *File) (*File, error) {
	file, err := Load()
	if err == nil {
		if file.Migrated {
			if err := Save(file); err != nil {
				return nil, fmt.Errorf("rewriting migrated config: %w", err)
			}
			file.Migrated = false
		}
		return file, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	file = defaults()
	if err := Save(file); err != nil {
		return nil, err
	}
	return file, nil
}

// normalize fills in what older or hand-edited files may leave out, so the rest of the host
// never has to check for nil lists.
func normalize(file *File) {
	if file.Profiles == nil {
		file.Profiles = []protocol.Profile{}
	}
	for index := range file.Profiles {
		normalizeButtons(&file.Profiles[index].Buttons)
	}
	if file.Port == 0 {
		file.Port = DefaultPort
	}
}

func normalizeButtons(buttons *[]protocol.Button) {
	if *buttons == nil {
		*buttons = []protocol.Button{}
	}
	for index := range *buttons {
		button := &(*buttons)[index]
		if button.Actions == nil {
			button.Actions = []protocol.Action{}
		}
		if button.Color == "" {
			button.Color = DefaultColor
		}
		if button.Folder != nil {
			normalizeButtons(&button.Folder)
		}
	}
}
