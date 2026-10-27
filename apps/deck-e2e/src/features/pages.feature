@pages
Feature: Pages
	Pages hold buttons, follow apps, carry a palette and can all be removed.

	Background:
		Given the host starts clean

	Scenario: Adding a page from a preset
		When I open the menu entry "Pages"
		And I click "Add page"
		Then the page presets should list "Music, Coding, AI, Browsing, Meetings, Writing, Design, System"
		When I search the page presets for "spotify"
		Then the page presets should list "Music"
		When I choose the page preset "Music"
		Then the pages should be "Start, Music"
		And the active page should be "Music"
		And the keys should include "Play / Pause, Next, Previous"

	Scenario: Adding a blank page
		When I open the menu entry "Pages"
		And I click "Add page"
		And I add a blank page named "Streaming"
		Then the pages should be "Start, Streaming"

	Scenario: Renaming and reordering pages
		Given a blank page "Second" exists
		When I open the menu entry "Pages"
		And I rename the page "Second" to "Two"
		And I move the page "Two" up
		Then the page rows should be "Two, Start"

	Scenario: A page follows several apps
		When I open the menu entry "Pages"
		And I open the follow list of the page "Start"
		And I add the followed app "com.example.one"
		And I add the followed app "Example Two"
		Then the followed apps should be "com.example.one, Example Two"
		When I remove the followed app "com.example.one"
		Then the followed apps should be "Example Two"
		When I go back to the pages
		Then the page row "Start" should mention "follows Example Two"

	Scenario: Deleting every page shows the welcome screen
		When I open the menu entry "Pages"
		And I delete every page
		And I close the sheet
		Then the welcome screen should be shown
		And there should be no page chips
		When I click "Start with the sample page"
		Then the active page should be "Start"
		And the keys should include "Copy, Paste, Calculator, GitHub, Play / Pause, Claude"

	Scenario: Adding a standard button without a page creates one
		When I open the menu entry "Pages"
		And I delete every page
		And I close the sheet
		And I open the menu entry "Add standard buttons"
		And I add the standard button "Mute"
		And I close the sheet
		Then the pages should be "Start"
		And the keys should include "Mute"
