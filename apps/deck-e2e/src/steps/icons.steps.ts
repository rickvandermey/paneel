import { expect, type Page } from '@playwright/test';
import { When } from './fixtures';
import { buttonNamed, exact } from './helpers';

/** Favicons and app icons come from the host, which may need a moment to fetch and convert them. */
const ICON_RESOLVE_TIMEOUT_MS = 20_000;

/** A 1x1 transparent PNG, enough for the host to accept and store it. */
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
);

async function expectIconPreview(page: Page, timeout?: number): Promise<void> {
	await expect(page.locator('sd-button-editor .preview img')).toBeVisible({ timeout });
}

When('I open the icon picker', async ({ page }) => {
	await buttonNamed(page, 'Choose icon').or(buttonNamed(page, 'Change icon')).first().click();
	await expect(page.locator('sd-icon-picker')).toBeVisible();
});

When('I open the icon tab {string}', async ({ page }, tab: string) => {
	await page.locator('sd-icon-picker .tab', { hasText: exact(tab) }).click();
});

When('I search the icons for {string}', async ({ page }, query: string) => {
	await page.locator('sd-icon-picker input[type="search"]').first().fill(query);
});

When('I pick the icon {string}', async ({ page }, name: string) => {
	await page.locator(`sd-icon-picker .cell[title="${name}"]`).click();
});

When('I search the logos for {string}', async ({ page }, query: string) => {
	await page.locator('sd-icon-picker input[placeholder^="Search logos"]').fill(query);
});

When('I pick the logo {string}', async ({ page }, title: string) => {
	await page
		.locator('sd-icon-picker .logo')
		.filter({ has: page.locator('.logo__title', { hasText: exact(title) }) })
		.first()
		.click();
	await expectIconPreview(page);
});

When('I resolve the website icon for {string}', async ({ page }, url: string) => {
	await page.locator('sd-icon-picker input[name="url"]').fill(url);
	await buttonNamed(page, 'Use favicon').click();
	await expectIconPreview(page, ICON_RESOLVE_TIMEOUT_MS);
});

When('I resolve the app icon for {string}', async ({ page }, app: string) => {
	await page.locator('sd-icon-picker input[name="app"]').fill(app);
	await buttonNamed(page, 'Use app icon').click();
	await expectIconPreview(page, ICON_RESOLVE_TIMEOUT_MS);
});

When('I upload a PNG icon', async ({ page }) => {
	await page.locator('sd-icon-picker .tab', { hasText: exact('Upload') }).click();
	await page.locator('sd-icon-picker input[type="file"]').setInputFiles({
		name: 'icon.png',
		mimeType: 'image/png',
		buffer: TINY_PNG,
	});
	await expectIconPreview(page);
});
