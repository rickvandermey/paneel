@settings
Feature: Settings
	Terminal, smart pages, network and starting over.

	Background:
		Given the host starts clean
		And I open the menu entry "Settings"

	Scenario: The terminal choice is stored on the host
		When I choose the terminal "iTerm"
		And I reload the deck
		And I open the menu entry "Settings"
		Then the terminal should be "iTerm"

	Scenario: The smart pages mode is stored on the host
		When I choose the smart pages mode "explicit"
		And I reload the deck
		And I open the menu entry "Settings"
		Then the smart pages mode should be "explicit"

	@mac
	@windows
	Scenario: The focused app is reported
		Then the focused app should be known

	Scenario: Starting clean restores the defaults
		Given I close the sheet
		And a blank page "Second" exists
		When I open the menu entry "Settings"
		And I click "Start clean"
		And I click "Really start clean?"
		Then I should see the toast "Started clean"
		And the pages should be "Start"

	Scenario: A backup brings pages back after they changed
		Given I close the sheet
		And a blank page "Second" exists
		When I download a backup
		And a blank page "Third" exists
		Then the pages should be "Start, Second, Third"
		When I open the menu entry "Settings"
		Then the backup link should point at the host
		When I restore the backup through the settings
		Then I should see the toast "Restored 2 pages from the backup"
		And the pages should be "Start, Second"

	@manual
	Scenario: Rotating the token reconnects this deck
		When I click "Regenerate pairing token"
		And I click "Really regenerate the token?"
		Then the deck should be connected
