import { expect } from '@playwright/test';
import { When, Then } from './fixtures';
import { exact, keyIn, parseList, pressKey } from './helpers';

Then('the app list should include {string}', async ({ page }, names: string) => {
	for (const name of parseList(names)) {
		await expect(
			page.locator('sd-app-catalog .app__name', { hasText: exact(name) }),
		).toHaveCount(1);
	}
});

Then('the app list should not include {string}', async ({ page }, names: string) => {
	for (const name of parseList(names)) {
		await expect(
			page.locator('sd-app-catalog .app__name', { hasText: exact(name) }),
		).toHaveCount(0);
	}
});

When('I switch the installed-only filter {string}', async ({ page }, state: string) => {
	const filter = page.locator('sd-app-catalog .filter');
	await filter.click();
	await expect(filter).toHaveAttribute('aria-pressed', state === 'on' ? 'true' : 'false');
});

Then('every listed app should be marked installed', async ({ page }) => {
	// The host lists its apps asynchronously; wait until the filter has something to show or hide.
	const apps = page.locator('sd-app-catalog .app');
	await expect(
		page.locator('sd-app-catalog .app, sd-app-catalog .list .hint').first(),
	).toBeVisible();
	const count = await apps.count();
	for (let index = 0; index < count; index++) {
		await expect(apps.nth(index).locator('.app__installed')).toBeVisible();
	}
});

When('I open the app {string}', async ({ page }, name: string) => {
	await page
		.locator('sd-app-catalog .app')
		.filter({ has: page.locator('.app__name', { hasText: exact(name) }) })
		.click();
	await expect(page.locator('sd-app-catalog .app-header__name')).toHaveText(name);
});

Then('the app buttons should include {string}', async ({ page }, labels: string) => {
	for (const label of parseList(labels)) {
		await expect(
			page.locator('sd-app-catalog .key__label', { hasText: exact(label) }).first(),
		).toBeVisible();
	}
});

When('I add the app button {string}', async ({ page }, label: string) => {
	await pressKey(keyIn(page, 'sd-app-catalog', label).first());
});

When('I search the app catalog for {string}', async ({ page }, query: string) => {
	await page.locator('sd-app-catalog .search').fill(query);
});

Then('the app catalog groups should include {string}', async ({ page }, names: string) => {
	for (const name of parseList(names)) {
		await expect(
			page.locator('sd-app-catalog .group__name', { hasText: exact(name) }),
		).toHaveCount(1);
	}
});

Then('the app catalog should say {string}', async ({ page }, text: string) => {
	await expect(page.locator('sd-app-catalog .hint', { hasText: text })).toBeVisible();
});

Then(
	'the button {string} should have the toggle actions {string}',
	async ({ host }, label: string, kinds: string) => {
		const button = await host.buttonLabelled(label);
		expect(button.toggle, `toggle of ${label}`).toBeTruthy();
		expect(button.toggle?.actions.map((action) => action.kind)).toEqual(parseList(kinds));
	},
);
