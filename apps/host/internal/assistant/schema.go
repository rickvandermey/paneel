package assistant

import "github.com/paneel-nx/paneel/host/internal/protocol"

// ReplySchema is the JSON schema every provider is held to. Every property is required and
// nullable where it may not apply, which is what strict modes on both APIs expect; the host
// validates the content afterwards anyway, because local models do not enforce schemas.
func ReplySchema() map[string]any {
	nullableString := map[string]any{"type": []string{"string", "null"}}
	stringList := map[string]any{"type": "array", "items": map[string]any{"type": "string"}}
	action := map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"kind", "key", "modifiers", "target", "url", "command", "prompt", "text", "control"},
		"properties": map[string]any{
			"kind":      map[string]any{"type": "string", "enum": allowedActionKindList()},
			"key":       nullableString,
			"modifiers": map[string]any{"type": []string{"array", "null"}, "items": map[string]any{"type": "string", "enum": []string{"cmd", "ctrl", "alt", "shift"}}},
			"target":    nullableString,
			"url":       nullableString,
			"command":   nullableString,
			"prompt":    nullableString,
			"text":      nullableString,
			"control":   map[string]any{"type": []string{"string", "null"}, "enum": append(mediaControls(), nil)},
		},
	}
	button := map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"preset", "label", "icon", "actions"},
		"properties": map[string]any{
			"preset":  nullableString,
			"label":   nullableString,
			"icon":    nullableString,
			"actions": map[string]any{"type": []string{"array", "null"}, "items": action},
		},
	}
	plan := map[string]any{
		"type":                 []string{"object", "null"},
		"additionalProperties": false,
		"required":             []string{"target", "name", "icon", "palette", "apps", "buttons"},
		"properties": map[string]any{
			"target":  map[string]any{"type": "string", "enum": []string{TargetNewPage, TargetCurrentPage}},
			"name":    map[string]any{"type": "string"},
			"icon":    nullableString,
			"palette": nullableString,
			"apps":    stringList,
			"buttons": map[string]any{"type": "array", "items": button},
		},
	}
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"kind", "message", "plan"},
		"properties": map[string]any{
			"kind":    map[string]any{"type": "string", "enum": []string{KindQuestion, KindPlan, KindDecline}},
			"message": map[string]any{"type": "string"},
			"plan":    plan,
		},
	}
}

// allowedActionKindList is allowedActionKinds in a fixed order, so the schema is stable between calls.
func allowedActionKindList() []string {
	return []string{
		protocol.ActionHotkey, protocol.ActionText, protocol.ActionLaunch, protocol.ActionURL,
		protocol.ActionShell, protocol.ActionTerminal, protocol.ActionMedia,
	}
}

// mediaControls lists what a media action may carry, taken from the protocol so the model
// cannot invent one.
func mediaControls() []any {
	return []any{
		protocol.MediaPlayPause, protocol.MediaNext, protocol.MediaPrevious,
		protocol.MediaVolumeUp, protocol.MediaVolumeDown, protocol.MediaMute,
		protocol.MediaBrightnessUp, protocol.MediaBrightnessDown,
	}
}
