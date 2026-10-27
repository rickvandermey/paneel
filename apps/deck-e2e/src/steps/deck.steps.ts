import { expect, type Page } from '@playwright/test';
import { Given, When, Then, webSocketFrames } from './fixtures';
import { centerOf, deckKey, exact, parseList, pressKey } from './helpers';

const SWIPE_DISTANCE = 140;

// Pages (the chips in the bar)

When('I select the page {string}', async ({ page }, name: string) => {
	await page.locator('.chip', { hasText: exact(name) }).click();
});

Then('the active page should be {string}', async ({ page }, name: string) => {
	await expect(page.locator('.chip--active')).toHaveText(exact(name));
});

Then('the pages should be {string}', async ({ page }, names: string) => {
	await expect(page.locator('.chip')).toHaveText(parseList(names).map(exact));
});

Then('there should be no page chips', async ({ page }) => {
	await expect(page.locator('.chip')).toHaveCount(0);
});

// Keys

Then('the keys should include {string}', async ({ page }, labels: string) => {
	for (const label of parseList(labels)) {
		await expect(deckKey(page, label)).toBeVisible();
	}
});

Then('the keys should not include {string}', async ({ page }, labels: string) => {
	for (const label of parseList(labels)) {
		await expect(deckKey(page, label)).toHaveCount(0);
	}
});

Then('the key order should start with {string}', async ({ page }, labels: string) => {
	const expected = parseList(labels);
	await expect
		.poll(async () =>
			(await page.locator('sd-deck .key__label').allTextContents())
				.map((text) => text.trim())
				.slice(0, expected.length),
		)
		.toEqual(expected);
});

When('I press the key {string}', async ({ page }, label: string) => {
	await pressKey(deckKey(page, label));
});

// The bar shows the round-trip time only after the host acknowledged a press.
Then('the host should acknowledge the press', async ({ page }) => {
	await expect(page.locator('.bar__metric--muted')).toBeVisible();
});

Then('the execution time should be shown in the bar', async ({ page }) => {
	await expect(page.locator('.bar__metric--muted')).toHaveText(/\+\d+/);
});

Then('the key {string} should be on', async ({ page }, label: string) => {
	await expect(
		page
			.locator('sd-deck sd-deck-key.key--on')
			.filter({ has: page.locator('.key__label', { hasText: exact(label) }) }),
	).toHaveCount(1);
});

Then('no key should be on', async ({ page }) => {
	await expect(page.locator('sd-deck sd-deck-key.key--on')).toHaveCount(0);
});

Then(
	'the key {string} should have the color {string}',
	async ({ page }, label: string, color: string) => {
		await expect
			.poll(() =>
				deckKey(page, label).evaluate((element) =>
					getComputedStyle(element).getPropertyValue('--key-color').trim(),
				),
			)
			.toBe(color);
	},
);

Then(
	'the key {string} should show the icon {string}',
	async ({ page }, label: string, icon: string) => {
		await expect(deckKey(page, label).locator(`i.ph-${icon}`)).toHaveCount(1);
	},
);

Then('the key {string} should show an image icon', async ({ page }, label: string) => {
	await expect(deckKey(page, label).locator('img.key__image')).toHaveCount(1);
});

// Key size and sets

Given('I note the size of the key {string}', async ({ page, state }, label: string) => {
	const box = await deckKey(page, label).boundingBox();
	expect(box).not.toBeNull();
	state.keySize = { width: box?.width ?? 0, height: box?.height ?? 0 };
});

Then(
	'the key {string} should still have the noted size',
	async ({ page, state }, label: string) => {
		const box = await deckKey(page, label).boundingBox();
		expect(box).not.toBeNull();
		expect(box?.width).toBeCloseTo(state.keySize?.width ?? -1, 0);
		expect(box?.height).toBeCloseTo(state.keySize?.height ?? -1, 0);
	},
);

Then('the first set should show {int} keys', async ({ page }, count: number) => {
	await expect(page.locator('sd-deck sd-deck-set').first().locator('sd-deck-key')).toHaveCount(
		count,
	);
});

Then('the deck should show set indicators', async ({ page }) => {
	await expect(page.locator('sd-deck .dot').first()).toBeVisible();
});

Then('the active set should be {int}', async ({ page }, index: number) => {
	await expect
		.poll(async () => {
			const activeFlags = await page
				.locator('sd-deck .dot')
				.evaluateAll((elements) =>
					elements.map((element) => element.classList.contains('dot--active')),
				);
			return activeFlags.indexOf(true) + 1;
		})
		.toBe(index);
});

// Gestures

async function swipeDeck(page: Page, dx: number, dy: number): Promise<void> {
	const start = await centerOf(page.locator('sd-deck'));
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + dx / 2, start.y + dy / 2, { steps: 4 });
	await page.mouse.move(start.x + dx, start.y + dy, { steps: 4 });
	await page.mouse.up();
}

When('I swipe the deck left', async ({ page }) => swipeDeck(page, -SWIPE_DISTANCE, 0));
When('I swipe the deck right', async ({ page }) => swipeDeck(page, SWIPE_DISTANCE, 0));
When('I swipe the deck up', async ({ page }) => swipeDeck(page, 0, -SWIPE_DISTANCE));
When('I swipe the deck down', async ({ page }) => swipeDeck(page, 0, SWIPE_DISTANCE));

function countSentPresses(): number {
	return webSocketFrames.filter((line) => line.includes('"type":"press"')).length;
}

When(
	'I hold the key {string} until the deck sent {int} presses',
	async ({ page }, label: string, count: number) => {
		const center = await centerOf(deckKey(page, label));
		const sentBefore = countSentPresses();
		await page.mouse.move(center.x, center.y);
		await page.mouse.down();
		await expect
			.poll(() => countSentPresses() - sentBefore, { timeout: 5000 })
			.toBeGreaterThanOrEqual(count);
		await page.mouse.up();
	},
);

Then('the host should acknowledge the run', async () => {
	await expect
		.poll(
			() =>
				webSocketFrames.filter(
					(line) =>
						line.startsWith('RECV') &&
						line.includes('"type":"ack"') &&
						line.includes('"ok":true'),
				).length,
		)
		.toBeGreaterThanOrEqual(1);
});
