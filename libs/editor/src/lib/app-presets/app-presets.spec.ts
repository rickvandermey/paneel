import { isInstalledByExactName } from '../shared/installed-apps';
import { appPresets, findAppPreset, meetingButtons } from './app-presets';

describe('appPresets', () => {
	it('offers Apple Music on macOS only', () => {
		expect(appPresets('darwin').map((preset) => preset.id)).toEqual([
			'spotify',
			'music',
			'zoom',
			'teams',
			'meet',
			'discord',
			'claude',
			'vscode',
			'slack',
			'cursor',
			'jetbrains',
			'github-desktop',
			'notion',
			'obsidian',
			'outlook',
			'figma',
			'photoshop',
			'lightroom',
			'resolve',
			'youtube',
		]);
		expect(appPresets('windows').map((preset) => preset.id)).not.toContain('music');
	});

	it('makes shuffle and repeat two-state buttons that switch on and then off', () => {
		const shuffle = findAppPreset('darwin', 'spotify')?.buttons.find(
			(button) => button.label === 'Shuffle',
		);
		expect(shuffle?.actions).toEqual([
			{ kind: 'appControl', app: 'spotify', control: 'shuffle', value: 'on' },
		]);
		expect(shuffle?.toggle?.actions).toEqual([
			{ kind: 'appControl', app: 'spotify', control: 'shuffle', value: 'off' },
		]);
	});

	it('focuses the app before a hotkey, with the platform name of the app', () => {
		const mute = (platform: string) =>
			findAppPreset(platform, 'zoom')?.buttons.find((button) => button.label === 'Mute')
				?.actions[0];
		expect(mute('darwin')).toEqual({
			kind: 'hotkey',
			key: 'a',
			modifiers: ['cmd', 'shift'],
			target: 'zoom.us',
		});
		expect(mute('windows')).toEqual({
			kind: 'hotkey',
			key: 'a',
			modifiers: ['alt'],
			target: 'Zoom',
		});
	});

	it('leaves Google Meet hotkeys without a target because it runs in the browser', () => {
		for (const button of findAppPreset('darwin', 'meet')?.buttons ?? []) {
			expect(button.actions[0]?.target).toBeUndefined();
		}
	});

	it('prefixes the meeting hotkeys with the app for the standard catalog', () => {
		const labels = meetingButtons('darwin').map((button) => button.label);
		expect(labels).toContain('Zoom mute');
		expect(labels).toContain('Teams raise hand');
		expect(labels).toContain('Meet camera');
		expect(labels.some((label) => label?.startsWith('Open'))).toBe(false);
		expect(new Set(labels).size).toBe(labels.length);
	});
});

describe('Claude app buttons', () => {
	it('types slash commands into the focused session and presses Enter', () => {
		const review = findAppPreset('darwin', 'claude')?.buttons.find(
			(button) => button.label === '/code-review',
		);
		expect(review?.actions).toEqual([
			{ kind: 'text', text: '/code-review' },
			{ kind: 'hotkey', key: 'enter', modifiers: [] },
		]);
	});

	it('starts Remote Control in a terminal', () => {
		const remote = findAppPreset('windows', 'claude')?.buttons.find(
			(button) => button.label === 'Remote Control',
		);
		expect(remote?.actions[0]).toEqual({
			kind: 'terminal',
			command: 'claude --remote-control',
		});
	});
});

describe('VS Code app buttons', () => {
	it('shares its shortcuts with the IDE group, adding the target', () => {
		const inApp = findAppPreset('darwin', 'vscode')?.buttons.find(
			(button) => button.label === 'Command palette',
		);
		expect(inApp?.actions[0]).toEqual({
			kind: 'hotkey',
			key: 'p',
			modifiers: ['cmd', 'shift'],
			target: 'Visual Studio Code',
		});
	});
});

describe('every app preset', () => {
	it('has unique labels, an action per button and a key per hotkey', () => {
		for (const platform of ['darwin', 'windows', 'linux']) {
			for (const preset of appPresets(platform)) {
				const labels = preset.buttons.map((button) => button.label);
				expect(new Set(labels).size, `${preset.id} on ${platform}`).toBe(labels.length);
				for (const button of preset.buttons) {
					expect(button.actions.length, `${preset.id}: ${button.label}`).toBeGreaterThan(
						0,
					);
					if (button.actions[0].kind === 'hotkey') {
						expect(button.actions[0].key, `${preset.id}: ${button.label}`).toBeTruthy();
					}
				}
			}
		}
	});
});

describe('isInstalledByExactName', () => {
	it('accepts exact and versioned names but not look-alikes', () => {
		const installed = [{ name: 'Photos' }, { name: 'Adobe Photoshop 2025' }, { name: 'Xcode' }];
		expect(isInstalledByExactName(installed, ['Adobe Photoshop', 'Photoshop'])).toBe(true);
		expect(isInstalledByExactName([{ name: 'Photos' }], ['Photoshop'])).toBe(false);
		expect(isInstalledByExactName(installed, ['Visual Studio Code'])).toBe(false);
	});
});
