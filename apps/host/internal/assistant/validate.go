package assistant

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

const (
	// maxMessageChars keeps the assistant's chat message short enough for the panel.
	maxMessageChars = 600
	// maxPlanButtons is a page's worth of keys; longer plans are a sign of a confused model.
	maxPlanButtons = 24
)

// parseReply decodes and validates one reply against the schema rules and the catalog.
func parseReply(raw string, request Request) (Reply, error) {
	var reply Reply
	decoder := json.NewDecoder(strings.NewReader(strings.TrimSpace(raw)))
	if err := decoder.Decode(&reply); err != nil {
		return Reply{}, fmt.Errorf("not JSON: %w", err)
	}
	if err := validateReply(&reply, request); err != nil {
		return Reply{}, err
	}
	return reply, nil
}

// validateReply normalizes the reply in place and rejects what the deck could not use.
func validateReply(reply *Reply, request Request) error {
	if err := normalizeReplyKind(reply); err != nil {
		return err
	}
	if err := normalizeMessage(reply); err != nil {
		return err
	}
	if reply.Plan == nil {
		return nil
	}
	if err := normalizePlan(reply.Plan, request); err != nil {
		return err
	}
	return keepUsableButtons(reply.Plan, request.Catalog)
}

func normalizeReplyKind(reply *Reply) error {
	switch reply.Kind {
	case KindQuestion, KindDecline:
		reply.Plan = nil
		return nil
	case KindPlan:
		if reply.Plan == nil {
			return errors.New("kind is plan but plan is null")
		}
		return nil
	default:
		return fmt.Errorf("unknown kind %q", reply.Kind)
	}
}

func normalizeMessage(reply *Reply) error {
	reply.Message = strings.TrimSpace(reply.Message)
	if reply.Message == "" {
		return errors.New("message is empty")
	}
	if len(reply.Message) > maxMessageChars {
		reply.Message = reply.Message[:maxMessageChars-1] + "…"
	}
	return nil
}

func normalizePlan(plan *Plan, request Request) error {
	if plan.Target != TargetCurrentPage {
		plan.Target = TargetNewPage
	}
	plan.Name = strings.TrimSpace(plan.Name)
	if plan.Target == TargetNewPage && plan.Name == "" {
		return errors.New("a new page needs a name")
	}
	// A palette the deck does not know is dropped rather than rejected; the page still works.
	if plan.Palette != "" && !slices.Contains(request.Palettes, plan.Palette) {
		plan.Palette = ""
	}
	if len(plan.Buttons) == 0 {
		return errors.New("a plan needs at least one button")
	}
	if len(plan.Buttons) > maxPlanButtons {
		return fmt.Errorf("a plan may hold at most %d buttons", maxPlanButtons)
	}
	return nil
}

// keepUsableButtons resolves presets against the catalog and drops buttons that do not hold up.
// A single bad button does not fail the whole plan as long as something usable remains, because
// small models get one key wrong far more often than all of them.
func keepUsableButtons(plan *Plan, catalog []CatalogEntry) error {
	labelsByKey := map[string]string{}
	for _, entry := range catalog {
		labelsByKey[labelKey(entry.Label)] = entry.Label
	}
	seenPresets := map[string]bool{}
	kept := make([]PlanButton, 0, len(plan.Buttons))
	var firstProblem error
	noteProblem := func(err error) {
		if firstProblem == nil {
			firstProblem = err
		}
	}
	for index := range plan.Buttons {
		button := &plan.Buttons[index]
		// A custom key that only re-creates a catalog key becomes that preset; small models do
		// this often ("Git Status" with its own terminal action).
		if button.Preset == "" {
			if label, ok := labelsByKey[labelKey(button.Label)]; ok {
				button.Preset = label
			}
		}
		if button.Preset != "" {
			label, ok := labelsByKey[labelKey(button.Preset)]
			if !ok {
				noteProblem(fmt.Errorf("preset %q is not in the catalog", button.Preset))
				continue
			}
			if seenPresets[label] {
				// Repeats are simply skipped; the model listed the key twice.
				continue
			}
			seenPresets[label] = true
			button.Preset = label
			button.Label, button.Icon, button.Actions = "", "", nil
			kept = append(kept, *button)
			continue
		}
		if err := validateCustomButton(button); err != nil {
			noteProblem(err)
			continue
		}
		kept = append(kept, *button)
	}
	if len(kept) == 0 {
		return firstProblem
	}
	plan.Buttons = kept
	return nil
}

func validateCustomButton(button *PlanButton) error {
	button.Label = strings.TrimSpace(button.Label)
	if button.Label == "" {
		return errors.New("a custom button needs a label")
	}
	if len(button.Actions) == 0 {
		return fmt.Errorf("custom button %q needs an action", button.Label)
	}
	for actionIndex := range button.Actions {
		action := &button.Actions[actionIndex]
		if action.Kind == protocol.ActionMedia && action.Control == "" {
			// Small models often name the key and forget the control; the label usually says.
			action.Control = inferMediaControl(button.Label)
		}
		if err := validateAction(*action); err != nil {
			return fmt.Errorf("button %q: %w", button.Label, err)
		}
	}
	return nil
}

// inferMediaControl reads the control out of a label such as "Play/Pause" or "Volume up".
func inferMediaControl(label string) string {
	key := labelKey(label)
	switch {
	case strings.Contains(key, "play") || strings.Contains(key, "pause"):
		return protocol.MediaPlayPause
	case strings.Contains(key, "next") || strings.Contains(key, "skip"):
		return protocol.MediaNext
	case strings.Contains(key, "prev") || strings.Contains(key, "back"):
		return protocol.MediaPrevious
	case strings.Contains(key, "mute"):
		return protocol.MediaMute
	case strings.Contains(key, "volumeup") || strings.Contains(key, "louder"):
		return protocol.MediaVolumeUp
	case strings.Contains(key, "volumedown") || strings.Contains(key, "quieter"):
		return protocol.MediaVolumeDown
	}
	return ""
}

func validateAction(action PlanAction) error {
	if !allowedActionKinds[action.Kind] {
		return fmt.Errorf("action kind %q is not allowed", action.Kind)
	}
	switch action.Kind {
	case protocol.ActionHotkey:
		if action.Key == "" {
			return errors.New("hotkey needs a key")
		}
	case protocol.ActionText:
		if action.Text == "" {
			return errors.New("text action needs text")
		}
	case protocol.ActionLaunch:
		if action.Target == "" {
			return errors.New("launch needs an app")
		}
	case protocol.ActionURL:
		if !strings.HasPrefix(action.URL, "http://") && !strings.HasPrefix(action.URL, "https://") {
			return errors.New("url must start with http:// or https://")
		}
	case protocol.ActionShell, protocol.ActionTerminal:
		if strings.TrimSpace(action.Command) == "" {
			return errors.New("command is empty")
		}
	case protocol.ActionMedia:
		if action.Control == "" {
			return errors.New("media action needs a control")
		}
	}
	return nil
}

// labelKey makes "Play / Pause", "play/pause" and "Play-Pause" the same label.
func labelKey(label string) string {
	var builder strings.Builder
	for _, char := range strings.ToLower(label) {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}
