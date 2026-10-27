import { presetGroups } from './presets';

describe('presetGroups', () => {
	it('uses cmd on macOS and ctrl on Windows for editing shortcuts', () => {
		const copyOn = (platform: string) =>
			presetGroups(platform)
				.find((group) => group.name === 'Editing')
				?.buttons.find((button) => button.label === 'Copy')?.actions[0];
		expect(copyOn('darwin')?.modifiers).toEqual(['cmd']);
		expect(copyOn('windows')?.modifiers).toEqual(['ctrl']);
	});

	it('leaves launch and url presets without an icon so the host resolves one', () => {
		for (const group of presetGroups('darwin')) {
			for (const button of group.buttons) {
				const kind = button.actions[0]?.kind;
				if (kind === 'launch' || kind === 'url') {
					expect(button.icon).toBeUndefined();
				} else {
					expect(button.icon).toBeDefined();
				}
			}
		}
	});
});

describe('preset catalog', () => {
	it('has the expected groups on both platforms with unique labels per group', () => {
		for (const platform of ['darwin', 'windows']) {
			const groups = presetGroups(platform);
			expect(groups.map((group) => group.name)).toEqual([
				'Media',
				'System',
				'Window',
				'Editing',
				'Browser',
				'IDE',
				'Coding',
				'Meetings',
				'Apps',
				'Websites',
			]);
			for (const group of groups) {
				const labels = group.buttons.map((button) => button.label);
				expect(new Set(labels).size, `${group.name} on ${platform}`).toBe(labels.length);
				for (const button of group.buttons) {
					const action = button.actions[0];
					expect(action, `${button.label} has an action`).toBeDefined();
					if (action.kind === 'hotkey') {
						expect(action.key, `${button.label} has a key`).not.toBe('');
					}
				}
			}
		}
	});
});
