import { expect } from '@playwright/test';
import { After, Given, When, Then, webSocketFrames } from './fixtures';
import { expectConnected, keyColors } from './helpers';

// Every scenario starts from the default pages and settings; the host keeps token and port.
Given('the host starts clean', async ({ page, host, state }) => {
	await host.reset();
	await page.goto(host.pairingUrl());
	await expectConnected(page);
	await expect(page.locator('sd-deck sd-deck-key').first()).toBeVisible();
	state.originalColors = await keyColors(page);
});

After(async ({ $testInfo }) => {
	if ($testInfo.status !== $testInfo.expectedStatus) {
		// Printed rather than attached so the line reporter shows it next to the failure.
		console.log(['[websocket]', ...webSocketFrames].join('\n'));
	}
	webSocketFrames.length = 0;
});

After({ tags: 'not @allow-console-errors' }, async ({ consoleErrors }) => {
	expect(consoleErrors, 'no console errors during the scenario').toEqual([]);
});

When('I reload the deck', async ({ page }) => {
	await page.reload();
	await expectConnected(page);
});

When('I open the deck with the token {string}', async ({ page, host }, token: string) => {
	await page.goto(host.pairingUrl(token));
});

Then('the deck should be connected', async ({ page }) => {
	await expectConnected(page);
});

Then('I should see the pairing screen', async ({ page }) => {
	await expect(page.locator('main.pair')).toBeVisible();
});

When('I paste the current pairing URL on the pairing screen', async ({ page, host }) => {
	await page.locator('main.pair input').fill(host.pairingUrl());
});

Then('the pairing screen should say {string}', async ({ page }, text: string) => {
	await expect(page.locator('main.pair')).toContainText(text);
});
