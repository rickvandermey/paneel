import { expect } from '@playwright/test';
import { When, Then } from './fixtures';
import { cardNamed, clickTwiceToConfirm, exact, parseList, setColorInput } from './helpers';

Then('the theme groups should be {string}', async ({ page }, names: string) => {
	await expect(page.locator('sd-theme-panel .group')).toHaveText(parseList(names).map(exact));
});

When('I choose the theme {string}', async ({ page }, id: string) => {
	await page.locator(`sd-theme-panel .card[data-theme="${id}"]`).click();
});

Then('the document theme should be {string}', async ({ page }, id: string) => {
	await expect
		.poll(() => page.evaluate(() => document.documentElement.dataset['theme']))
		.toBe(id);
});

Then('the document accent should be {string}', async ({ page }, color: string) => {
	await expect
		.poll(() =>
			page.evaluate(() =>
				document.documentElement.style.getPropertyValue('--sd-accent').trim(),
			),
		)
		.toBe(color);
});

When('I name the theme {string}', async ({ page }, name: string) => {
	await page.locator('sd-theme-editor input[name="themeName"]').fill(name);
});

When('I set the theme accent to {string}', async ({ page }, color: string) => {
	await setColorInput(page.locator('sd-theme-editor input[name="accent"]'), color);
});

Then('the custom themes should be {string}', async ({ page }, names: string) => {
	await expect(page.locator('sd-theme-panel .card--custom .card__name')).toHaveText(
		parseList(names).map(exact),
	);
});

When('I edit the custom theme {string}', async ({ page }, name: string) => {
	await cardNamed(page, 'sd-theme-panel .card--custom', name)
		.locator('[aria-label="Edit theme"]')
		.click();
});

When('I delete the custom theme {string}', async ({ page }, name: string) => {
	await clickTwiceToConfirm(
		cardNamed(page, 'sd-theme-panel .card--custom', name).locator('.tool--danger'),
	);
});
