package config

import (
	"os"
	"path/filepath"
)

const (
	appDirName     = "paneel"
	configFileName = "config.json"
	assetsDirName  = "assets"
)

// dirOverride replaces the per-user config folder, for tests and for running several hosts.
var dirOverride string

// SetDir points the host at another config folder; empty restores the per-user default.
func SetDir(dir string) { dirOverride = dir }

// Dir is the folder that holds the config, the assets, the log and the secrets.
func Dir() (string, error) {
	if dirOverride != "" {
		return dirOverride, nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, appDirName), nil
}

func Path() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, configFileName), nil
}

func AssetsDir() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, assetsDirName), nil
}
