@app-buttons
Feature: App buttons
	Ready-made buttons per application, so the controls of Spotify or Zoom are one tap away.

	Background:
		Given the host starts clean
		And I open the menu entry "App buttons"

	@smoke
	Scenario: The apps with ready-made buttons are listed
		Then the app list should include "Spotify, Zoom, Microsoft Teams, Google Meet, Discord, Claude, Visual Studio Code, Slack, Cursor, JetBrains IDEs, GitHub Desktop, Notion, Obsidian, Outlook, Figma, Photoshop, Lightroom Classic, DaVinci Resolve, YouTube"

	@mac
	Scenario: Apple Music is offered on macOS
		Then the app list should include "Apple Music"

	Scenario: Opening an app shows its buttons
		When I open the app "Spotify"
		Then the app buttons should include "Shuffle, Repeat, Play / Pause, Next, Previous, Like, Open Spotify"

	Scenario: Adding Shuffle gives a two-state button that drives the app
		When I open the app "Spotify"
		And I add the app button "Shuffle"
		Then I should see the toast "Added \"Shuffle\" to Start"
		When I close the sheet
		Then the keys should include "Shuffle"
		And the button "Shuffle" should have the actions "appControl"
		And the button "Shuffle" should have the toggle actions "appControl"

	Scenario: Adding all buttons of an app at once
		When I open the app "Zoom"
		And I click "Add all"
		Then I should see the toast "Added 4 buttons to Start"
		When I close the sheet
		Then the keys should include "Mute, Camera, Share, Open Zoom"

	Scenario: Searching finds buttons across apps
		When I search the app catalog for "mute"
		Then the app catalog groups should include "Zoom, Microsoft Teams, Google Meet"
		And the app buttons should include "Mute"
		When I search the app catalog for "nothing-like-this"
		Then the app catalog should say "No app or button matches."

	Scenario: Going back returns to the app list
		When I open the app "Zoom"
		And I click "Back to apps"
		Then the app list should include "Spotify"

	Scenario: Pressing Shuffle switches it on and then off in Spotify
		When I open the app "Spotify"
		And I add the app button "Shuffle"
		And I close the sheet
		And I press the key "Shuffle"
		Then the key "Shuffle" should be on
		And the host should have run the app controls "spotify shuffle on"
		And the recorded script should contain "set shuffling to true"
		When I press the key "Shuffle"
		Then no key should be on
		And the host should have run the app controls "spotify shuffle on, spotify shuffle off"

	@mac
	Scenario: Pressing Zoom mute focuses Zoom before the shortcut
		When I open the app "Zoom"
		And I add the app button "Mute"
		And I close the sheet
		And I press the key "Mute"
		Then the host should have run the hotkey "a" with "cmd, shift" in "zoom.us"

	@windows
	@linux
	Scenario: Pressing Zoom mute focuses Zoom before the shortcut on Windows and Linux
		When I open the app "Zoom"
		And I add the app button "Mute"
		And I close the sheet
		And I press the key "Mute"
		Then the host should have run the hotkey "a" with "alt" in "Zoom"

	Scenario: A Claude slash command is typed into the focused session
		When I open the app "Claude"
		Then the app buttons should include "Remote Control, MCP servers, /mcp, /code-review"
		When I add the app button "/mcp"
		And I close the sheet
		And I press the key "/mcp"
		Then the host should have run the actions "text, hotkey"
		And the host should have typed "/mcp"

	Scenario: The filter hides apps that are not installed
		When I switch the installed-only filter "on"
		Then every listed app should be marked installed
		And the app list should not include "YouTube"
		When I switch the installed-only filter "off"
		Then the app list should include "YouTube"
