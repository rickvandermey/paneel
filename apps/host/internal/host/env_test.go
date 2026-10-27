package host

import (
	"errors"
	"net"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func TestEnvOverrides(t *testing.T) {
	t.Setenv(EnvPort, "")
	t.Setenv(EnvConfigDir, "")
	if PortFromEnv() != 0 || ConfigDirFromEnv() != "" {
		t.Fatal("unset variables mean no override")
	}
	t.Setenv(EnvPort, "48221")
	t.Setenv(EnvConfigDir, "tmp/sandbox")
	if PortFromEnv() != 48221 {
		t.Fatalf("port = %d", PortFromEnv())
	}
	if dir := ConfigDirFromEnv(); !filepath.IsAbs(dir) || !strings.HasSuffix(dir, filepath.Join("tmp", "sandbox")) {
		t.Fatalf("config dir should be absolute, got %q", dir)
	}
	t.Setenv(EnvPort, "nope")
	if PortFromEnv() != 0 {
		t.Fatal("a non-number is ignored")
	}
}

func TestDescribeListenErrorExplainsABusyPort(t *testing.T) {
	busy := &net.OpError{Op: "listen", Err: syscall.EADDRINUSE}
	err := describeListenError(48220, busy)
	if !strings.Contains(err.Error(), "already in use") || !strings.Contains(err.Error(), "sandbox") {
		t.Fatalf("message = %q", err)
	}
	other := describeListenError(48220, errors.New("boom"))
	if !strings.Contains(other.Error(), "listening on port 48220: boom") {
		t.Fatalf("message = %q", other)
	}
}
