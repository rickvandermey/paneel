@icons
Feature: Icons
	App icons, favicons, logos and uploads become assets on the host.

	Background:
		Given the host starts clean
		And I enter edit mode
		And I open the editor for the key "Copy"
		And I open the icon picker

	Scenario: Uploading an image stores it as an asset
		When I upload a PNG icon
		And I save the button
		Then the key "Copy" should show an image icon

	@internet
	Scenario: A website favicon is fetched by the host
		When I open the icon tab "Website"
		And I resolve the website icon for "github.com"
		And I save the button
		Then the key "Copy" should show an image icon

	@internet
	Scenario: A brand logo is fetched by the host
		When I open the icon tab "Logo"
		And I search the logos for "spotify"
		And I pick the logo "Spotify"
		And I save the button
		Then the key "Copy" should show an image icon

	@mac
	Scenario: An app icon is extracted by the host
		When I open the icon tab "App"
		And I resolve the app icon for "Calculator"
		And I save the button
		Then the key "Copy" should show an image icon
