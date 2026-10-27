@editor
Feature: Editing buttons
	In edit mode a tap opens the editor; everything is saved as commands to the host.

	Background:
		Given the host starts clean
		And I enter edit mode

	Scenario: Changing the label and color
		When I open the editor for the key "Copy"
		And I set the label to "Kopieer"
		And I pick the color swatch 9
		And I save the button
		Then the keys should include "Kopieer"
		And the key "Kopieer" should have the color "#2563eb"

	Scenario: Choosing a Phosphor icon
		When I open the editor for the key "Copy"
		And I open the icon picker
		And I search the icons for "rocket"
		And I pick the icon "rocket-launch"
		And I save the button
		Then the key "Copy" should show the icon "rocket-launch"

	Scenario: Building an action list
		When I add a new button
		And I set the label to "Combo"
		And I add the action "Hotkey"
		And I set the hotkey of action 1 to "c" with "cmd"
		And I add the action "Wait"
		And I add the action "Type text"
		And I set the text of action 3 to "hello"
		And I move action 3 up
		And I save the button
		Then the keys should include "Combo"
		And the button "Combo" should have the actions "hotkey, text, delay"

	Scenario: A hotkey can focus an app first
		When I add a new button
		And I set the label to "Zoom mute"
		And I add the action "Hotkey"
		And I set the hotkey of action 1 to "a" with "cmd"
		And I choose an installed app for action 1
		Then the app to focus in action 1 should not be empty
		And the label should still be "Zoom mute"
		When I save the button
		Then the button "Zoom mute" should have the actions "hotkey"

	Scenario: An app control action has an app, a control and a value
		When I add a new button
		And I set the label to "Shuffle"
		And I add the action "App control"
		And I save the button
		Then the button "Shuffle" should have the actions "appControl"

	Scenario: Moving a button with the arrows
		When I open the editor for the key "Copy"
		And I move the button forward
		And I close the sheet
		Then the key order should start with "Paste, Copy"

	Scenario: Deleting a button asks for confirmation
		When I open the editor for the key "Paste"
		And I click "Delete"
		Then I should see the button "Really delete?"
		When I click "Really delete?"
		Then the keys should not include "Paste"

	Scenario: A folder holds its own buttons
		When I add a new button
		And I set the label to "Tools"
		And I mark the new button as a folder
		And I save the button
		And I open the editor for the key "Tools"
		And I click "Open folder to edit its buttons"
		And I add a new button
		And I set the label to "Inside"
		And I save the button
		Then the keys should include "Back, Inside"

	Scenario: Giving a button a second toggle state
		When I open the editor for the key "Copy"
		And I enable the toggle state
		And I set the toggle label to "Copied"
		And I save the button
		And I leave edit mode
		And I press the key "Copy"
		Then the key "Copied" should be on

	Scenario: Picking an installed app for a launch action
		When I add a new button
		And I add the action "Open app"
		And I choose an installed app for action 1
		Then the label should be filled with the app name
		And the app to open in action 1 should not be empty

	Scenario: Reordering keys by dragging
		When I drag the key "Copy" onto the key "Calculator"
		Then the key order should start with "Paste, Calculator, Copy"
		And no editor should be open

	Scenario: Trying a button runs its actions without saving
		When I open the editor for the key "Copy"
		And I set the label to "Changed"
		And I click "Try it on your computer now"
		Then I should see the toast "Running the actions on your computer"
		And the host should acknowledge the run
		When I click "Cancel"
		Then the keys should include "Copy"
		And the keys should not include "Changed"

	Scenario: A silent action can opt out of its notification
		When I add a new button
		And I set the label to "Quiet"
		And I add the action "Run silently"
		And I set the command of action 1 to "echo hi"
		And I turn off the notification of action 1
		And I save the button
		Then the button "Quiet" should have the actions "shell"
		And the action 1 of "Quiet" should be silent

	Scenario: A terminal action carries a prompt and can insist on a new window
		When I add a new button
		And I set the label to "Ask Claude"
		And I add the action "Run in terminal"
		And I set the command of action 1 to "claude"
		And I set the prompt of action 1 to "explain this repository"
		And I choose a new window for action 1
		And I save the button
		Then the button "Ask Claude" should have the actions "terminal"
		And the action 1 of "Ask Claude" should run "claude" with the prompt "explain this repository" in a new window
