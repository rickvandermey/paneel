package store

import (
	"fmt"
	"slices"

	"github.com/paneel-nx/paneel/host/internal/config"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// applyCommand changes cfg in place. Every handler returns the command it applied, because
// create commands fill in generated ids and the final index for the broadcast to other decks.
func applyCommand(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	switch command.Type {
	case protocol.CmdProfileCreate:
		return applyProfileCreate(cfg, command)
	case protocol.CmdProfileUpdate:
		return applyProfileUpdate(cfg, command)
	case protocol.CmdProfileDelete:
		return applyProfileDelete(cfg, command)
	case protocol.CmdProfileMove:
		return applyProfileMove(cfg, command)
	case protocol.CmdButtonCreate:
		return applyButtonCreate(cfg, command)
	case protocol.CmdButtonUpdate:
		return applyButtonUpdate(cfg, command)
	case protocol.CmdButtonDelete:
		return applyButtonDelete(cfg, command)
	case protocol.CmdButtonMove:
		return applyButtonMove(cfg, command)
	case protocol.CmdSettingsUpdate:
		return applySettingsUpdate(cfg, command)
	default:
		return command, fmt.Errorf("%w: unknown type %q", ErrInvalid, command.Type)
	}
}

func applyProfileCreate(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	if command.Profile == nil {
		return command, fmt.Errorf("%w: profile is required", ErrInvalid)
	}
	profile := cloneJSON(*command.Profile)
	if profile.ID == "" {
		profile.ID = config.NewID()
	}
	if profile.Buttons == nil {
		profile.Buttons = []protocol.Button{}
	}
	if err := validateProfile(cfg, profile, ""); err != nil {
		return command, err
	}
	index := clampIndex(command.Index, len(cfg.Profiles))
	cfg.Profiles = slices.Insert(cfg.Profiles, index, profile)
	command.Profile = &profile
	command.Index = &index
	return command, nil
}

func applyProfileUpdate(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	position := profileIndex(cfg, command.ID)
	if position < 0 {
		return command, fmt.Errorf("%w: unknown profile %q", ErrInvalid, command.ID)
	}
	patched, err := patchProfile(cfg.Profiles[position], command.Patch)
	if err != nil {
		return command, err
	}
	if err := validateProfile(cfg, patched, patched.ID); err != nil {
		return command, err
	}
	cfg.Profiles[position] = patched
	return command, nil
}

func applyProfileDelete(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	position := profileIndex(cfg, command.ID)
	if position < 0 {
		return command, fmt.Errorf("%w: unknown profile %q", ErrInvalid, command.ID)
	}
	// Deleting the last page is allowed; decks then show their welcome screen.
	cfg.Profiles = slices.Delete(cfg.Profiles, position, position+1)
	return command, nil
}

func applyProfileMove(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	position := profileIndex(cfg, command.ID)
	if position < 0 {
		return command, fmt.Errorf("%w: unknown profile %q", ErrInvalid, command.ID)
	}
	if command.Index == nil {
		return command, fmt.Errorf("%w: index is required", ErrInvalid)
	}
	profile := cfg.Profiles[position]
	cfg.Profiles = slices.Delete(cfg.Profiles, position, position+1)
	index := clampIndex(command.Index, len(cfg.Profiles))
	cfg.Profiles = slices.Insert(cfg.Profiles, index, profile)
	return command, nil
}

func applyButtonCreate(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	if command.Button == nil {
		return command, fmt.Errorf("%w: button is required", ErrInvalid)
	}
	button := cloneJSON(*command.Button)
	if button.ID == "" {
		button.ID = config.NewID()
	}
	if err := validateButton(cfg, button, ""); err != nil {
		return command, err
	}
	list, err := buttonListFor(cfg, command.ProfileID, command.ParentID)
	if err != nil {
		return command, err
	}
	index := clampIndex(command.Index, len(*list))
	*list = slices.Insert(*list, index, button)
	command.Button = &button
	command.Index = &index
	return command, nil
}

func applyButtonUpdate(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	list, position := findButtonInConfig(cfg, command.ID)
	if list == nil {
		return command, fmt.Errorf("%w: unknown button %q", ErrInvalid, command.ID)
	}
	patched, err := patchButton((*list)[position], command.Patch)
	if err != nil {
		return command, err
	}
	if err := validateButton(cfg, patched, patched.ID); err != nil {
		return command, err
	}
	(*list)[position] = patched
	return command, nil
}

func applyButtonDelete(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	list, position := findButtonInConfig(cfg, command.ID)
	if list == nil {
		return command, fmt.Errorf("%w: unknown button %q", ErrInvalid, command.ID)
	}
	*list = slices.Delete(*list, position, position+1)
	return command, nil
}

func applyButtonMove(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	source, position := findButtonInConfig(cfg, command.ID)
	if source == nil {
		return command, fmt.Errorf("%w: unknown button %q", ErrInvalid, command.ID)
	}
	if command.Index == nil {
		return command, fmt.Errorf("%w: index is required", ErrInvalid)
	}
	button := (*source)[position]
	if command.ParentID != "" && (command.ParentID == command.ID || containsButton(button.Folder, command.ParentID)) {
		return command, fmt.Errorf("%w: a folder cannot be moved into itself", ErrInvalid)
	}
	*source = slices.Delete(*source, position, position+1)
	// The destination is looked up after the removal, because removing the button may have
	// shifted the list it is about to join.
	destination, err := buttonListFor(cfg, command.ProfileID, command.ParentID)
	if err != nil {
		return command, err
	}
	index := clampIndex(command.Index, len(*destination))
	*destination = slices.Insert(*destination, index, button)
	return command, nil
}

func applySettingsUpdate(cfg *protocol.Config, command protocol.Command) (protocol.Command, error) {
	patched, err := patchInto(cfg.Settings, command.Patch, nil)
	if err != nil {
		return command, err
	}
	if err := validateSettings(patched); err != nil {
		return command, err
	}
	cfg.Settings = patched
	return command, nil
}
