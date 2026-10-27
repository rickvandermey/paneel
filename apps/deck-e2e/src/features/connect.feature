@connect
@smoke
Feature: Pairing and connection
	The web deck is served by the host and pairs with the token from the QR code.

	Scenario: The pairing URL connects and shows the sample page
		Given the host starts clean
		Then the deck should be connected
		And the active page should be "Start"
		And the keys should include "Copy, Paste, Calculator"

	Scenario: The pairing survives a reload
		Given the host starts clean
		When I reload the deck
		Then the deck should be connected
		And the active page should be "Start"

	# The browser logs the rejected WebSocket handshake as a console error; that is the point here.
	@allow-console-errors
	Scenario: A stale token returns to the pairing screen
		Given the host starts clean
		When I open the deck with the token "not-the-token"
		Then I should see the pairing screen
		And the pairing screen should say "no longer paired"

	@allow-console-errors
	Scenario: Pasting a fresh pairing URL on the pairing screen connects again
		Given the host starts clean
		When I open the deck with the token "not-the-token"
		And I paste the current pairing URL on the pairing screen
		And I click "Connect"
		Then the deck should be connected
		And the active page should be "Start"

	Scenario: Forgetting the computer returns to the pairing screen
		Given the host starts clean
		When I open the menu entry "Settings"
		And I click "Forget this computer"
		Then I should see the pairing screen
