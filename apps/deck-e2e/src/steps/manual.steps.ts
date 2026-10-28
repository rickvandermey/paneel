import { Given, When, Then } from './fixtures';

/**
 * Steps of the @manual scenarios. They never run automatically (the config excludes the tag),
 * but bddgen needs a definition for every step, and the wording documents what a human does.
 */

Given('the Paneel app is installed on an Android phone on the same Wi-Fi', async () => {
	// Build it with `pnpm nx build-apk mobile` and install the APK with adb or from the file.
});

When('I open the app and tap {string}', async ({}, _button: string) => {
	// The pairing screen of the app shows the button when it runs as the Android app.
});

When('I point the camera at the QR code in the desktop app', async () => {
	// The desktop app shows the QR code in its sidebar.
});

Then('pressing {string} should run the hotkey on the computer', async ({}, _label: string) => {
	// Watch the host log on the computer: it reports the press and the action it ran.
});
