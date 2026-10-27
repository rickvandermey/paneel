package appcontrol

import (
	"fmt"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// scriptableAppNames are the names AppleScript addresses the players by.
var scriptableAppNames = map[string]string{protocol.AppSpotify: "Spotify", protocol.AppMusic: "Music"}

// appleScript builds the script for one control. Spotify and Music expose shuffle and repeat
// differently: Spotify has two booleans, Music has a boolean and an off/one/all enum.
func appleScript(app, control, value string) (string, error) {
	name, ok := scriptableAppNames[app]
	if !ok {
		return "", fmt.Errorf("unknown app %q", app)
	}
	switch control {
	case protocol.MediaPlayPause:
		return fmt.Sprintf("tell application %q to playpause", name), nil
	case protocol.MediaNext:
		return fmt.Sprintf("tell application %q to next track", name), nil
	case protocol.MediaPrevious:
		return fmt.Sprintf("tell application %q to previous track", name), nil
	case protocol.AppControlShuffle:
		property := "shuffling"
		if app == protocol.AppMusic {
			property = "shuffle enabled"
		}
		return booleanScript(name, property, value), nil
	case protocol.AppControlRepeat:
		if app == protocol.AppMusic {
			return enumScript(name, "song repeat", "all", "off", value), nil
		}
		return booleanScript(name, "repeating", value), nil
	}
	return "", fmt.Errorf("unknown control %q", control)
}

func booleanScript(app, property, value string) string {
	switch value {
	case protocol.AppValueOn:
		return fmt.Sprintf("tell application %q to set %s to true", app, property)
	case protocol.AppValueOff:
		return fmt.Sprintf("tell application %q to set %s to false", app, property)
	}
	return fmt.Sprintf(`tell application %q
	if %s then
		set %s to false
	else
		set %s to true
	end if
end tell`, app, property, property, property)
}

func enumScript(app, property, on, off, value string) string {
	switch value {
	case protocol.AppValueOn:
		return fmt.Sprintf("tell application %q to set %s to %s", app, property, on)
	case protocol.AppValueOff:
		return fmt.Sprintf("tell application %q to set %s to %s", app, property, off)
	}
	return fmt.Sprintf(`tell application %q
	if %s is %s then
		set %s to %s
	else
		set %s to %s
	end if
end tell`, app, property, off, property, on, property, off)
}
