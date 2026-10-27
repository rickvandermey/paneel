@catalog
Feature: Standard buttons catalog
	Ready-made buttons grouped by purpose, searchable, including the apps installed on the host.

	Background:
		Given the host starts clean
		And I open the menu entry "Add standard buttons"

	Scenario: The catalog lists the standard groups
		Then the catalog groups should include "Media, System, Window, Editing, Browser, IDE, Coding, Meetings, Apps, Websites"

	Scenario: Searching narrows the catalog
		When I search the catalog for "git"
		Then the catalog should show the buttons "Git status, Git pull, Git push, Git log"
		When I search the catalog for "nothing-like-this"
		Then the catalog should say "No button matches."

	Scenario: Adding a standard button puts it on the current page
		When I add the standard button "Screenshot"
		Then I should see the toast "Added \"Screenshot\" to Start"
		When I close the sheet
		Then the keys should include "Screenshot"

	Scenario: Installed apps are offered as buttons
		Then the catalog group "Your apps" should have at least 1 button
