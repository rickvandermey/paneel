//go:build linux

package appcontrol

import (
	"context"
	"fmt"

	"github.com/godbus/dbus/v5"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

const (
	mprisPath      = "/org/mpris/MediaPlayer2"
	mprisInterface = "org.mpris.MediaPlayer2.Player"
)

// Spotify's Linux client implements MPRIS; Music does not exist on Linux.
var mprisNames = map[string]string{protocol.AppSpotify: "org.mpris.MediaPlayer2.spotify"}

func run(ctx context.Context, app, control, value string) error {
	name, ok := mprisNames[app]
	if !ok {
		return ErrNotSupported
	}
	conn, err := dbus.SessionBus()
	if err != nil {
		return fmt.Errorf("connecting to the session bus: %w", err)
	}
	player := conn.Object(name, mprisPath)
	switch control {
	case protocol.MediaPlayPause:
		return player.CallWithContext(ctx, mprisInterface+".PlayPause", 0).Err
	case protocol.MediaNext:
		return player.CallWithContext(ctx, mprisInterface+".Next", 0).Err
	case protocol.MediaPrevious:
		return player.CallWithContext(ctx, mprisInterface+".Previous", 0).Err
	case protocol.AppControlShuffle:
		on, err := desiredOnState(player, "Shuffle", value, func(current dbus.Variant) bool {
			enabled, _ := current.Value().(bool)
			return enabled
		})
		if err != nil {
			return err
		}
		return player.SetProperty(mprisInterface+".Shuffle", dbus.MakeVariant(on))
	case protocol.AppControlRepeat:
		on, err := desiredOnState(player, "LoopStatus", value, func(current dbus.Variant) bool {
			status, _ := current.Value().(string)
			return status != "None"
		})
		if err != nil {
			return err
		}
		status := "None"
		if on {
			status = "Playlist"
		}
		return player.SetProperty(mprisInterface+".LoopStatus", dbus.MakeVariant(status))
	}
	return fmt.Errorf("unknown control %q", control)
}

// desiredOnState turns on/off/toggle into the state to set; toggle reads the player's current
// state and flips it.
func desiredOnState(player dbus.BusObject, property, value string, isOn func(dbus.Variant) bool) (bool, error) {
	switch value {
	case protocol.AppValueOn:
		return true, nil
	case protocol.AppValueOff:
		return false, nil
	}
	current, err := player.GetProperty(mprisInterface + "." + property)
	if err != nil {
		return false, fmt.Errorf("reading %s: %w", property, err)
	}
	return !isOn(current), nil
}
