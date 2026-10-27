//go:build windows

package activeapp

import (
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32                       = syscall.NewLazyDLL("user32.dll")
	procGetForegroundWindow      = user32.NewProc("GetForegroundWindow")
	procGetWindowThreadProcessID = user32.NewProc("GetWindowThreadProcessId")
	procGetWindowTextW           = user32.NewProc("GetWindowTextW")
)

// Current reads the foreground window's title and the executable that owns it.
func Current() (App, error) {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd == 0 {
		return App{}, nil
	}
	var pid uint32
	_, _, _ = procGetWindowThreadProcessID.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	title := make([]uint16, 512)
	_, _, _ = procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&title[0])), uintptr(len(title)))
	app := App{Name: syscall.UTF16ToString(title)}
	if pid != 0 {
		handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
		if err == nil {
			defer func() { _ = windows.CloseHandle(handle) }()
			buffer := make([]uint16, windows.MAX_PATH)
			size := uint32(len(buffer))
			if err := windows.QueryFullProcessImageName(handle, 0, &buffer[0], &size); err == nil {
				exe := filepath.Base(syscall.UTF16ToString(buffer[:size]))
				app.ID = exe
				// The window title changes with every document; the executable is the stable name.
				app.Name = strings.TrimSuffix(exe, filepath.Ext(exe))
			}
		}
	}
	return app, nil
}
