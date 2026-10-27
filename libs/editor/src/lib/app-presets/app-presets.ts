import { AppControl, AppControlValue, AppId, IconRef } from '@sd/protocol';
import {
	hotkeys,
	launch,
	phosphor,
	Platform,
	platformOf,
	PresetButton,
	terminal,
	typed,
	url,
} from '../presets/helpers';
import { isMac } from '../shared/platform';

const IDE_COLOR = '#1d4ed8';

/** The VS Code shortcuts; the standard catalog shows them without a target, the app with one. */
export function vscodeButtons(platformName: string | undefined, target?: string): PresetButton[] {
	const mac = isMac(platformName);
	return hotkeys(
		mac,
		IDE_COLOR,
		[
			['Command palette', 'terminal', 'p', ['cmd', 'shift'], 'p', ['ctrl', 'shift']],
			['Go to file', 'file-magnifying-glass', 'p', ['cmd'], 'p', ['ctrl']],
			['Find in files', 'files', 'f', ['cmd', 'shift'], 'f', ['ctrl', 'shift']],
			['Toggle terminal', 'terminal-window', '`', ['ctrl'], '`', ['ctrl']],
			['Toggle sidebar', 'sidebar-simple', 'b', ['cmd'], 'b', ['ctrl']],
			['Format file', 'magic-wand', 'f', ['shift', 'alt'], 'f', ['shift', 'alt']],
			['Comment line', 'chat-text', '/', ['cmd'], '/', ['ctrl']],
			['Rename symbol', 'pencil-simple-line', 'f2', [], 'f2', []],
			['Go to definition', 'arrow-square-out', 'f12', [], 'f12', []],
			['Split editor', 'columns', '\\', ['cmd'], '\\', ['ctrl']],
			['Problems', 'warning', 'm', ['cmd', 'shift'], 'm', ['ctrl', 'shift']],
			['Source control', 'git-branch', 'g', ['ctrl', 'shift'], 'g', ['ctrl', 'shift']],
		],
		target,
	);
}

/** The ready-made buttons of one application. */
export interface AppPreset {
	id: string;
	name: string;
	/** Used as prefix when the buttons appear outside the app's own group ("Zoom mute"). */
	shortName: string;
	description: string;
	icon: IconRef;
	/** Names the app goes by on the host, for the installed check. */
	match: string[];
	buttons: PresetButton[];
}

function appControl(
	label: string,
	icon: string,
	color: string,
	app: AppId,
	control: AppControl,
	value?: AppControlValue,
): PresetButton {
	return {
		label,
		showLabel: true,
		color,
		icon: phosphor(icon),
		actions: [{ kind: 'appControl', app, control, ...(value ? { value } : {}) }],
	};
}

/** Two-state button: the first press switches the control on, the next one off. */
function appToggle(
	label: string,
	icon: string,
	color: string,
	app: AppId,
	control: 'shuffle' | 'repeat',
): PresetButton {
	return {
		...appControl(label, icon, color, app, control, 'on'),
		toggle: { actions: [{ kind: 'appControl', app, control, value: 'off' }] },
	};
}

function player(
	app: AppId,
	target: string,
	color: string,
	extra: PresetButton[] = [],
): PresetButton[] {
	return [
		appToggle('Shuffle', 'shuffle', color, app, 'shuffle'),
		appToggle('Repeat', 'repeat', color, app, 'repeat'),
		appControl('Play / Pause', 'play-pause', color, app, 'playPause'),
		appControl('Next', 'skip-forward', color, app, 'next'),
		appControl('Previous', 'skip-back', color, app, 'previous'),
		...extra,
		launch(`Open ${target}`, target),
	];
}

function build(platform: Platform): AppPreset[] {
	const mac = isMac(platform);
	const spotify = '#15803d';
	const music = '#dc2626';
	const zoom = '#2563eb';
	const teams = '#4f46e5';
	const meet = '#0f766e';
	const discord = '#4f46e5';
	const claude = '#b45309';
	const slack = '#7c3aed';
	const cursor = '#1d4ed8';
	const jetbrains = '#be185d';
	const github = '#374151';
	const notion = '#1f2937';
	const obsidian = '#6d28d9';
	const outlook = '#0369a1';
	const figma = '#c026d3';
	const photoshop = '#0284c7';
	const lightroom = '#1e40af';
	const resolve = '#b45309';
	const youtube = '#dc2626';
	const zoomTarget = mac ? 'zoom.us' : 'Zoom';

	const presets: AppPreset[] = [
		{
			id: 'spotify',
			name: 'Spotify',
			shortName: 'Spotify',
			description: 'Shuffle, repeat and playback of the desktop app, focused or not.',
			icon: phosphor('spotify-logo'),
			match: ['Spotify'],
			buttons: player(
				'spotify',
				'Spotify',
				spotify,
				hotkeys(
					mac,
					spotify,
					[
						['Like', 'heart', 'b', ['alt', 'shift'], 'b', ['alt', 'shift']],
						['Search', 'magnifying-glass', 'l', ['cmd'], 'l', ['ctrl']],
					],
					'Spotify',
				),
			),
		},
	];
	if (mac) {
		presets.push({
			id: 'music',
			name: 'Apple Music',
			shortName: 'Music',
			description: 'Shuffle, repeat and playback of the Music app.',
			icon: phosphor('apple-logo'),
			match: ['Music', 'iTunes'],
			buttons: player('music', 'Music', music),
		});
	}
	presets.push(
		{
			id: 'zoom',
			name: 'Zoom',
			shortName: 'Zoom',
			description: 'Mute, camera and screen sharing in a meeting.',
			icon: phosphor('video-camera'),
			match: ['zoom.us', 'Zoom'],
			buttons: [
				...hotkeys(
					mac,
					zoom,
					[
						['Mute', 'microphone-slash', 'a', ['cmd', 'shift'], 'a', ['alt']],
						['Camera', 'video-camera-slash', 'v', ['cmd', 'shift'], 'v', ['alt']],
						['Share', 'monitor-arrow-up', 's', ['cmd', 'shift'], 's', ['alt']],
					],
					zoomTarget,
				),
				launch('Open Zoom', zoomTarget),
			],
		},
		{
			id: 'teams',
			name: 'Microsoft Teams',
			shortName: 'Teams',
			description: 'Mute, camera and raising your hand in a call.',
			icon: phosphor('users-three'),
			match: ['Microsoft Teams', 'Teams'],
			buttons: [
				...hotkeys(
					mac,
					teams,
					[
						['Mute', 'microphone-slash', 'm', ['cmd', 'shift'], 'm', ['ctrl', 'shift']],
						[
							'Camera',
							'video-camera-slash',
							'o',
							['cmd', 'shift'],
							'o',
							['ctrl', 'shift'],
						],
						['Raise hand', 'hand', 'k', ['cmd', 'shift'], 'k', ['ctrl', 'shift']],
					],
					'Microsoft Teams',
				),
				launch('Open Teams', 'Microsoft Teams'),
			],
		},
		{
			id: 'meet',
			name: 'Google Meet',
			shortName: 'Meet',
			description: 'Mute and camera in the browser tab that has the focus.',
			icon: phosphor('video-conference'),
			match: [],
			buttons: [
				...hotkeys(mac, meet, [
					['Mute', 'microphone-slash', 'd', ['cmd'], 'd', ['ctrl']],
					['Camera', 'video-camera-slash', 'e', ['cmd'], 'e', ['ctrl']],
					['Raise hand', 'hand', 'h', ['cmd', 'ctrl'], 'h', ['ctrl', 'alt']],
				]),
				url('Open Meet', 'https://meet.google.com'),
			],
		},
		{
			id: 'discord',
			name: 'Discord',
			shortName: 'Discord',
			description: 'Mute and deafen in a voice channel.',
			icon: phosphor('discord-logo'),
			match: ['Discord'],
			buttons: [
				...hotkeys(
					mac,
					discord,
					[
						['Mute', 'microphone-slash', 'm', ['cmd', 'shift'], 'm', ['ctrl', 'shift']],
						['Deafen', 'speaker-slash', 'd', ['cmd', 'shift'], 'd', ['ctrl', 'shift']],
					],
					'Discord',
				),
				launch('Open Discord', 'Discord'),
			],
		},
		{
			id: 'claude',
			name: 'Claude',
			shortName: 'Claude',
			description:
				'The desktop app, Claude Code sessions in a terminal, and commands typed into the session that has the focus.',
			icon: phosphor('sparkle'),
			match: ['Claude'],
			buttons: [
				...hotkeys(
					mac,
					claude,
					[['New chat', 'chat-circle', 'n', ['cmd'], 'n', ['ctrl']]],
					'Claude',
				),
				...hotkeys(mac, claude, [
					['Quick ask', 'lightning', 'space', ['alt'], 'space', ['ctrl', 'alt']],
				]),
				terminal('Claude Code', 'terminal-window', 'claude'),
				terminal('Remote Control', 'device-mobile', 'claude --remote-control'),
				terminal('Continue session', 'arrow-counter-clockwise', 'claude --continue'),
				terminal('MCP servers', 'plugs-connected', 'claude mcp list'),
				terminal('Doctor', 'stethoscope', 'claude doctor'),
				typed('/mcp', 'plugs', claude, '/mcp'),
				typed('/compact', 'arrows-in-line-vertical', claude, '/compact'),
				typed('/clear', 'broom', claude, '/clear'),
				typed('/code-review', 'magnifying-glass', claude, '/code-review'),
				typed('/simplify', 'sparkle', claude, '/simplify'),
				typed('/security-review', 'shield-check', claude, '/security-review'),
				launch('Open Claude', 'Claude'),
			],
		},
		{
			id: 'vscode',
			name: 'Visual Studio Code',
			shortName: 'VS Code',
			description:
				'Palette, terminal, format and navigation, with the editor brought to the front.',
			icon: phosphor('code'),
			match: ['Visual Studio Code'],
			buttons: [
				...vscodeButtons(platform, 'Visual Studio Code'),
				launch('Open VS Code', 'Visual Studio Code'),
			],
		},
		{
			id: 'slack',
			name: 'Slack',
			shortName: 'Slack',
			description: 'Huddle mute, switching and search.',
			icon: phosphor('slack-logo'),
			match: ['Slack'],
			buttons: [
				...hotkeys(
					mac,
					slack,
					[
						[
							'Huddle mute',
							'microphone-slash',
							'space',
							['cmd', 'shift'],
							'space',
							['ctrl', 'shift'],
						],
						['Quick switcher', 'lightning', 'k', ['cmd'], 'k', ['ctrl']],
						['Search', 'magnifying-glass', 'g', ['cmd'], 'g', ['ctrl']],
						['Mark all read', 'checks', 'escape', ['shift'], 'escape', ['shift']],
					],
					'Slack',
				),
				launch('Open Slack', 'Slack'),
			],
		},
		{
			id: 'cursor',
			name: 'Cursor',
			shortName: 'Cursor',
			description: 'The VS Code shortcuts plus the AI chat, composer and inline edit.',
			icon: phosphor('cursor'),
			match: ['Cursor'],
			buttons: [
				...hotkeys(
					mac,
					cursor,
					[
						['AI chat', 'chat-circle-dots', 'l', ['cmd'], 'l', ['ctrl']],
						['Composer', 'sparkle', 'i', ['cmd'], 'i', ['ctrl']],
						['Inline edit', 'pencil-simple-line', 'k', ['cmd'], 'k', ['ctrl']],
					],
					'Cursor',
				),
				...vscodeButtons(platform, 'Cursor'),
				launch('Open Cursor', 'Cursor'),
			],
		},
		{
			id: 'jetbrains',
			name: 'JetBrains IDEs',
			shortName: 'JetBrains',
			description:
				'WebStorm, IntelliJ, PyCharm, Android Studio and friends; press with the IDE in front.',
			icon: phosphor('code-block'),
			match: [
				'WebStorm',
				'IntelliJ IDEA',
				'PyCharm',
				'Android Studio',
				'GoLand',
				'PhpStorm',
				'Rider',
				'CLion',
				'RubyMine',
				'DataGrip',
			],
			buttons: hotkeys(mac, jetbrains, [
				['Find action', 'magnifying-glass', 'a', ['cmd', 'shift'], 'a', ['ctrl', 'shift']],
				[
					'Go to file',
					'file-magnifying-glass',
					'o',
					['cmd', 'shift'],
					'n',
					['ctrl', 'shift'],
				],
				['Recent files', 'clock-counter-clockwise', 'e', ['cmd'], 'e', ['ctrl']],
				['Run', 'play', 'r', ['ctrl'], 'f10', ['shift']],
				['Debug', 'bug', 'd', ['ctrl'], 'f9', ['shift']],
				['Reformat', 'magic-wand', 'l', ['cmd', 'alt'], 'l', ['ctrl', 'alt']],
				['Rename', 'pencil-simple-line', 'f6', ['shift'], 'f6', ['shift']],
				['Terminal', 'terminal-window', 'f12', ['alt'], 'f12', ['alt']],
				['Commit', 'git-commit', 'k', ['cmd'], 'k', ['ctrl']],
				['Push', 'cloud-arrow-up', 'k', ['cmd', 'shift'], 'k', ['ctrl', 'shift']],
			]),
		},
		{
			id: 'github-desktop',
			name: 'GitHub Desktop',
			shortName: 'GitHub Desktop',
			description: 'Commit, push, pull and fetch without leaving your editor.',
			icon: phosphor('github-logo'),
			match: ['GitHub Desktop'],
			buttons: [
				...hotkeys(
					mac,
					github,
					[
						['Commit', 'git-commit', 'enter', ['cmd'], 'enter', ['ctrl']],
						['Push', 'cloud-arrow-up', 'p', ['cmd'], 'p', ['ctrl']],
						['Pull', 'cloud-arrow-down', 'p', ['cmd', 'shift'], 'p', ['ctrl', 'shift']],
						[
							'Fetch',
							'arrows-clockwise',
							't',
							['cmd', 'shift'],
							't',
							['ctrl', 'shift'],
						],
						['Branches', 'git-branch', 'b', ['cmd'], 'b', ['ctrl']],
					],
					'GitHub Desktop',
				),
				launch('Open GitHub Desktop', 'GitHub Desktop'),
			],
		},
		{
			id: 'notion',
			name: 'Notion',
			shortName: 'Notion',
			description: 'Find, create and navigate pages.',
			icon: phosphor('notion-logo'),
			match: ['Notion'],
			buttons: [
				...hotkeys(
					mac,
					notion,
					[
						['Quick find', 'magnifying-glass', 'p', ['cmd'], 'p', ['ctrl']],
						['New page', 'file-plus', 'n', ['cmd'], 'n', ['ctrl']],
						['Toggle sidebar', 'sidebar-simple', '\\', ['cmd'], '\\', ['ctrl']],
						['Back', 'arrow-left', '[', ['cmd'], '[', ['ctrl']],
					],
					'Notion',
				),
				launch('Open Notion', 'Notion'),
			],
		},
		{
			id: 'obsidian',
			name: 'Obsidian',
			shortName: 'Obsidian',
			description: 'Switch, search and create notes.',
			icon: phosphor('notebook'),
			match: ['Obsidian'],
			buttons: [
				...hotkeys(
					mac,
					obsidian,
					[
						['Quick switcher', 'lightning', 'o', ['cmd'], 'o', ['ctrl']],
						['Command palette', 'terminal', 'p', ['cmd'], 'p', ['ctrl']],
						['New note', 'file-plus', 'n', ['cmd'], 'n', ['ctrl']],
						[
							'Search',
							'magnifying-glass',
							'f',
							['cmd', 'shift'],
							'f',
							['ctrl', 'shift'],
						],
					],
					'Obsidian',
				),
				launch('Open Obsidian', 'Obsidian'),
			],
		},
		{
			id: 'outlook',
			name: 'Outlook',
			shortName: 'Outlook',
			description: 'Mail and calendar.',
			icon: phosphor('envelope'),
			match: ['Microsoft Outlook', 'Outlook'],
			buttons: [
				...hotkeys(
					mac,
					outlook,
					[
						['New mail', 'envelope-simple', 'n', ['cmd'], 'n', ['ctrl']],
						['Send', 'paper-plane-tilt', 'enter', ['cmd'], 'enter', ['ctrl']],
						['Reply', 'arrow-bend-up-left', 'r', ['cmd'], 'r', ['ctrl']],
						[
							'Reply all',
							'arrow-bend-double-up-left',
							'r',
							['cmd', 'shift'],
							'r',
							['ctrl', 'shift'],
						],
						['Mail', 'tray', '1', ['cmd'], '1', ['ctrl']],
						['Calendar', 'calendar', '2', ['cmd'], '2', ['ctrl']],
					],
					mac ? 'Microsoft Outlook' : 'Outlook',
				),
				launch('Open Outlook', mac ? 'Microsoft Outlook' : 'Outlook'),
			],
		},
		{
			id: 'figma',
			name: 'Figma',
			shortName: 'Figma',
			description: 'Tools, zoom and export.',
			icon: phosphor('figma-logo'),
			match: ['Figma'],
			buttons: [
				...hotkeys(
					mac,
					figma,
					[
						['Move', 'cursor', 'v', [], 'v', []],
						['Frame', 'frame-corners', 'f', [], 'f', []],
						['Rectangle', 'rectangle', 'r', [], 'r', []],
						['Text', 'text-t', 't', [], 't', []],
						['Comment', 'chat-circle', 'c', [], 'c', []],
						['Zoom to fit', 'arrows-out', '1', ['shift'], '1', ['shift']],
						[
							'Zoom to selection',
							'magnifying-glass-plus',
							'2',
							['shift'],
							'2',
							['shift'],
						],
						['Export', 'export', 'e', ['cmd', 'shift'], 'e', ['ctrl', 'shift']],
					],
					'Figma',
				),
				launch('Open Figma', 'Figma'),
			],
		},
		{
			id: 'photoshop',
			name: 'Photoshop',
			shortName: 'Photoshop',
			description: 'Tools and layers; press with Photoshop in front.',
			icon: phosphor('image'),
			match: ['Adobe Photoshop', 'Photoshop'],
			buttons: hotkeys(mac, photoshop, [
				['Move', 'cursor', 'v', [], 'v', []],
				['Brush', 'paint-brush', 'b', [], 'b', []],
				['Eraser', 'eraser', 'e', [], 'e', []],
				['Lasso', 'lasso', 'l', [], 'l', []],
				['Crop', 'crop', 'c', [], 'c', []],
				['Undo', 'arrow-u-up-left', 'z', ['cmd'], 'z', ['ctrl']],
				['New layer', 'stack-plus', 'n', ['cmd', 'shift'], 'n', ['ctrl', 'shift']],
				['Fit on screen', 'arrows-out', '0', ['cmd'], '0', ['ctrl']],
			]),
		},
		{
			id: 'lightroom',
			name: 'Lightroom Classic',
			shortName: 'Lightroom',
			description: 'Rate, flag and compare; press with Lightroom in front.',
			icon: phosphor('aperture'),
			match: ['Lightroom'],
			buttons: hotkeys(mac, lightroom, [
				['1 star', 'star', '1', [], '1', []],
				['2 stars', 'star', '2', [], '2', []],
				['3 stars', 'star', '3', [], '3', []],
				['4 stars', 'star', '4', [], '4', []],
				['5 stars', 'star', '5', [], '5', []],
				['Flag', 'flag', 'p', [], 'p', []],
				['Reject', 'x-circle', 'x', [], 'x', []],
				['Unflag', 'flag-pennant', 'u', [], 'u', []],
				['Before / After', 'arrows-left-right', '\\', [], '\\', []],
				['Library', 'squares-four', 'g', [], 'g', []],
				['Develop', 'sliders-horizontal', 'd', [], 'd', []],
			]),
		},
		{
			id: 'resolve',
			name: 'DaVinci Resolve',
			shortName: 'Resolve',
			description: 'Editing on the timeline; press with Resolve in front.',
			icon: phosphor('film-slate'),
			match: ['DaVinci Resolve'],
			buttons: hotkeys(mac, resolve, [
				['Play / Pause', 'play-pause', 'space', [], 'space', []],
				['Mark in', 'arrow-line-right', 'i', [], 'i', []],
				['Mark out', 'arrow-line-left', 'o', [], 'o', []],
				['Marker', 'bookmark-simple', 'm', [], 'm', []],
				['Blade', 'scissors', 'b', ['cmd'], 'b', ['ctrl']],
				['Undo', 'arrow-u-up-left', 'z', ['cmd'], 'z', ['ctrl']],
				['Zoom to fit', 'arrows-out', 'z', ['shift'], 'z', ['shift']],
			]),
		},
		{
			id: 'youtube',
			name: 'YouTube',
			shortName: 'YouTube',
			description: 'Playback in the browser tab that has the focus.',
			icon: phosphor('youtube-logo'),
			match: [],
			buttons: [
				...hotkeys(mac, youtube, [
					['Play / Pause', 'play-pause', 'k', [], 'k', []],
					['Forward 10s', 'fast-forward', 'l', [], 'l', []],
					['Back 10s', 'rewind', 'j', [], 'j', []],
					['Fullscreen', 'corners-out', 'f', [], 'f', []],
					['Theater', 'monitor', 't', [], 't', []],
					['Mute', 'speaker-slash', 'm', [], 'm', []],
					['Captions', 'closed-captioning', 'c', [], 'c', []],
				]),
				url('Open YouTube', 'https://www.youtube.com'),
			],
		},
	);
	return presets;
}

/** The apps with ready-made buttons on a platform, in display order. */
export function appPresets(platformName: string | undefined): AppPreset[] {
	return build(platformOf(platformName));
}

export function findAppPreset(platformName: string | undefined, id: string): AppPreset | null {
	return appPresets(platformName).find((preset) => preset.id === id) ?? null;
}

/** The hotkeys of the meeting apps with the app name in front, for the standard catalog. */
export function meetingButtons(platformName: string | undefined): PresetButton[] {
	return appPresets(platformName)
		.filter((preset) => ['zoom', 'teams', 'meet'].includes(preset.id))
		.flatMap((preset) =>
			preset.buttons
				.filter((button) => button.actions[0]?.kind === 'hotkey')
				.map((button) => ({
					...button,
					label: `${preset.shortName} ${(button.label ?? '').toLowerCase()}`,
				})),
		);
}
