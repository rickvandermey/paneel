import { expect } from '@playwright/test';
import { When, Then } from './fixtures';

Then('the logs should mention {string}', async ({ page }, text: string) => {
	await expect(page.locator('sd-logs-panel .lines')).toContainText(text);
});

When('I turn on verbose logging', async ({ page }) => {
	await page.locator('sd-logs-panel input[name="verbose"]').check();
});

Then('verbose logging should be on', async ({ page }) => {
	await expect(page.locator('sd-logs-panel input[name="verbose"]')).toBeChecked();
});
