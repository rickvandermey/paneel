import { expect } from '@playwright/test';
import { When, Then } from './fixtures';
import { exact, keyIn, parseList, pressKey } from './helpers';

Then('the welcome screen should be shown', async ({ page }) => {
	await expect(page.locator('sd-welcome')).toBeVisible();
});

Then('the example keys should be {string}', async ({ page }, labels: string) => {
	await expect(page.locator('sd-welcome .key__label')).toHaveText(parseList(labels).map(exact));
});

When('I press the example key {string}', async ({ page }, label: string) => {
	await pressKey(keyIn(page, 'sd-welcome', label));
});
