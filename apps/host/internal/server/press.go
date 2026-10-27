package server

import (
	"context"
	"time"

	"github.com/paneel-nx/paneel/host/internal/actions"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// pressButton runs the actions of a key. A toggle key alternates between its two action lists
// and tells every deck about its new state.
func (server *Server) pressButton(ctx context.Context, press protocol.Press) protocol.Ack {
	ack := protocol.Ack{Type: protocol.TypeAck, ButtonID: press.ButtonID, SentAt: press.SentAt}
	button, ok := server.opts.Store.FindButton(press.ButtonID)
	if !ok {
		server.opts.Logger.Warn("press for unknown button", "buttonId", press.ButtonID)
		ack.Error = "unknown button"
		return ack
	}
	buttonActions := button.Actions
	if button.Toggle != nil {
		buttonActions = server.flipToggle(button)
		defer server.Broadcast(ctx, server.buttonState())
	}
	logAttrs := []any{"button", button.Label, "actions", actions.Describe(buttonActions)}
	return server.runWithAck(ctx, ack, buttonActions, "button pressed", "action failed", logAttrs)
}

// runAdHoc executes actions that are not saved on a key, such as the Try button in the editor,
// with the same timeout and terminal setting as a key press.
func (server *Server) runAdHoc(ctx context.Context, run protocol.Run) protocol.Ack {
	ack := protocol.Ack{Type: protocol.TypeAck, ButtonID: run.RunID, SentAt: run.SentAt}
	if len(run.Actions) == 0 {
		ack.Error = "nothing to run"
		return ack
	}
	logAttrs := []any{"actions", actions.Describe(run.Actions)}
	return server.runWithAck(ctx, ack, run.Actions, "run", "run failed", logAttrs)
}

// runWithAck runs the actions under the action timeout, measures how long they took and fills
// in the acknowledgement the deck is waiting for.
func (server *Server) runWithAck(ctx context.Context, ack protocol.Ack, list []protocol.Action, successMessage, failureMessage string, logAttrs []any) protocol.Ack {
	started := time.Now()
	runCtx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()
	// The terminal app can change in settings at any time; read it right before running.
	server.opts.Runner.SetTerminal(server.opts.Store.Settings().Terminal)
	err := server.opts.Runner.Run(runCtx, list)
	ack.ExecutionMs = time.Since(started).Milliseconds()
	if err != nil {
		server.opts.Logger.Warn(failureMessage, append(logAttrs, "err", err)...)
		ack.Error = err.Error()
		return ack
	}
	took := time.Since(started).Round(time.Millisecond)
	server.opts.Logger.Info(successMessage, append(logAttrs, "took", took)...)
	ack.OK = true
	return ack
}

// flipToggle switches the key between off and on and returns the actions for the state it
// leaves: the normal actions when turning on, the toggle actions when turning off.
func (server *Server) flipToggle(button protocol.Button) []protocol.Action {
	server.mu.Lock()
	defer server.mu.Unlock()
	if server.toggled[button.ID] {
		delete(server.toggled, button.ID)
		return button.Toggle.Actions
	}
	server.toggled[button.ID] = true
	return button.Actions
}

// resetToggles switches every toggle key off, for a reset or restore of the config.
func (server *Server) resetToggles() {
	server.mu.Lock()
	defer server.mu.Unlock()
	server.toggled = map[string]bool{}
}

func (server *Server) buttonState() protocol.ButtonState {
	server.mu.Lock()
	defer server.mu.Unlock()
	states := make(map[string]bool, len(server.toggled))
	for id := range server.toggled {
		states[id] = true
	}
	return protocol.ButtonState{Type: protocol.TypeButtonState, States: states}
}
