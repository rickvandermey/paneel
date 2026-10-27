package logs

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

const (
	maxFileSize = 1 << 20
	// keptFiles is the live file plus the rotated ones: host.log, host.log.1 and host.log.2.
	keptFiles = 3
)

// rotatingFile appends to path and shifts it to .1, .2 when it grows past maxFileSize.
type rotatingFile struct {
	mu   sync.Mutex
	path string
	file *os.File
	size int64
}

func openRotating(path string) (*rotatingFile, error) {
	// The config folder may not exist yet on the very first start.
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	rotating := &rotatingFile{path: path}
	if err := rotating.open(); err != nil {
		return nil, err
	}
	return rotating, nil
}

func (rotating *rotatingFile) open() error {
	file, err := os.OpenFile(rotating.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return err
	}
	rotating.file = file
	rotating.size = info.Size()
	return nil
}

func (rotating *rotatingFile) Write(line string) error {
	rotating.mu.Lock()
	defer rotating.mu.Unlock()
	if rotating.size+int64(len(line)) > maxFileSize {
		if err := rotating.rotate(); err != nil {
			return err
		}
	}
	written, err := rotating.file.WriteString(line)
	rotating.size += int64(written)
	return err
}

// rotate drops the oldest file, shifts the others up by one and starts a fresh live file.
func (rotating *rotatingFile) rotate() error {
	_ = rotating.file.Close()
	_ = os.Remove(rotating.rotatedPath(keptFiles - 1))
	for index := keptFiles - 2; index >= 1; index-- {
		_ = os.Rename(rotating.rotatedPath(index), rotating.rotatedPath(index+1))
	}
	if err := os.Rename(rotating.path, rotating.rotatedPath(1)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return rotating.open()
}

func (rotating *rotatingFile) rotatedPath(index int) string {
	return fmt.Sprintf("%s.%d", rotating.path, index)
}
