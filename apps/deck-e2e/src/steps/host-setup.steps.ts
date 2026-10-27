import { expect } from '@playwright/test';
import type { Settings } from '@sd/protocol';
import { Given } from './fixtures';
import { deckKey, exact, keyIn, openMenuEntry, pressKey, sheetCloseButton } from './helpers';

// Givens that prepare data through the host, the way a second deck would, instead of through the UI.

Given('a blank page {string} exists', async ({ host, page }, name: string) => {
	const id = `page-${name.toLowerCase().replace(/\s+/g, '-')}`;
	await host.sendCommand({ type: 'profile.create', profile: { id, name } });
	await expect(page.locator('.chip', { hasText: exact(name) })).toBeVisible();
});

Given(
	'the page {string} has {int} extra buttons',
	async ({ host, page }, pageName: string, count: number) => {
		for (let index = 0; index < count; index++) {
			await host.addButtonToPage(pageName, {
				id: `extra-${index}`,
				label: `Extra ${index + 1}`,
			});
		}
		await expect(deckKey(page, `Extra ${count}`)).toHaveCount(1);
	},
);

Given(
	'the page {string} has a folder {string} containing {string}',
	async ({ host, page }, pageName: string, folder: string, child: string) => {
		await host.addButtonToPage(pageName, { id: 'folder-e2e', label: folder, folder: [] });
		await host.addButtonToFolder('folder-e2e', {
			id: 'folder-child-e2e',
			label: child,
			color: '#1d4ed8',
		});
		await expect(deckKey(page, folder)).toBeVisible();
	},
);

Given(
	'the page {string} has a repeat button {string}',
	async ({ host, page }, pageName: string, label: string) => {
		await host.addButtonToPage(pageName, {
			id: 'repeat-e2e',
			label,
			repeat: true,
			actions: [{ kind: 'delay', millis: 1 }],
		});
		await expect(deckKey(page, label)).toBeVisible();
	},
);

Given(
	'the page {string} has a launch button for the focused app',
	async ({ host, page }, pageName: string) => {
		const app = await host.activeApp();
		expect(app, 'the host reports a focused app').not.toBeNull();
		await host.addButtonToPage(pageName, {
			id: 'launch-focused',
			label: 'Focused',
			actions: [{ kind: 'launch', target: app?.name }],
		});
		// Smart pages may switch away from the page as soon as the button exists.
		await expect(
			deckKey(page, 'Focused').or(page.locator('.chip', { hasText: exact(pageName) })),
		).toBeVisible();
	},
);

Given('the smart pages mode is {string}', async ({ host }, mode: string) => {
	await host.sendCommand({
		type: 'settings.update',
		patch: { smartPages: mode as Settings['smartPages'] },
	});
});

Given('the standard button {string} is added to the page', async ({ page }, label: string) => {
	await openMenuEntry(page, 'Add standard buttons');
	await pressKey(keyIn(page, 'sd-catalog', label).first());
	await sheetCloseButton(page).click();
	await expect(deckKey(page, label)).toBeVisible();
});
