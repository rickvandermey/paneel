package server

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/paneel-nx/paneel/host/internal/protocol"
	"github.com/paneel-nx/paneel/host/internal/store"
)

// applyCommand changes the config on behalf of one deck and tells every deck what changed.
func (server *Server) applyCommand(ctx context.Context, message protocol.CommandMessage) protocol.CommandResult {
	result := protocol.CommandResult{Type: protocol.TypeCommandResult, CommandID: message.CommandID}
	applied, revision, err := server.opts.Store.Apply(message.Command)
	result.Revision = revision
	if err != nil {
		result.Error = server.commandErrorMessage(message.Command, err)
		return result
	}
	result.OK = true
	server.opts.Logger.Info("command applied", "type", applied.Type, "revision", revision)
	server.Broadcast(ctx, protocol.Changed{
		Type:      protocol.TypeChanged,
		Revision:  revision,
		CommandID: message.CommandID,
		Command:   applied,
	})
	server.scheduleAutoIcon(applied)
	return result
}

// commandErrorMessage turns a store error into what the deck shows: validation problems are
// shown as they are, anything else is logged here and summarised for the user.
func (server *Server) commandErrorMessage(command protocol.Command, err error) string {
	if errors.Is(err, store.ErrInvalid) {
		return strings.TrimPrefix(err.Error(), store.ErrInvalid.Error()+": ")
	}
	server.opts.Logger.Error("command failed", "type", command.Type, "err", err)
	return "could not save configuration"
}

// applySettings pushes the settings the host reads live, after a settings.update command.
func (server *Server) applySettings() {
	settings := server.opts.Store.Settings()
	server.opts.Runner.SetTerminal(settings.Terminal)
	if server.opts.Logs != nil && server.opts.Logs.Verbose() != settings.VerboseLogging {
		server.opts.Logs.SetVerbose(settings.VerboseLogging)
		server.opts.Logger.Info("verbose logging", "on", settings.VerboseLogging)
	}
}

// scheduleAutoIcon fills in an icon for buttons that have none but launch an app or open a URL.
// The lookup may take a while, so it runs in the background and patches the button afterwards.
func (server *Server) scheduleAutoIcon(command protocol.Command) {
	if server.opts.Icons == nil {
		return
	}
	buttonID, ok := createdOrUpdatedButtonID(command)
	if !ok {
		return
	}
	button, ok := server.opts.Store.FindButton(buttonID)
	if !ok || button.Icon != nil {
		return
	}
	go server.resolveAndApplyIcon(button)
}

func createdOrUpdatedButtonID(command protocol.Command) (string, bool) {
	switch command.Type {
	case protocol.CmdButtonCreate:
		return command.Button.ID, true
	case protocol.CmdButtonUpdate:
		return command.ID, true
	default:
		return "", false
	}
}

func (server *Server) resolveAndApplyIcon(button protocol.Button) {
	ctx, cancel := context.WithTimeout(context.Background(), iconTimeout)
	defer cancel()
	icon, err := server.opts.Icons.ForButton(ctx, button)
	if err != nil {
		return
	}
	// The user may have picked an icon in the meantime; theirs wins.
	current, ok := server.opts.Store.FindButton(button.ID)
	if !ok || current.Icon != nil {
		return
	}
	patch, _ := json.Marshal(map[string]any{"icon": icon})
	applied, revision, err := server.opts.Store.Apply(protocol.Command{
		Type:  protocol.CmdButtonUpdate,
		ID:    button.ID,
		Patch: patch,
	})
	if err != nil {
		server.opts.Logger.Warn("auto icon failed", "button", button.ID, "err", err)
		return
	}
	server.Broadcast(ctx, protocol.Changed{Type: protocol.TypeChanged, Revision: revision, Command: applied})
}
