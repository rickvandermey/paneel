package actions

import (
	"fmt"
	"strings"

	"github.com/go-vgo/robotgo"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// Modifier names accepted in the protocol, mapped to robotgo names.
var modifierNames = map[string]string{
	"cmd":     "cmd",
	"command": "cmd",
	"meta":    "cmd",
	"super":   "cmd",
	"win":     "cmd",
	"ctrl":    "ctrl",
	"control": "ctrl",
	"alt":     "alt",
	"option":  "alt",
	"shift":   "shift",
}

func hotkey(key string, modifiers []string) error {
	if key == "" {
		return fmt.Errorf("hotkey without key")
	}
	args := make([]any, 0, len(modifiers))
	for _, modifier := range modifiers {
		name, ok := modifierNames[strings.ToLower(modifier)]
		if !ok {
			return fmt.Errorf("unknown modifier %q", modifier)
		}
		args = append(args, name)
	}
	return robotgo.KeyTap(strings.ToLower(key), args...)
}

var mediaKeys = map[string]string{
	protocol.MediaPlayPause:      "audio_play",
	protocol.MediaNext:           "audio_next",
	protocol.MediaPrevious:       "audio_prev",
	protocol.MediaVolumeUp:       "audio_vol_up",
	protocol.MediaVolumeDown:     "audio_vol_down",
	protocol.MediaMute:           "audio_mute",
	protocol.MediaBrightnessUp:   "lights_mon_up",
	protocol.MediaBrightnessDown: "lights_mon_down",
}

func media(control string) error {
	key, ok := mediaKeys[control]
	if !ok {
		return fmt.Errorf("unknown media control %q", control)
	}
	return robotgo.KeyTap(key)
}

func typeText(text string) error {
	if text == "" {
		return nil
	}
	return robotgo.TypeStr(text)
}
