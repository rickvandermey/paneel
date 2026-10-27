@assistant
Feature: Build a page with AI
	A short conversation ends in a page proposal the user adds; the host runs a fake model here.

	Background:
		Given the host starts clean
		And I open the menu entry "Build a page with AI"

	Scenario: A request becomes a page proposal that can be added
		When I ask the assistant "Make a page with Copy and Paste"
		Then the assistant should propose the keys "Copy, Paste"
		When I click "Add this page"
		Then the active page should be "Copy"
		And the keys should include "Copy, Paste"
		And I should see the toast "Added the Copy page"

	Scenario: Adding the proposal can be undone
		When I ask the assistant "Make a page with Copy and Paste"
		And I click "Add this page"
		And I click the toast action "Undo"
		Then the pages should be "Start"

	Scenario: Off-topic requests are declined
		When I ask the assistant "Tell me a joke"
		Then the assistant should answer "I can only help you build pages for your deck."
		And no proposal should be shown

	Scenario: The proposal can extend the current page
		When I ask the assistant "Add Copy to this page"
		Then the assistant should propose the keys "Copy"
		When I click "Add these keys"
		Then the keys should include "Copy, Paste, Calculator, Copy"

	Scenario: Closing the panel keeps the conversation
		When I ask the assistant "Make a page with Copy and Paste"
		And I close the sheet
		And I open the menu entry "Build a page with AI"
		Then the assistant should propose the keys "Copy, Paste"
		When I reload the deck
		And I open the menu entry "Build a page with AI"
		Then the assistant should propose the keys "Copy, Paste"
		When I click "Start over"
		Then no proposal should be shown
