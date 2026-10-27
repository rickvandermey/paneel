@settings
Feature: Logs
	The host keeps a log the deck can show, copy and clear, so users can attach it to a bug report.

	Background:
		Given the host starts clean

	Scenario: A press shows up in the logs with its actions
		When I press the key "Copy"
		And I open the menu entry "Settings"
		And I click "Show logs"
		Then the logs should mention "button pressed"
		And the logs should mention "hotkey("
		And the logs should mention "connected"

	Scenario: The log can be copied and cleared
		When I open the menu entry "Settings"
		And I click "Show logs"
		And I click "Copy log"
		Then I should see the toast "Copied the log"
		When I click "Clear"
		Then I should see the toast "Log cleared"
		And the logs should mention "log cleared from a deck"

	Scenario: Verbose logging is stored on the host and adds debug lines
		When I open the menu entry "Settings"
		And I click "Show logs"
		And I turn on verbose logging
		And I reload the deck
		And I open the menu entry "Settings"
		And I click "Show logs"
		Then verbose logging should be on
		And the logs should mention "verbose logging"
