package config

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// The spike stored pages with row/column positions; the current model is an ordered list.
type spikeFile struct {
	Token    string         `json:"token"`
	Port     int            `json:"port"`
	Terminal string         `json:"terminal"`
	Profiles []spikeProfile `json:"profiles"`
}

type spikeProfile struct {
	ID    string      `json:"id"`
	Name  string      `json:"name"`
	Pages []spikePage `json:"pages"`
}

type spikePage struct {
	Buttons []spikeButton `json:"buttons"`
}

type spikeButton struct {
	ID      string        `json:"id"`
	Row     int           `json:"row"`
	Column  int           `json:"column"`
	Label   string        `json:"label"`
	Icon    string        `json:"icon"`
	Color   string        `json:"color"`
	Actions []spikeAction `json:"actions"`
}

type spikeAction struct {
	Kind      string   `json:"kind"`
	Key       string   `json:"key"`
	Modifiers []string `json:"modifiers"`
	Text      string   `json:"text"`
	Target    string   `json:"target"`
	Command   string   `json:"command"`
	WorkDir   string   `json:"workDir"`
	Millis    int      `json:"millis"`
}

func migrateFromSpike(data []byte) (*File, error) {
	var old spikeFile
	if err := json.Unmarshal(data, &old); err != nil {
		return nil, fmt.Errorf("migrating spike config: %w", err)
	}
	file := &File{
		Config: protocol.Config{
			SchemaVersion: CurrentSchemaVersion,
			Settings:      protocol.Settings{Terminal: old.Terminal},
		},
		Token:    old.Token,
		Port:     old.Port,
		Migrated: true,
	}
	for _, oldProfile := range old.Profiles {
		profile := protocol.Profile{ID: oldProfile.ID, Name: oldProfile.Name, Buttons: []protocol.Button{}}
		for _, page := range oldProfile.Pages {
			for _, oldButton := range buttonsInReadingOrder(page.Buttons) {
				profile.Buttons = append(profile.Buttons, migrateSpikeButton(oldButton))
			}
		}
		file.Profiles = append(file.Profiles, profile)
	}
	normalize(file)
	return file, nil
}

// buttonsInReadingOrder sorts the grid positions row by row, left to right, which is the order
// the list model shows them in.
func buttonsInReadingOrder(buttons []spikeButton) []spikeButton {
	sort.SliceStable(buttons, func(a, b int) bool {
		if buttons[a].Row != buttons[b].Row {
			return buttons[a].Row < buttons[b].Row
		}
		return buttons[a].Column < buttons[b].Column
	})
	return buttons
}

func migrateSpikeButton(oldButton spikeButton) protocol.Button {
	button := protocol.Button{
		ID:        oldButton.ID,
		Label:     oldButton.Label,
		ShowLabel: true,
		Color:     oldButton.Color,
		Actions:   []protocol.Action{},
	}
	if oldButton.Icon != "" {
		button.Icon = &protocol.IconRef{Source: protocol.IconPhosphor, Name: oldButton.Icon}
	}
	for _, oldAction := range oldButton.Actions {
		button.Actions = append(button.Actions, migrateSpikeAction(oldAction))
	}
	return button
}

func migrateSpikeAction(oldAction spikeAction) protocol.Action {
	action := protocol.Action{
		Kind: oldAction.Kind, Key: oldAction.Key, Modifiers: oldAction.Modifiers, Text: oldAction.Text,
		Target: oldAction.Target, Command: oldAction.Command, WorkDir: oldAction.WorkDir, Millis: oldAction.Millis,
	}
	// The spike kept a URL in the target field.
	if action.Kind == protocol.ActionURL {
		action.URL, action.Target = oldAction.Target, ""
	}
	return action
}

// Schema 1 stored a Claude or Codex prompt inside the command (`claude "fix the tests"`); schema
// 2 keeps the prompt apart so a running session receives just the prompt.
var promptCommand = regexp.MustCompile(`^(claude|codex)\s+"((?:[^"\\]|\\.)*)"$`)

func migrateV1ToV2(file *File) {
	for profileIndex := range file.Profiles {
		buttons := file.Profiles[profileIndex].Buttons
		for buttonIndex := range buttons {
			splitPromptCommands(&buttons[buttonIndex])
		}
	}
	file.SchemaVersion = CurrentSchemaVersion
	file.Migrated = true
}

func splitPromptCommands(button *protocol.Button) {
	for index := range button.Actions {
		splitPromptCommand(&button.Actions[index])
	}
	if button.Toggle != nil {
		for index := range button.Toggle.Actions {
			splitPromptCommand(&button.Toggle.Actions[index])
		}
	}
	for index := range button.Folder {
		splitPromptCommands(&button.Folder[index])
	}
}

func splitPromptCommand(action *protocol.Action) {
	if action.Kind != protocol.ActionTerminal || action.Prompt != "" {
		return
	}
	match := promptCommand.FindStringSubmatch(strings.TrimSpace(action.Command))
	if match == nil {
		return
	}
	action.Command = match[1]
	action.Prompt = strings.ReplaceAll(match[2], `\"`, `"`)
}
