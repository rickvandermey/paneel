@smart-pages
@mac
@windows
Feature: Smart pages
	A page comes to the front when the app it belongs to has the focus.

	Scenario: A page that can launch the focused app is selected automatically
		Given the host starts clean
		And a blank page "Inferred" exists
		And the page "Inferred" has a launch button for the focused app
		When I select the page "Start"
		And I reload the deck
		Then the active page should be "Inferred"

	Scenario: Only explicitly followed pages switch when inference is off
		Given the host starts clean
		And a blank page "Inferred" exists
		And the page "Inferred" has a launch button for the focused app
		And the smart pages mode is "explicit"
		When I select the page "Start"
		And I reload the deck
		Then the active page should be "Start"
