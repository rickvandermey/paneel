@deck
@smoke
Feature: Using the deck
	Keys run actions on the host; large pages split into swipeable sets; folders open in place.

	Background:
		Given the host starts clean

	Scenario: Pressing a key runs its actions and reports the execution time
		When I press the key "Copy"
		Then the host should acknowledge the press
		And the execution time should be shown in the bar

	Scenario: Keys keep their size while a page grows
		Given I note the size of the key "Copy"
		When the page "Start" has 3 extra buttons
		Then the key "Copy" should still have the noted size

	Scenario: A phone shows a fixed grid of 3 by 5 keys per set
		Given the page "Start" has 48 extra buttons
		Then the first set should show 15 keys

	@desktop
	Scenario: A desktop window shows a fixed grid of 8 by 4 keys per set
		Given the page "Start" has 48 extra buttons
		Then the first set should show 32 keys

	Scenario: Many buttons split into sets that can be swiped
		Given the page "Start" has 48 extra buttons
		Then the deck should show set indicators
		When I swipe the deck left
		Then the active set should be 2
		When I swipe the deck right
		Then the active set should be 1

	Scenario: Swiping vertically switches pages
		Given a blank page "Second" exists
		When I swipe the deck up
		Then the active page should be "Second"
		When I swipe the deck down
		Then the active page should be "Start"

	Scenario: A folder opens in place with a back key
		Given the page "Start" has a folder "Tools" containing "Inside"
		When I press the key "Tools"
		Then the keys should include "Back, Inside"
		When I press the key "Back"
		Then the keys should include "Copy, Tools"
		And the keys should not include "Inside"

	@toggle
	Scenario: A toggle key flips state on the host and shows its second look
		Given the standard button "Mute" is added to the page
		When I press the key "Mute"
		Then the key "Unmute" should be on
		When I press the key "Unmute"
		Then no key should be on

	Scenario: A repeat key keeps pressing while it is held
		Given the page "Start" has a repeat button "Hold"
		When I hold the key "Hold" until the deck sent 3 presses
		Then the host should acknowledge the press
