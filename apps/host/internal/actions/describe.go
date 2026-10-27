package actions

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// Describe summarizes actions for the log: kinds with the detail that helps debugging (the key,
// the app, the command, the host of a URL) and never the text or prompt a user typed.
func Describe(actions []protocol.Action) string {
	parts := make([]string, 0, len(actions))
	for _, action := range actions {
		detail := describeDetail(action)
		if detail == "" {
			parts = append(parts, action.Kind)
		} else {
			parts = append(parts, action.Kind+"("+detail+")")
		}
	}
	return strings.Join(parts, ", ")
}

func describeDetail(action protocol.Action) string {
	switch action.Kind {
	case protocol.ActionHotkey:
		return strings.Join(append(append([]string{}, action.Modifiers...), action.Key), "+")
	case protocol.ActionLaunch:
		return action.Target
	case protocol.ActionURL:
		parsed, err := url.Parse(action.URL)
		if err != nil {
			return ""
		}
		return parsed.Host
	case protocol.ActionShell, protocol.ActionTerminal:
		return action.Command
	case protocol.ActionMedia:
		return action.Control
	case protocol.ActionAppControl:
		return action.App + " " + action.Control
	case protocol.ActionDelay:
		return fmt.Sprintf("%dms", action.Millis)
	case protocol.ActionSwitchProfile:
		return action.ProfileID
	default:
		return ""
	}
}
