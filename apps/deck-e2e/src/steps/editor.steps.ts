import { expect, type Locator, type Page } from '@playwright/test';
import { Given, When, Then } from './fixtures';
import { centerOf, deckKey, exact, openMenuEntry, parseList, startsWith } from './helpers';

/** Position of each modifier chip in the hotkey editor. */
const MODIFIER_INDEX: Record<string, number> = {
	cmd: 0,
	ctrl: 1,
	alt: 2,
	shift: 3,
};

/** The card of the n-th action (1-based) in the button editor's main action list. */
function actionCard(page: Page, index: number): Locator {
	return page
		.locator('sd-button-editor sd-action-list')
		.first()
		.locator('.action')
		.nth(index - 1);
}

/** The input whose placeholder starts with the given text; placeholders double as field names. */
function inputWithPlaceholder(scope: Locator, placeholderStart: string): Locator {
	return scope.locator(`input[placeholder^="${placeholderStart}"]`);
}

/** The input of a field whose label starts with the text, such as "Prompt for the program (optional)". */
function labelledInput(page: Page, card: Locator, labelStart: string): Locator {
	return card
		.locator('.field')
		.filter({ has: page.locator('span', { hasText: startsWith(labelStart) }) })
		.locator('input');
}

// Edit mode

Given('I enter edit mode', async ({ page }) => {
	await openMenuEntry(page, 'Edit buttons');
	await expect(page.locator('.bar__done')).toBeVisible();
});

When('I leave edit mode', async ({ page }) => {
	await page.locator('.bar__done').click();
	// Change detection is scheduled; wait until the keys dropped their edit badges before pressing.
	await expect(page.locator('sd-deck sd-deck-key.key--editing')).toHaveCount(0);
	await expect(page.locator('.bar__done')).toHaveCount(0);
});

When('I open the editor for the key {string}', async ({ page }, label: string) => {
	await deckKey(page, label).click();
	await expect(page.locator('sd-button-editor')).toBeVisible();
});

When('I add a new button', async ({ page }) => {
	await deckKey(page, 'Add').click();
	await expect(page.locator('sd-button-editor')).toBeVisible();
});

When(
	'I drag the key {string} onto the key {string}',
	async ({ page }, from: string, to: string) => {
		const start = await centerOf(deckKey(page, from));
		const end = await centerOf(deckKey(page, to));
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		// A small first move starts the drag before heading for the target.
		await page.mouse.move(start.x + 20, start.y + 5, { steps: 3 });
		await page.mouse.move(end.x, end.y, { steps: 8 });
		await page.mouse.up();
	},
);

// The button editor

When('I set the label to {string}', async ({ page }, label: string) => {
	await page.locator('sd-button-editor input[name="label"]').fill(label);
});

When('I pick the color swatch {int}', async ({ page }, index: number) => {
	await page.locator('sd-button-editor .swatches').first().locator('.swatch').nth(index).click();
});

When('I save the button', async ({ page }) => {
	await page.locator('sd-button-editor .footer .primary').click();
	await expect(page.locator('sd-button-editor')).toHaveCount(0);
});

When('I mark the new button as a folder', async ({ page }) => {
	await page.locator('sd-button-editor input[name="asFolder"]').check();
});

When('I enable the toggle state', async ({ page }) => {
	await page.locator('sd-button-editor input[name="toggleEnabled"]').check();
});

When('I set the toggle label to {string}', async ({ page }, label: string) => {
	await page.locator('sd-button-editor input[name="toggleLabel"]').fill(label);
});

When('I move the button forward', async ({ page }) => {
	await page.locator('sd-button-editor .footer button:has(i.ph-arrow-right)').click();
});

Then('the label should still be {string}', async ({ page }, label: string) => {
	await expect(page.locator('sd-button-editor input[name="label"]')).toHaveValue(label);
});

Then('the label should be filled with the app name', async ({ page }) => {
	await expect(page.locator('sd-button-editor input[name="label"]')).not.toHaveValue('');
});

Then('no editor should be open', async ({ page }) => {
	await expect(page.locator('sd-button-editor')).toHaveCount(0);
});

// Actions inside the button editor

When('I add the action {string}', async ({ page }, kind: string) => {
	await page
		.locator('sd-button-editor sd-action-list')
		.first()
		.locator('.add-actions .chip', { hasText: exact(kind) })
		.click();
});

When(
	'I set the hotkey of action {int} to {string} with {string}',
	async ({ page }, index: number, key: string, modifier: string) => {
		const card = actionCard(page, index);
		await card.locator('.modifiers .chip').nth(MODIFIER_INDEX[modifier]).click();
		await inputWithPlaceholder(card, 'Key').fill(key);
	},
);

When(
	'I set the text of action {int} to {string}',
	async ({ page }, index: number, text: string) => {
		await actionCard(page, index).locator('textarea').fill(text);
	},
);

When(
	'I set the command of action {int} to {string}',
	async ({ page }, index: number, command: string) => {
		// Shell actions show the command as a placeholder, terminal actions as a labelled field.
		const card = actionCard(page, index);
		await inputWithPlaceholder(card, 'Command')
			.or(labelledInput(page, card, 'Command'))
			.first()
			.fill(command);
	},
);

When(
	'I set the prompt of action {int} to {string}',
	async ({ page }, index: number, prompt: string) => {
		await labelledInput(page, actionCard(page, index), 'Prompt').fill(prompt);
	},
);

When('I choose a new window for action {int}', async ({ page }, index: number) => {
	await actionCard(page, index).locator('select').selectOption('new');
});

When('I turn off the notification of action {int}', async ({ page }, index: number) => {
	await actionCard(page, index).locator('.check input[type="checkbox"]').uncheck();
});

When('I move action {int} up', async ({ page }, index: number) => {
	await actionCard(page, index).locator('[aria-label="Move up"]').click();
});

// Both the launch target and the hotkey's app to focus use the same "Choose" button and app picker.
When('I choose an installed app for action {int}', async ({ page }, index: number) => {
	await actionCard(page, index).locator('.with-button .secondary').click();
	await page.locator('sd-app-picker .app').first().click();
});

Then('the app to open in action {int} should not be empty', async ({ page }, index: number) => {
	await expect(inputWithPlaceholder(actionCard(page, index), 'App name')).not.toHaveValue('');
});

Then('the app to focus in action {int} should not be empty', async ({ page }, index: number) => {
	await expect(inputWithPlaceholder(actionCard(page, index), 'Focus an app')).not.toHaveValue('');
});

// What the host stored

Then(
	'the button {string} should have the actions {string}',
	async ({ host }, label: string, kinds: string) => {
		const button = await host.buttonLabelled(label);
		expect(button.actions.map((action) => action.kind)).toEqual(parseList(kinds));
	},
);

Then(
	'the action {int} of {string} should run {string} with the prompt {string} in a new window',
	async ({ host }, index: number, label: string, command: string, prompt: string) => {
		const button = await host.buttonLabelled(label);
		expect(button.actions[index - 1]).toMatchObject({ command, prompt, window: 'new' });
	},
);

Then(
	'the action {int} of {string} should be silent',
	async ({ host }, index: number, label: string) => {
		const button = await host.buttonLabelled(label);
		expect(button.actions[index - 1]?.silent).toBe(true);
	},
);
