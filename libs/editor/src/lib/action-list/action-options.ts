import type {
	Action,
	ActionKind,
	AppControl,
	AppControlValue,
	AppId,
	MediaControl,
	Modifier,
	Profile,
	TerminalWindow,
} from '@sd/protocol';
import { isMac } from '../shared/platform';

/** The option lists the action editor offers, in display order. */

export const ACTION_KINDS: { kind: ActionKind; label: string; icon: string }[] = [
	{ kind: 'hotkey', label: 'Hotkey', icon: 'keyboard' },
	{ kind: 'text', label: 'Type text', icon: 'text-aa' },
	{ kind: 'launch', label: 'Open app', icon: 'app-window' },
	{ kind: 'url', label: 'Open URL', icon: 'globe' },
	{ kind: 'terminal', label: 'Run in terminal', icon: 'terminal-window' },
	{ kind: 'shell', label: 'Run silently', icon: 'gear-six' },
	{ kind: 'media', label: 'Media key', icon: 'play-pause' },
	{ kind: 'appControl', label: 'App control', icon: 'music-notes' },
	{ kind: 'delay', label: 'Wait', icon: 'timer' },
	{ kind: 'switchProfile', label: 'Switch page', icon: 'cards' },
];

export const MEDIA_CONTROLS: { control: MediaControl; label: string }[] = [
	{ control: 'playPause', label: 'Play / Pause' },
	{ control: 'next', label: 'Next track' },
	{ control: 'previous', label: 'Previous track' },
	{ control: 'volumeUp', label: 'Volume up' },
	{ control: 'volumeDown', label: 'Volume down' },
	{ control: 'mute', label: 'Mute' },
	{ control: 'brightnessUp', label: 'Brightness up' },
	{ control: 'brightnessDown', label: 'Brightness down' },
];

/** Apps an appControl action can drive; Apple Music only exists on macOS. */
export const APP_IDS: { app: AppId; label: string; macOnly?: boolean }[] = [
	{ app: 'spotify', label: 'Spotify' },
	{ app: 'music', label: 'Apple Music', macOnly: true },
];

export const APP_CONTROLS: { control: AppControl; label: string; twoState: boolean }[] = [
	{ control: 'shuffle', label: 'Shuffle', twoState: true },
	{ control: 'repeat', label: 'Repeat', twoState: true },
	{ control: 'playPause', label: 'Play / Pause', twoState: false },
	{ control: 'next', label: 'Next track', twoState: false },
	{ control: 'previous', label: 'Previous track', twoState: false },
];

export const APP_VALUES: { value: AppControlValue; label: string }[] = [
	{ value: 'toggle', label: 'Toggle' },
	{ value: 'on', label: 'Switch on' },
	{ value: 'off', label: 'Switch off' },
];

export const TERMINAL_WINDOWS: { value: TerminalWindow; label: string }[] = [
	{ value: 'reuse', label: 'Reuse what is open (editor terminal or terminal window)' },
	{ value: 'new', label: 'Always open a new terminal window' },
];

export const MODIFIERS: Modifier[] = ['cmd', 'ctrl', 'alt', 'shift'];

const DEFAULT_DELAY_MS = 500;

export function appIdsFor(platform: string): typeof APP_IDS {
	return APP_IDS.filter((entry) => !entry.macOnly || isMac(platform));
}

/** The modifier names as the platform's keyboard prints them. */
export function modifierLabels(platform: string): Record<Modifier, string> {
	return isMac(platform)
		? { cmd: '⌘ Cmd', ctrl: '⌃ Ctrl', alt: '⌥ Opt', shift: '⇧ Shift' }
		: { cmd: 'Win', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' };
}

export function actionKindLabel(kind: ActionKind): string {
	return ACTION_KINDS.find((entry) => entry.kind === kind)?.label ?? kind;
}

/** Shuffle and repeat take a value; playback controls do not. */
export function isTwoStateControl(action: Action): boolean {
	return APP_CONTROLS.find((entry) => entry.control === action.control)?.twoState ?? false;
}

/** A freshly added action with sensible values, so every select starts on a valid option. */
export function defaultActionFor(kind: ActionKind, profiles: Profile[]): Action {
	switch (kind) {
		case 'delay':
			return { kind, millis: DEFAULT_DELAY_MS };
		case 'media':
			return { kind, control: 'playPause' };
		case 'appControl':
			return { kind, app: 'spotify', control: 'shuffle', value: 'toggle' };
		case 'switchProfile':
			return { kind, profileId: profiles[0]?.id };
		default:
			return { kind };
	}
}
