package config

import (
	"crypto/rand"
	"encoding/hex"
	"runtime"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

const (
	DefaultPort  = 48220
	DefaultColor = "#374151"

	tokenBytes = 16
	idBytes    = 8
)

// NewToken makes a pairing token: long enough that it cannot be guessed over the network.
func NewToken() string {
	return randomHex(tokenBytes)
}

// NewID makes an id for a page or button; shorter, because it only has to be unique in one config.
func NewID() string {
	return randomHex(idBytes)
}

func randomHex(byteCount int) string {
	buf := make([]byte, byteCount)
	// crypto/rand only fails when the OS has no entropy source at all, which no supported
	// platform does; an empty token would still be rejected by the store.
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

// Defaults builds the first configuration: one profile with sample buttons.
func Defaults() *File {
	return &File{
		Config: protocol.Config{
			SchemaVersion: CurrentSchemaVersion,
			Revision:      0,
			Settings:      protocol.Settings{},
			Profiles:      []protocol.Profile{sampleProfile()},
		},
		Token: NewToken(),
		Port:  DefaultPort,
	}
}

func sampleProfile() protocol.Profile {
	modifier := "ctrl"
	calculator := "Calculator"
	if runtime.GOOS == "darwin" {
		modifier = "cmd"
	}
	if runtime.GOOS == "windows" {
		calculator = "calc.exe"
	}
	phosphor := func(name string) *protocol.IconRef {
		return &protocol.IconRef{Source: protocol.IconPhosphor, Name: name}
	}
	return protocol.Profile{
		ID:   "default",
		Name: "Start",
		Icon: phosphor("squares-four"),
		Buttons: []protocol.Button{
			{ID: "btn-copy", Label: "Copy", ShowLabel: true, Color: "#2563eb", Icon: phosphor("copy"),
				Actions: []protocol.Action{{Kind: protocol.ActionHotkey, Key: "c", Modifiers: []string{modifier}}}},
			{ID: "btn-paste", Label: "Paste", ShowLabel: true, Color: "#2563eb", Icon: phosphor("clipboard-text"),
				Actions: []protocol.Action{{Kind: protocol.ActionHotkey, Key: "v", Modifiers: []string{modifier}}}},
			{ID: "btn-calc", Label: "Calculator", ShowLabel: true, Color: "#16a34a",
				Actions: []protocol.Action{{Kind: protocol.ActionLaunch, Target: calculator}}},
			{ID: "btn-url", Label: "GitHub", ShowLabel: true, Color: "#111827",
				Actions: []protocol.Action{{Kind: protocol.ActionURL, URL: "https://github.com"}}},
			{ID: "btn-play", Label: "Play", ShowLabel: true, Color: "#9333ea", Icon: phosphor("play-pause"),
				Actions: []protocol.Action{{Kind: protocol.ActionMedia, Control: protocol.MediaPlayPause}}},
			{ID: "btn-claude", Label: "Claude", ShowLabel: true, Color: "#d97706", Icon: phosphor("sparkle"),
				Actions: []protocol.Action{{Kind: protocol.ActionTerminal, Command: "claude"}}},
		},
	}
}
