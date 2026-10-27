package store

import (
	"encoding/json"
	"fmt"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// buttonListFor returns the list a button goes into: a folder when parentID is set, otherwise
// the top level of the page. Folders are created lazily, because a button only becomes a
// folder once something is put inside it.
func buttonListFor(cfg *protocol.Config, profileID, parentID string) (*[]protocol.Button, error) {
	if parentID != "" {
		list, position := findButtonInConfig(cfg, parentID)
		if list == nil {
			return nil, fmt.Errorf("%w: unknown parent button %q", ErrInvalid, parentID)
		}
		parent := &(*list)[position]
		if parent.Folder == nil {
			parent.Folder = []protocol.Button{}
		}
		return &parent.Folder, nil
	}
	position := profileIndex(cfg, profileID)
	if position < 0 {
		return nil, fmt.Errorf("%w: unknown profile %q", ErrInvalid, profileID)
	}
	return &cfg.Profiles[position].Buttons, nil
}

func profileIndex(cfg *protocol.Config, id string) int {
	for index, profile := range cfg.Profiles {
		if profile.ID == id {
			return index
		}
	}
	return -1
}

// findButtonInConfig searches every page; see findContainingList for what it returns.
func findButtonInConfig(cfg *protocol.Config, id string) (*[]protocol.Button, int) {
	for index := range cfg.Profiles {
		if list, position := findContainingList(&cfg.Profiles[index].Buttons, id); list != nil {
			return list, position
		}
	}
	return nil, -1
}

// findContainingList finds the list that directly holds the button with the given id, searching
// folders too, and the button's position in that list. The list is returned as a pointer so the
// caller can insert into or delete from it. A nil list means the button does not exist.
func findContainingList(list *[]protocol.Button, id string) (*[]protocol.Button, int) {
	for index := range *list {
		button := &(*list)[index]
		if button.ID == id {
			return list, index
		}
		if button.Folder != nil {
			if found, position := findContainingList(&button.Folder, id); found != nil {
				return found, position
			}
		}
	}
	return nil, -1
}

func containsButton(list []protocol.Button, id string) bool {
	for _, button := range list {
		if button.ID == id || containsButton(button.Folder, id) {
			return true
		}
	}
	return false
}

// clampIndex turns an optional, possibly out-of-range index into a valid insert position;
// no index means "at the end".
func clampIndex(index *int, length int) int {
	if index == nil || *index > length {
		return length
	}
	if *index < 0 {
		return 0
	}
	return *index
}

// cloneJSON deep-copies any protocol value through JSON, so nested slices (folders, actions)
// are not shared with the caller or with the stored config.
func cloneJSON[T any](value T) T {
	var result T
	data, _ := json.Marshal(value)
	_ = json.Unmarshal(data, &result)
	return result
}

// cloneConfig is cloneJSON for the whole config; a config always has a profile list, even an empty one.
func cloneConfig(cfg protocol.Config) protocol.Config {
	result := cloneJSON(cfg)
	if result.Profiles == nil {
		result.Profiles = []protocol.Profile{}
	}
	return result
}
