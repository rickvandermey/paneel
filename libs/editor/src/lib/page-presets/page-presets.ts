import { InstalledApp } from '@sd/host-client';
import { IconRef } from '@sd/protocol';
import { appPresets } from '../app-presets/app-presets';
import { launch, PresetButton, terminal, url } from '../presets/helpers';
import { findPreset } from '../presets/presets';
import { phosphor } from '../shared/icons';
import { isInstalledByExactName, isInstalledByLooseName } from '../shared/installed-apps';
import { isMac } from '../shared/platform';

/** A ready-made page: buttons, look and the apps it belongs to. */
export interface PagePreset {
	id: string;
	name: string;
	description: string;
	icon: IconRef;
	palette: string;
	/** App names the page is about; installed ones make it recommended and set its appMatch. */
	apps: string[];
	buttons: (platform: string, installed: InstalledApp[]) => PresetButton[];
}

export interface RankedPagePreset {
	preset: PagePreset;
	/** Installed apps from the preset's list, in preset order. */
	installed: string[];
}

/** The app lists a page is about; the same list also picks its launch buttons. */
const MUSIC_PLAYERS = ['Spotify', 'Music', 'Tidal', 'Deezer', 'iTunes'];
const CODE_EDITORS = ['Visual Studio Code', 'Cursor', 'Zed', 'WebStorm'];
const BROWSERS = ['Google Chrome', 'Safari', 'Firefox', 'Arc', 'Microsoft Edge', 'Brave Browser'];
const MEETING_APPS = ['zoom.us', 'Microsoft Teams', 'Slack', 'Google Meet', 'Discord', 'FaceTime'];
const WRITING_APPS = ['Notes', 'Pages', 'Microsoft Word', 'Obsidian', 'Notion', 'Bear', 'Ulysses'];
const DESIGN_APPS = [
	'Figma',
	'Sketch',
	'Adobe Photoshop',
	'Adobe Illustrator',
	'Affinity Designer',
	'Pixelmator Pro',
];

/** Standard catalog buttons by label; labels that do not exist on the platform are skipped. */
function standardButtons(platform: string, ...labels: string[]): PresetButton[] {
	return labels
		.map((label) => findPreset(platform, label))
		.filter((button): button is PresetButton => button !== null);
}

/** Launch buttons for the installed apps of a list, falling back to the given name. */
function launchButtonsForInstalled(
	installed: InstalledApp[],
	names: string[],
	fallback?: string,
): PresetButton[] {
	const found = names.filter((name) => isInstalledByLooseName(installed, name));
	if (found.length > 0) {
		return found.map((name) => launch(name, name));
	}
	return fallback ? [launch(fallback, fallback)] : [];
}

/** Shuffle and repeat of the first installed player that has ready-made buttons. */
function playerToggles(platform: string, installed: InstalledApp[]): PresetButton[] {
	const player = appPresets(platform).find(
		(preset) =>
			['spotify', 'music'].includes(preset.id) &&
			isInstalledByExactName(installed, preset.match),
	);
	return player ? player.buttons.filter((button) => button.toggle) : [];
}

export const PAGE_PRESETS: PagePreset[] = [
	{
		id: 'music',
		name: 'Music',
		description: 'Playback and volume, with your player one tap away.',
		icon: phosphor('music-notes'),
		palette: 'berry',
		apps: MUSIC_PLAYERS,
		buttons: (platform, installed) => [
			...standardButtons(
				platform,
				'Previous',
				'Play / Pause',
				'Next',
				'Volume down',
				'Volume up',
				'Mute',
			),
			...playerToggles(platform, installed),
			...launchButtonsForInstalled(
				installed,
				MUSIC_PLAYERS.slice(0, 4),
				isMac(platform) ? 'Music' : 'Spotify',
			),
		],
	},
	{
		id: 'coding',
		name: 'Coding',
		description: 'Editor, terminal sessions and monorepo commands.',
		icon: phosphor('code'),
		palette: 'ocean',
		apps: [...CODE_EDITORS, 'GitHub Desktop', 'iTerm', 'Terminal'],
		buttons: (platform, installed) => [
			...launchButtonsForInstalled(installed, CODE_EDITORS, 'Visual Studio Code'),
			...standardButtons(
				platform,
				'Terminal',
				'Claude',
				'Codex',
				'Nx serve',
				'Nx test',
				'Git status',
				'Git pull',
			),
		],
	},
	{
		id: 'ai',
		name: 'AI',
		description: 'Claude, Codex and the chat sites.',
		icon: phosphor('sparkle'),
		palette: 'lavender',
		apps: ['ChatGPT', 'Claude', 'Ollama'],
		buttons: (platform, installed) => [
			...standardButtons(platform, 'Claude', 'Codex', 'Claude: tests'),
			...launchButtonsForInstalled(installed, ['ChatGPT', 'Claude']),
			url('Claude.ai', 'https://claude.ai'),
			url('ChatGPT', 'https://chatgpt.com'),
			terminal(
				'Claude: review',
				'magnifying-glass',
				'claude',
				'review my uncommitted changes',
			),
		],
	},
	{
		id: 'browsing',
		name: 'Browsing',
		description: 'Tabs, reload and your favorite sites.',
		icon: phosphor('globe'),
		palette: 'lagoon',
		apps: BROWSERS,
		buttons: (platform, installed) => [
			...launchButtonsForInstalled(
				installed,
				BROWSERS,
				isMac(platform) ? 'Safari' : 'msedge',
			),
			...standardButtons(
				platform,
				'New tab',
				'Close tab',
				'Reopen tab',
				'Reload',
				'Back',
				'GitHub',
				'YouTube',
			),
		],
	},
	{
		id: 'meetings',
		name: 'Meetings',
		description: 'Mute, volume and your meeting apps.',
		icon: phosphor('video-camera'),
		palette: 'forest',
		apps: MEETING_APPS,
		buttons: (platform, installed) => [
			...standardButtons(platform, 'Mute', 'Volume down', 'Volume up', 'Screenshot'),
			...launchButtonsForInstalled(
				installed,
				MEETING_APPS.filter((name) => name !== 'Google Meet'),
			),
			url('Meet', 'https://meet.google.com'),
		],
	},
	{
		id: 'writing',
		name: 'Writing',
		description: 'Clipboard, undo and save for documents and notes.',
		icon: phosphor('pencil-line'),
		palette: 'sand',
		apps: WRITING_APPS,
		buttons: (platform, installed) => [
			...standardButtons(
				platform,
				'Copy',
				'Paste',
				'Cut',
				'Undo',
				'Redo',
				'Select all',
				'Save',
				'Find',
			),
			...launchButtonsForInstalled(installed, [
				'Obsidian',
				'Notion',
				'Microsoft Word',
				'Pages',
				'Notes',
				'Bear',
			]),
		],
	},
	{
		id: 'design',
		name: 'Design',
		description: 'Undo, clipboard and your design tools.',
		icon: phosphor('palette'),
		palette: 'sunset',
		apps: DESIGN_APPS,
		buttons: (platform, installed) => [
			...standardButtons(
				platform,
				'Undo',
				'Redo',
				'Copy',
				'Paste',
				'Select all',
				'Screenshot',
			),
			...launchButtonsForInstalled(installed, DESIGN_APPS),
		],
	},
	{
		id: 'system',
		name: 'System',
		description: 'Screen, sound and system shortcuts.',
		icon: phosphor('desktop'),
		palette: 'mono',
		apps: [],
		buttons: (platform) => [
			...standardButtons(
				platform,
				'Screenshot',
				'Lock screen',
				isMac(platform) ? 'Spotlight' : 'Search',
				isMac(platform) ? 'Mission Control' : 'Task view',
				'Brighter',
				'Dimmer',
				'Volume up',
				'Volume down',
				'Settings',
			),
		],
	},
];

/** Presets with an installed app come first, most installed apps on top; the rest keep their order. */
export function rankPagePresets(
	installed: InstalledApp[],
	query = '',
): { recommended: RankedPagePreset[]; others: RankedPagePreset[] } {
	const needle = query.trim().toLowerCase();
	const ranked = PAGE_PRESETS.map((preset) => ({
		preset,
		installed: preset.apps.filter((name) => isInstalledByLooseName(installed, name)),
	})).filter(({ preset }) => !needle || presetMatches(preset, needle));
	const recommended = ranked
		.filter((entry) => entry.installed.length > 0)
		.sort((a, b) => b.installed.length - a.installed.length);
	const others = ranked.filter((entry) => entry.installed.length === 0);
	return { recommended, others };
}

function presetMatches(preset: PagePreset, needle: string): boolean {
	return (
		preset.name.toLowerCase().includes(needle) ||
		preset.description.toLowerCase().includes(needle) ||
		preset.apps.some((name) => name.toLowerCase().includes(needle))
	);
}
