import { expect } from '@playwright/test';
import { When, Then } from './fixtures';
import { parseList } from './helpers';

When('I ask the assistant {string}', async ({ page }, text: string) => {
	await page.locator('sd-assistant-panel input[name="assistantDraft"]').fill(text);
	await page.locator('sd-assistant-panel .composer__send').click();
	await expect(
		page.locator('sd-assistant-panel .turn[data-role="assistant"]').last(),
	).toBeVisible();
});

Then('the assistant should propose the keys {string}', async ({ page }, labels: string) => {
	await expect(page.locator('sd-assistant-panel .plan__grid .key__label')).toHaveText(
		parseList(labels),
	);
});

Then('the assistant should answer {string}', async ({ page }, text: string) => {
	await expect(page.locator('sd-assistant-panel .turn[data-role="assistant"]').last()).toHaveText(
		text,
	);
});

Then('no proposal should be shown', async ({ page }) => {
	await expect(page.locator('sd-assistant-panel .plan')).toHaveCount(0);
});
