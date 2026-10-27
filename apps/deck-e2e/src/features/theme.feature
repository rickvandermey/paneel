@theme
Feature: Themes
	Themes are shared by every deck and stored on the host; custom ones derive from a few values.

	Background:
		Given the host starts clean

	Scenario: Switching a built-in theme and keeping it after a reload
		When I open the menu entry "Theme"
		Then the theme groups should be "Dark, Tinted, Expressive, Light, Custom"
		When I choose the theme "paper"
		Then the document theme should be "paper"
		When I reload the deck
		Then the document theme should be "paper"

	Scenario: A glass theme sets its base on the document
		When I open the menu entry "Theme"
		And I choose the theme "magenta"
		Then the document theme should be "magenta"

	Scenario: Creating, editing and deleting a custom theme
		When I open the menu entry "Theme"
		And I click "Create your own theme"
		And I name the theme "Studio"
		And I set the theme accent to "#e11d48"
		And I click "Create theme"
		Then the custom themes should be "Studio"
		And the document accent should be "#e11d48"
		When I edit the custom theme "Studio"
		And I name the theme "Studio Red"
		And I click "Save theme"
		Then the custom themes should be "Studio Red"
		When I delete the custom theme "Studio Red"
		Then the custom themes should be ""
		And the document theme should be "midnight"
