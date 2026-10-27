import { expect } from '@playwright/test';
import { Then } from './fixtures';
import { parseList } from './helpers';

// These steps read the actions the dry-run host recorded instead of executing (see host-api.ts).

/** "spotify shuffle on, spotify shuffle off": the app controls the host ran, in order. */
Then('the host should have run the app controls {string}', async ({ host }, list: string) => {
	await expect
		.poll(() =>
			host
				.recordedActions()
				.filter((action) => action.kind === 'appControl')
				.map((action) =>
					[action.app, action.control, action.value].filter(Boolean).join(' '),
				),
		)
		.toEqual(parseList(list));
});

Then(
	'the host should have run the hotkey {string} with {string} in {string}',
	async ({ host }, key: string, modifiers: string, target: string) => {
		await expect
			.poll(() =>
				host
					.recordedActions()
					.filter((action) => action.kind === 'hotkey')
					.map((action) => ({
						key: action.key,
						modifiers: (action.modifiers ?? []).join(', '),
						target: action.target ?? '',
					})),
			)
			.toContainEqual({ key, modifiers, target });
	},
);

Then('the recorded script should contain {string}', async ({ host }, text: string) => {
	await expect
		.poll(() => host.recordedActions().some((action) => action.script?.includes(text)))
		.toBe(true);
});

Then('the host should have run the actions {string}', async ({ host }, kinds: string) => {
	await expect
		.poll(() => host.recordedActions().map((action) => action.kind))
		.toEqual(parseList(kinds));
});

Then('the host should have typed {string}', async ({ host }, text: string) => {
	await expect
		.poll(() => host.recordedActions().some((action) => action.text === text))
		.toBe(true);
});
