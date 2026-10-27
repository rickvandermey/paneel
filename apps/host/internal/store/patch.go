package store

import (
	"encoding/json"
	"fmt"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// patchButton applies a JSON merge patch on the top-level fields; id and folder are not patchable.
func patchButton(button protocol.Button, patch json.RawMessage) (protocol.Button, error) {
	return patchInto(button, patch, map[string]bool{"id": true, "folder": true})
}

// patchProfile applies a JSON merge patch on the top-level fields; id and buttons are not patchable.
func patchProfile(profile protocol.Profile, patch json.RawMessage) (protocol.Profile, error) {
	return patchInto(profile, patch, map[string]bool{"id": true, "buttons": true})
}

// patchInto merges a JSON object into value the way JSON merge patch does: fields in the patch
// replace the field, a null removes it, everything else stays. Going through JSON keeps the
// struct tags (omitempty, renamed fields) as the single source of truth for what a field is called.
func patchInto[T any](value T, patch json.RawMessage, forbidden map[string]bool) (T, error) {
	var result T
	if len(patch) == 0 {
		return value, fmt.Errorf("%w: patch is required", ErrInvalid)
	}
	var patchFields map[string]json.RawMessage
	if err := json.Unmarshal(patch, &patchFields); err != nil {
		return result, fmt.Errorf("%w: patch must be an object", ErrInvalid)
	}
	for key := range patchFields {
		if forbidden[key] {
			return result, fmt.Errorf("%w: field %q cannot be patched", ErrInvalid, key)
		}
	}
	currentJSON, err := json.Marshal(value)
	if err != nil {
		return result, err
	}
	var currentFields map[string]json.RawMessage
	if err := json.Unmarshal(currentJSON, &currentFields); err != nil {
		return result, err
	}
	for key, raw := range patchFields {
		if string(raw) == "null" {
			delete(currentFields, key)
			continue
		}
		currentFields[key] = raw
	}
	mergedJSON, err := json.Marshal(currentFields)
	if err != nil {
		return result, err
	}
	if err := json.Unmarshal(mergedJSON, &result); err != nil {
		return result, fmt.Errorf("%w: %v", ErrInvalid, err)
	}
	return result, nil
}
