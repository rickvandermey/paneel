import { expect, type Locator, type Page } from '@playwright/test';

/** Matches the whole text, ignoring surrounding whitespace, so "Copy" does not match "Copy all". */
export function exact(text: string): RegExp {
	return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

/** Matches text that begins with the given words, so "Prompt" finds "Prompt for the program". */
export function startsWith(text: string): RegExp {
	return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}

/** Turns a comma-separated step argument into trimmed names; an empty string gives no names. */
export function parseList(text: string): string[] {
	return text
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}

/** A deck key with this label inside the given container, such as 'sd-deck' or 'sd-catalog'. */
export function keyIn(page: Page, containerSelector: string, label: string): Locator {
	return page
		.locator(`${containerSelector} sd-deck-key`)
		.filter({ has: page.locator('.key__label', { hasText: exact(label) }) });
}

/** The key on the deck itself; the last match wins because a toggle key keeps its old label briefly. */
export function deckKey(page: Page, label: string): Locator {
	return keyIn(page, 'sd-deck', label).last();
}

/**
 * Keys react to pointerdown, not click, because they also support hold-to-repeat and drag. A
 * synthetic pointerdown skips the mouse movement that the gesture code would read as a swipe.
 */
export async function pressKey(key: Locator): Promise<void> {
	await key.dispatchEvent('pointerdown', { button: 0 });
}

/** The --key-color of every deck key, in deck order. */
export async function keyColors(page: Page): Promise<string[]> {
	return page
		.locator('sd-deck sd-deck-key')
		.evaluateAll((elements) =>
			elements.map((element) =>
				getComputedStyle(element).getPropertyValue('--key-color').trim(),
			),
		);
}

export function sheetCloseButton(page: Page): Locator {
	return page.locator('sd-sheet .sheet__close').first();
}

export function buttonNamed(page: Page, text: string): Locator {
	return page.locator('button', { hasText: exact(text) }).first();
}

/** A card in a panel (palettes, themes, page presets) found by the name it shows. */
export function cardNamed(page: Page, cardSelector: string, name: string): Locator {
	return page
		.locator(cardSelector)
		.filter({ has: page.locator('.card__name', { hasText: exact(name) }) })
		.first();
}

export async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
	const box = await locator.boundingBox();
	expect(box, 'element has a bounding box').not.toBeNull();
	return { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 };
}

/** Danger buttons ask for a second click to confirm; the first click only arms them. */
export async function clickTwiceToConfirm(locator: Locator): Promise<void> {
	await locator.click();
	await locator.click();
}

/** Playwright cannot type into a color input, so the value is set and the input event fired. */
export async function setColorInput(locator: Locator, value: string): Promise<void> {
	await locator.evaluate((element, color) => {
		(element as HTMLInputElement).value = color;
		element.dispatchEvent(new Event('input', { bubbles: true }));
	}, value);
}

export async function openMenuEntry(page: Page, entry: string): Promise<void> {
	await page.locator('.bar__menu').click();
	await page.locator('sd-menu .item:not(.item--profile)', { hasText: exact(entry) }).click();
}

export async function expectConnected(page: Page): Promise<void> {
	await expect(page.locator('.bar__status[data-status="connected"]')).toBeVisible();
}

/** Computed styles report rgb() while the keys carry hex colors, so comparisons go through this. */
export function hexToRgb(hex: string): string {
	const value = parseInt(hex.slice(1), 16);
	return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}
