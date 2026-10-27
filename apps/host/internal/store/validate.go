package store

import (
	"fmt"
	"regexp"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

var hexColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

var knownActionKinds = map[string]bool{
	protocol.ActionHotkey: true, protocol.ActionText: true, protocol.ActionLaunch: true,
	protocol.ActionURL: true, protocol.ActionShell: true, protocol.ActionTerminal: true,
	protocol.ActionDelay: true, protocol.ActionMedia: true, protocol.ActionSwitchProfile: true,
	protocol.ActionAppControl: true,
}

var knownIconSources = map[string]bool{
	protocol.IconAsset: true, protocol.IconPhosphor: true, protocol.IconSimpleIcons: true, protocol.IconEmoji: true,
}

var knownAssistantProviders = map[string]bool{"": true, "anthropic": true, "openai": true}

var knownTerminalWindows = map[string]bool{
	"": true, protocol.TerminalWindowReuse: true, protocol.TerminalWindowNew: true, protocol.TerminalWindowEditor: true,
}

func isHexColor(value string) bool {
	return hexColorPattern.MatchString(value)
}

// isOptionalHexColor accepts an empty value, for colors that fall back to a default.
func isOptionalHexColor(value string) bool {
	return value == "" || isHexColor(value)
}

func validateSettings(settings protocol.Settings) error {
	if !knownAssistantProviders[settings.Assistant.Provider] {
		return fmt.Errorf("%w: unknown assistant provider %q", ErrInvalid, settings.Assistant.Provider)
	}
	seenThemeIDs := map[string]bool{}
	for _, theme := range settings.CustomThemes {
		if err := validateCustomTheme(theme, seenThemeIDs); err != nil {
			return err
		}
	}
	seenPaletteIDs := map[string]bool{}
	for _, palette := range settings.CustomPalettes {
		if err := validateCustomPalette(palette, seenPaletteIDs); err != nil {
			return err
		}
	}
	return nil
}

func validateCustomTheme(theme protocol.CustomTheme, seenIDs map[string]bool) error {
	if theme.ID == "" || theme.Name == "" {
		return fmt.Errorf("%w: custom theme needs an id and a name", ErrInvalid)
	}
	if seenIDs[theme.ID] {
		return fmt.Errorf("%w: duplicate custom theme id %q", ErrInvalid, theme.ID)
	}
	seenIDs[theme.ID] = true
	for _, color := range []string{theme.Bg, theme.Surface, theme.Text, theme.Accent} {
		if !isHexColor(color) {
			return fmt.Errorf("%w: custom theme %q has an invalid color %q", ErrInvalid, theme.Name, color)
		}
	}
	if !isOptionalHexColor(theme.Light) {
		return fmt.Errorf("%w: custom theme %q has an invalid light color", ErrInvalid, theme.Name)
	}
	return nil
}

func validateCustomPalette(palette protocol.CustomPalette, seenIDs map[string]bool) error {
	if palette.ID == "" || palette.Name == "" {
		return fmt.Errorf("%w: custom palette needs an id and a name", ErrInvalid)
	}
	if seenIDs[palette.ID] {
		return fmt.Errorf("%w: duplicate custom palette id %q", ErrInvalid, palette.ID)
	}
	seenIDs[palette.ID] = true
	if len(palette.Colors) == 0 {
		return fmt.Errorf("%w: custom palette %q needs at least one color", ErrInvalid, palette.Name)
	}
	for _, color := range palette.Colors {
		if !isHexColor(color) {
			return fmt.Errorf("%w: custom palette %q has an invalid color %q", ErrInvalid, palette.Name, color)
		}
	}
	if !isOptionalHexColor(palette.Tint) {
		return fmt.Errorf("%w: custom palette %q has an invalid tint", ErrInvalid, palette.Name)
	}
	return nil
}

// validateProfile checks a page; existingID is the page's own id on an update, so it does not
// count as a duplicate of itself.
func validateProfile(cfg *protocol.Config, profile protocol.Profile, existingID string) error {
	if profile.Name == "" {
		return fmt.Errorf("%w: profile name is required", ErrInvalid)
	}
	for _, other := range cfg.Profiles {
		if other.ID == profile.ID && other.ID != existingID {
			return fmt.Errorf("%w: profile id %q already exists", ErrInvalid, profile.ID)
		}
	}
	if err := validateIcon(profile.Icon); err != nil {
		return err
	}
	for _, button := range profile.Buttons {
		if err := validateButton(cfg, button, button.ID); err != nil {
			return err
		}
	}
	return nil
}

// validateButton checks a button and its folder contents; existingID works like in validateProfile.
func validateButton(cfg *protocol.Config, button protocol.Button, existingID string) error {
	if button.ID == "" {
		return fmt.Errorf("%w: button id is required", ErrInvalid)
	}
	if button.ID != existingID {
		if list, _ := findButtonInConfig(cfg, button.ID); list != nil {
			return fmt.Errorf("%w: button id %q already exists", ErrInvalid, button.ID)
		}
	}
	if !isHexColor(button.Color) {
		return fmt.Errorf("%w: color must be a hex value like #2563eb", ErrInvalid)
	}
	if err := validateIcon(button.Icon); err != nil {
		return err
	}
	if err := validateActions(button.Actions); err != nil {
		return err
	}
	if button.Toggle != nil {
		if err := validateToggle(*button.Toggle); err != nil {
			return err
		}
	}
	for _, child := range button.Folder {
		if err := validateButton(cfg, child, child.ID); err != nil {
			return err
		}
	}
	return nil
}

func validateToggle(toggle protocol.ToggleState) error {
	if !isOptionalHexColor(toggle.Color) {
		return fmt.Errorf("%w: toggle color must be a hex value like #2563eb", ErrInvalid)
	}
	if err := validateIcon(toggle.Icon); err != nil {
		return err
	}
	return validateActions(toggle.Actions)
}

func validateActions(actions []protocol.Action) error {
	for _, action := range actions {
		if !knownActionKinds[action.Kind] {
			return fmt.Errorf("%w: unknown action kind %q", ErrInvalid, action.Kind)
		}
		if !knownTerminalWindows[action.Window] {
			return fmt.Errorf("%w: unknown terminal window %q", ErrInvalid, action.Window)
		}
	}
	return nil
}

func validateIcon(icon *protocol.IconRef) error {
	if icon == nil {
		return nil
	}
	if !knownIconSources[icon.Source] {
		return fmt.Errorf("%w: unknown icon source %q", ErrInvalid, icon.Source)
	}
	return nil
}
