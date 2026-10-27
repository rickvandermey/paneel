package host

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"syscall"
)

// Environment overrides shared by the desktop app and hostd, so a second host can run next to
// the real one during development (the Nx "sandbox" configurations set them).
const (
	EnvPort          = "PANEEL_PORT"
	EnvConfigDir     = "PANEEL_CONFIG_DIR"
	EnvFakeAssistant = "PANEEL_ASSISTANT_FAKE"
)

// FakeAssistantFromEnv reports whether PANEEL_ASSISTANT_FAKE=1 asks for the network-free assistant.
func FakeAssistantFromEnv() bool {
	return os.Getenv(EnvFakeAssistant) == "1"
}

// PortFromEnv returns PANEEL_PORT, or 0 when unset or not a number.
func PortFromEnv() int {
	port, err := strconv.Atoi(os.Getenv(EnvPort))
	if err != nil || port <= 0 {
		return 0
	}
	return port
}

// ConfigDirFromEnv returns PANEEL_CONFIG_DIR as an absolute path, or "" when unset. A relative
// value is resolved against the working directory, which is what a Taskfile or Nx target passes.
func ConfigDirFromEnv() string {
	return absolute(os.Getenv(EnvConfigDir))
}

func absolute(dir string) string {
	if dir == "" {
		return ""
	}
	if resolved, err := filepath.Abs(dir); err == nil {
		return resolved
	}
	return dir
}

// describeListenError turns "address already in use" into advice: the usual cause is a second
// Paneel on the same port, and the port cannot be changed silently because paired decks carry it.
func describeListenError(port int, err error) error {
	if errors.Is(err, syscall.EADDRINUSE) {
		return fmt.Errorf("port %d is already in use, probably by another Paneel; stop it, or run this one on another port with %s or the sandbox configuration (pnpm nx serve host --configuration=sandbox)", port, EnvPort)
	}
	return fmt.Errorf("listening on port %d: %w", port, err)
}
