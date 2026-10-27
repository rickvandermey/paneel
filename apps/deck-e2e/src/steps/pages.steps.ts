import { expect, type Locator, type Page } from '@playwright/test';
import { When, Then } from './fixtures';
import { cardNamed, clickTwiceToConfirm, exact, parseList } from './helpers';

function pageRow(page: Page, name: string): Locator {
	return page
		.locator('sd-profiles-panel .row')
		.filter({ has: page.locator('.row__name', { hasText: name }) })
		.first();
}

// Page presets (the sheet that creates pages)

Then('the page presets should list {string}', async ({ page }, names: string) => {
	// Recommended presets move to the top depending on the installed apps, so compare as a set.
	const expected = parseList(names).sort();
	await expect
		.poll(async () =>
			(await page.locator('sd-page-presets-panel .card__name').allTextContents())
				.map((text) => text.trim())
				.sort(),
		)
		.toEqual(expected);
});

When('I search the page presets for {string}', async ({ page }, query: string) => {
	await page.locator('sd-page-presets-panel .search').fill(query);
});

When('I choose the page preset {string}', async ({ page }, name: string) => {
	await cardNamed(page, 'sd-page-presets-panel .card', name).click();
});

When('I add a blank page named {string}', async ({ page }, name: string) => {
	await page.locator('sd-page-presets-panel .blank input').fill(name);
	await page.locator('sd-page-presets-panel .blank .primary').click();
});

// The pages panel

When('I rename the page {string} to {string}', async ({ page }, from: string, to: string) => {
	await pageRow(page, from).locator('[aria-label="Rename"]').click();
	await page.locator('sd-profiles-panel .row__input').fill(to);
	await page.locator('sd-profiles-panel .row__input').press('Enter');
});

When('I move the page {string} up', async ({ page }, name: string) => {
	await pageRow(page, name).locator('[aria-label="Move up"]').click();
});

Then('the page rows should be {string}', async ({ page }, names: string) => {
	await expect
		.poll(() =>
			page
				.locator('sd-profiles-panel .row__name')
				// The name is the first text node; the follow summary sits in a child element.
				.evaluateAll((elements) =>
					elements.map((element) => element.childNodes[0]?.textContent?.trim() ?? ''),
				),
		)
		.toEqual(parseList(names));
});

Then(
	'the page row {string} should mention {string}',
	async ({ page }, name: string, text: string) => {
		await expect(pageRow(page, name).locator('.row__count')).toContainText(text);
	},
);

When('I open the follow list of the page {string}', async ({ page }, name: string) => {
	await pageRow(page, name).locator('[aria-label^="Follow"]').click();
	await expect(page.locator('sd-app-picker')).toBeVisible();
});

When('I add the followed app {string}', async ({ page }, name: string) => {
	await page.locator('sd-profiles-panel .custom input').fill(name);
	await page.locator('sd-profiles-panel .custom .primary').click();
});

When('I remove the followed app {string}', async ({ page }, name: string) => {
	await page
		.locator('sd-profiles-panel .chip', { hasText: exact(name) })
		.locator('.chip__remove')
		.click();
});

Then('the followed apps should be {string}', async ({ page }, names: string) => {
	await expect(page.locator('sd-profiles-panel .chip')).toHaveText(parseList(names).map(exact));
});

When('I go back to the pages', async ({ page }) => {
	await page.locator('sd-profiles-panel .back').click();
});

When('I delete every page', async ({ page }) => {
	await expect(page.locator('sd-profiles-panel')).toBeVisible();
	const rows = page.locator('sd-profiles-panel .row');
	await expect(rows.first()).toBeVisible();
	let remaining = await rows.count();
	while (remaining > 0) {
		await clickTwiceToConfirm(rows.first().locator('.icon-button--danger'));
		await expect(rows).toHaveCount(remaining - 1);
		remaining -= 1;
	}
});

When('I open the palette of the page {string}', async ({ page }, name: string) => {
	await pageRow(page, name).locator('[aria-label="Color palette"]').click();
	await expect(page.locator('sd-palette-panel')).toBeVisible();
});
