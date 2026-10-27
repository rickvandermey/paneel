@welcome
Feature: Welcome screen
	Without pages the deck explains itself with working example keys.

	Background:
		Given the host starts clean
		And I open the menu entry "Pages"
		And I delete every page
		And I close the sheet

	Scenario: The welcome screen lists working example keys
		Then the welcome screen should be shown
		And the example keys should be "Play / Pause, Volume up, Volume down, Mute, Screenshot, Lock screen"

	@mac
	@windows
	Scenario: Example keys run on the host
		When I press the example key "Volume up"
		Then I should see the toast "Volume up sent to your computer"
		And the host should acknowledge the press
		When I press the example key "Volume down"
		Then the host should acknowledge the press

	Scenario: Add a page opens the presets
		When I click "Add a page"
		Then the page presets should list "Music, Coding, AI, Browsing, Meetings, Writing, Design, System"
