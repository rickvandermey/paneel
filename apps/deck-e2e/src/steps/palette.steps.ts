import { expect } from '@playwright/test';
import { When, Then } from './fixtures';
import {
	cardNamed,
	clickTwiceToConfirm,
	exact,
	hexToRgb,
	keyColors,
	parseList,
	setColorInput,
} from './helpers';

/** The palette preview shows this many keys, so only that many colors are compared. */
const PREVIEW_KEY_COUNT = 6;

When('I choose the palette {string}', async ({ page }, name: string) => {
	await cardNamed(page, 'sd-palette-panel .card', name).click();
});

Then('the palette box should mention {string}', async ({ page }, text: string) => {
	await expect(page.locator('sd-palette-panel .recolor')).toContainText(text);
});

Then('the palette preview should show {int} keys', async ({ page }, count: number) => {
	await expect(page.locator('sd-palette-panel .recolor__preview sd-deck-key')).toHaveCount(count);
});

Then('the deck keys should still have their original colors', async ({ page, state }) => {
	await expect.poll(() => keyColors(page)).toEqual(state.originalColors);
});

Then('the deck keys should use the palette {string}', async ({ page }, name: string) => {
	const paletteColors = await cardNamed(page, 'sd-palette-panel .card', name)
		.locator('.dot')
		.evaluateAll((elements) =>
			elements.map((element) => getComputedStyle(element).backgroundColor),
		);
	await expect
		.poll(async () => (await keyColors(page)).map(hexToRgb))
		.toEqual(paletteColors.slice(0, PREVIEW_KEY_COUNT));
});

When('I set palette color {int} to {string}', async ({ page }, index: number, color: string) => {
	await setColorInput(
		page.locator('sd-palette-editor .color input[type="color"]').nth(index - 1),
		color,
	);
});

When('I name the palette {string}', async ({ page }, name: string) => {
	await page.locator('sd-palette-editor input[name="paletteName"]').fill(name);
});

Then('the custom palettes should be {string}', async ({ page }, names: string) => {
	await expect(page.locator('sd-palette-panel .card--custom .card__name')).toHaveText(
		parseList(names).map(exact),
	);
});

When('I delete the custom palette {string}', async ({ page }, name: string) => {
	await clickTwiceToConfirm(
		cardNamed(page, 'sd-palette-panel .card--custom', name).locator('.tool--danger'),
	);
});
