@palette
Feature: Page palettes
	A palette colors new buttons and can recolor existing ones with a preview and undo.

	Background:
		Given the host starts clean
		And I open the menu entry "Pages"
		And I open the palette of the page "Start"

	Scenario: Without a palette the box explains what to do
		Then the palette box should mention "No palette yet"

	Scenario: Choosing a palette previews, applies and undoes
		When I choose the palette "Sunset"
		Then the palette box should mention "Sunset is the page palette"
		And the palette preview should show 6 keys
		And the deck keys should still have their original colors
		When I click "Apply to 6 buttons"
		Then I should see the toast "Recolored 6 buttons on Start"
		And the deck keys should use the palette "Sunset"
		When I click the toast action "Undo"
		Then the deck keys should still have their original colors

	Scenario: A custom palette is saved and used by the page
		When I click "Create your own palette"
		And I name the palette "Brand"
		And I set palette color 1 to "#ff00ff"
		And I click "Create palette"
		Then the custom palettes should be "Brand"
		And the palette box should mention "Brand is the page palette"
		When I delete the custom palette "Brand"
		Then the custom palettes should be ""
		And the palette box should mention "No palette yet"
