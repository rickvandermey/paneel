import { Action, Button, MediaControl, Modifier } from '@sd/protocol';
import { phosphor } from '../shared/icons';

export { phosphor } from '../shared/icons';
export { type Platform, platformOf } from '../shared/platform';

/** A button without an id; the shell assigns one when the preset is added. */
export type PresetButton = Omit<Button, 'id'>;

export interface PresetGroup {
	name: string;
	description: string;
	buttons: PresetButton[];
}

/** Default colors per kind of preset, so a catalog page reads as groups at a glance. */
export const MEDIA_COLOR = '#6d28d9';
export const LAUNCH_COLOR = '#374151';
export const URL_COLOR = '#1f2937';
export const TERMINAL_COLOR = '#b45309';

/** A preset rendered as a key in a catalog; the index keeps the ids unique within the list. */
export function presetPreview(preset: PresetButton, index: number): Button {
	return { id: `preset-${index}`, ...preset };
}

export function media(label: string, icon: string, control: MediaControl): PresetButton {
	return {
		label,
		showLabel: true,
		color: MEDIA_COLOR,
		icon: phosphor(icon),
		actions: [{ kind: 'media', control }],
	};
}

export function hotkey(
	label: string,
	icon: string,
	color: string,
	key: string,
	modifiers: Action['modifiers'],
	target?: string,
): PresetButton {
	const action: Action = { kind: 'hotkey', key, modifiers };
	if (target) {
		action.target = target;
	}
	return { label, showLabel: true, color, icon: phosphor(icon), actions: [action] };
}

/** Launch presets carry no icon so the host resolves the real app icon. */
export function launch(label: string, target: string): PresetButton {
	return {
		label,
		showLabel: true,
		color: LAUNCH_COLOR,
		actions: [{ kind: 'launch', target }],
	};
}

export function url(label: string, address: string): PresetButton {
	return {
		label,
		showLabel: true,
		color: URL_COLOR,
		actions: [{ kind: 'url', url: address }],
	};
}

/** Types a line into the active window and presses Enter, for commands in an open session. */
export function typed(label: string, icon: string, color: string, text: string): PresetButton {
	return {
		label,
		showLabel: true,
		color,
		icon: phosphor(icon),
		actions: [
			{ kind: 'text', text },
			{ kind: 'hotkey', key: 'enter', modifiers: [] },
		],
	};
}

/** A terminal button; the prompt is what the program gets, e.g. what Claude is asked to do. */
export function terminal(
	label: string,
	icon: string,
	command: string,
	prompt?: string,
): PresetButton {
	return {
		label,
		showLabel: true,
		color: TERMINAL_COLOR,
		icon: phosphor(icon),
		actions: [prompt ? { kind: 'terminal', command, prompt } : { kind: 'terminal', command }],
	};
}

/** One entry per platform: the macOS key and modifiers first, then the Windows and Linux ones. */
export type HotkeyEntry = [
	label: string,
	icon: string,
	macKey: string,
	macMods: Modifier[],
	winKey: string,
	winMods: Modifier[],
];

export function hotkeys(
	mac: boolean,
	color: string,
	entries: HotkeyEntry[],
	target?: string,
): PresetButton[] {
	return entries.map(([label, icon, macKey, macMods, winKey, winMods]) =>
		mac
			? hotkey(label, icon, color, macKey, macMods, target)
			: hotkey(label, icon, color, winKey, winMods, target),
	);
}
