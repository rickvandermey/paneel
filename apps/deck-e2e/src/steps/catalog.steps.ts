import { expect } from '@playwright/test';
import { When, Then } from './fixtures';
import { exact, keyIn, parseList, pressKey } from './helpers';

When('I search the catalog for {string}', async ({ page }, query: string) => {
	await page.locator('sd-catalog .search').fill(query);
});

Then('the catalog groups should include {string}', async ({ page }, names: string) => {
	for (const name of parseList(names)) {
		await expect(page.locator('sd-catalog .group__name', { hasText: exact(name) })).toHaveCount(
			1,
		);
	}
});

Then('the catalog should show the buttons {string}', async ({ page }, labels: string) => {
	for (const label of parseList(labels)) {
		await expect(page.locator('sd-catalog .key__label', { hasText: exact(label) })).toHaveCount(
			1,
		);
	}
});

Then('the catalog should say {string}', async ({ page }, text: string) => {
	await expect(page.locator('sd-catalog .hint', { hasText: text })).toBeVisible();
});

When('I add the standard button {string}', async ({ page }, label: string) => {
	await pressKey(keyIn(page, 'sd-catalog', label).first());
});

Then(
	'the catalog group {string} should have at least {int} button',
	async ({ page }, name: string, count: number) => {
		// The host lists its apps asynchronously after connecting; the group appears once they arrive.
		const group = page
			.locator('sd-catalog .group')
			.filter({ has: page.locator('.group__name', { hasText: exact(name) }) });
		await expect
			.poll(() => group.locator('sd-deck-key').count(), { timeout: 15_000 })
			.toBeGreaterThanOrEqual(count);
	},
);
