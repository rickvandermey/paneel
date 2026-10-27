import { meetingButtons, vscodeButtons } from '../app-presets/app-presets';
import { isMac } from '../shared/platform';
import {
	HotkeyEntry,
	hotkeys,
	launch,
	media,
	phosphor,
	PresetButton,
	PresetGroup,
	terminal,
	url,
} from './helpers';

export type { PresetButton, PresetGroup } from './helpers';

/** Colors per group, so a catalog page reads as groups at a glance. */
const EDITING_COLOR = '#0f766e';
const SYSTEM_COLOR = '#475569';
const WINDOW_COLOR = '#334155';
const BROWSER_COLOR = '#2563eb';

export function presetGroups(platformName: string | undefined): PresetGroup[] {
	const mac = isMac(platformName);
	return [
		{
			name: 'Media',
			description: 'Playback, volume and screen brightness.',
			buttons: mediaButtons(),
		},
		{
			name: 'System',
			description: 'Capture, lock, search and switching; the same in every app.',
			buttons: systemButtons(mac),
		},
		{
			name: 'Window',
			description: 'The window you are in: new, close, full screen, zoom.',
			buttons: hotkeys(mac, WINDOW_COLOR, WINDOW_HOTKEYS),
		},
		{
			name: 'Editing',
			description: 'Clipboard, undo and text formatting in the active window.',
			buttons: hotkeys(mac, EDITING_COLOR, EDITING_HOTKEYS),
		},
		{
			name: 'Browser',
			description: 'Tabs, navigation and tools in Chrome, Safari, Edge and Firefox.',
			buttons: hotkeys(mac, BROWSER_COLOR, BROWSER_HOTKEYS),
		},
		{
			name: 'IDE',
			description: 'VS Code and friends: palette, terminal, format, navigate.',
			buttons: vscodeButtons(platformName),
		},
		{
			name: 'Coding',
			description: 'Terminal sessions for AI agents, git and your monorepo.',
			buttons: codingButtons(),
		},
		{
			name: 'Meetings',
			description: 'Mute and camera in Zoom, Teams and Google Meet.',
			buttons: meetingButtons(platformName),
		},
		{
			name: 'Apps',
			description: 'Common apps on both platforms; the icon is picked up automatically.',
			buttons: mac ? MAC_APPS : WINDOWS_APPS,
		},
		{
			name: 'Websites',
			description: 'Open a site; the favicon is picked up automatically.',
			buttons: WEBSITES,
		},
	];
}

/** Looks a standard button up by label across the groups of a platform. */
export function findPreset(platformName: string | undefined, label: string): PresetButton | null {
	for (const group of presetGroups(platformName)) {
		const found = group.buttons.find((button) => button.label === label);
		if (found) {
			return structuredClone(found);
		}
	}
	return null;
}

function mediaButtons(): PresetButton[] {
	return [
		media('Play / Pause', 'play-pause', 'playPause'),
		media('Next', 'skip-forward', 'next'),
		media('Previous', 'skip-back', 'previous'),
		{ ...media('Volume up', 'speaker-high', 'volumeUp'), repeat: true },
		{ ...media('Volume down', 'speaker-low', 'volumeDown'), repeat: true },
		{
			...media('Mute', 'speaker-slash', 'mute'),
			toggle: {
				label: 'Unmute',
				icon: phosphor('speaker-high'),
				actions: [{ kind: 'media', control: 'mute' }],
			},
		},
		{ ...media('Brighter', 'sun', 'brightnessUp'), repeat: true },
		{ ...media('Dimmer', 'sun-dim', 'brightnessDown'), repeat: true },
	];
}

/** System shortcuts; a few are named after the feature of each platform. */
function systemButtons(mac: boolean): PresetButton[] {
	const entries: HotkeyEntry[] = [
		['Screenshot', 'camera', '4', ['cmd', 'shift'], 's', ['cmd', 'shift']],
		['Screen recording', 'video-camera', '5', ['cmd', 'shift'], 'r', ['cmd', 'alt']],
		['Lock screen', 'lock', 'q', ['ctrl', 'cmd'], 'l', ['cmd']],
		[mac ? 'Spotlight' : 'Search', 'magnifying-glass', 'space', ['cmd'], 's', ['cmd']],
		[mac ? 'Mission Control' : 'Task view', 'squares-four', 'up', ['ctrl'], 'tab', ['cmd']],
		['Switch app', 'app-window', 'tab', ['cmd'], 'tab', ['alt']],
		['Emoji', 'smiley', 'space', ['ctrl', 'cmd'], '.', ['cmd']],
		['Show desktop', 'desktop', 'f11', [], 'd', ['cmd']],
		[
			mac ? 'Force quit' : 'Task Manager',
			'warning-octagon',
			'escape',
			['cmd', 'alt'],
			'escape',
			['ctrl', 'shift'],
		],
		['Settings', 'gear', ',', ['cmd'], 'i', ['cmd']],
	];
	// Windows has a clipboard history shortcut; macOS has none built in.
	const windowsOnly: HotkeyEntry[] = [['Clipboard history', 'clipboard', '', [], 'v', ['cmd']]];
	return hotkeys(mac, SYSTEM_COLOR, mac ? entries : [...entries, ...windowsOnly]);
}

const WINDOW_HOTKEYS: HotkeyEntry[] = [
	['New window', 'plus-square', 'n', ['cmd'], 'n', ['ctrl']],
	['Close window', 'x-square', 'w', ['cmd', 'shift'], 'f4', ['alt']],
	['Quit app', 'power', 'q', ['cmd'], 'f4', ['alt']],
	['Minimize', 'arrow-line-down', 'm', ['cmd'], 'down', ['cmd']],
	['Full screen', 'arrows-out', 'f', ['ctrl', 'cmd'], 'f11', []],
	['Next window', 'cards', '`', ['cmd'], 'tab', ['alt']],
	['Zoom in', 'magnifying-glass-plus', '=', ['cmd'], '=', ['ctrl']],
	['Zoom out', 'magnifying-glass-minus', '-', ['cmd'], '-', ['ctrl']],
	['Reset zoom', 'arrows-in', '0', ['cmd'], '0', ['ctrl']],
];

const EDITING_HOTKEYS: HotkeyEntry[] = [
	['Copy', 'copy', 'c', ['cmd'], 'c', ['ctrl']],
	['Paste', 'clipboard-text', 'v', ['cmd'], 'v', ['ctrl']],
	['Cut', 'scissors', 'x', ['cmd'], 'x', ['ctrl']],
	['Undo', 'arrow-counter-clockwise', 'z', ['cmd'], 'z', ['ctrl']],
	['Redo', 'arrow-clockwise', 'z', ['cmd', 'shift'], 'y', ['ctrl']],
	['Select all', 'selection-all', 'a', ['cmd'], 'a', ['ctrl']],
	['Save', 'floppy-disk', 's', ['cmd'], 's', ['ctrl']],
	['Find', 'binoculars', 'f', ['cmd'], 'f', ['ctrl']],
	['Bold', 'text-b', 'b', ['cmd'], 'b', ['ctrl']],
	['Italic', 'text-italic', 'i', ['cmd'], 'i', ['ctrl']],
	['Underline', 'text-underline', 'u', ['cmd'], 'u', ['ctrl']],
	['Paste plain', 'clipboard', 'v', ['cmd', 'shift', 'alt'], 'v', ['ctrl', 'shift']],
];

const BROWSER_HOTKEYS: HotkeyEntry[] = [
	['New tab', 'plus-square', 't', ['cmd'], 't', ['ctrl']],
	['Close tab', 'x-square', 'w', ['cmd'], 'w', ['ctrl']],
	['Reopen tab', 'arrow-u-up-left', 't', ['cmd', 'shift'], 't', ['ctrl', 'shift']],
	['Next tab', 'arrow-right', 'tab', ['ctrl'], 'tab', ['ctrl']],
	['Previous tab', 'arrow-left', 'tab', ['ctrl', 'shift'], 'tab', ['ctrl', 'shift']],
	['Reload', 'arrows-clockwise', 'r', ['cmd'], 'r', ['ctrl']],
	['Back', 'arrow-bend-up-left', 'left', ['cmd'], 'left', ['alt']],
	['Forward', 'arrow-bend-up-right', 'right', ['cmd'], 'right', ['alt']],
	['Address bar', 'link', 'l', ['cmd'], 'l', ['ctrl']],
	['Bookmark', 'bookmark-simple', 'd', ['cmd'], 'd', ['ctrl']],
	['History', 'clock-counter-clockwise', 'y', ['cmd'], 'h', ['ctrl']],
	['Downloads', 'download-simple', 'j', ['cmd', 'shift'], 'j', ['ctrl']],
	['Private window', 'mask-happy', 'n', ['cmd', 'shift'], 'n', ['ctrl', 'shift']],
	['Dev tools', 'bug', 'i', ['cmd', 'alt'], 'f12', []],
];

function codingButtons(): PresetButton[] {
	return [
		terminal('Claude', 'sparkle', 'claude'),
		terminal('Codex', 'robot', 'codex'),
		terminal('Claude: tests', 'flask', 'claude', 'run the tests and fix failures'),
		terminal('Claude: review', 'magnifying-glass', 'claude', 'review my uncommitted changes'),
		terminal(
			'Claude: commit',
			'git-commit',
			'claude',
			'commit my changes with a conventional commit message',
		),
		terminal('Claude: explain', 'book-open', 'claude', 'explain this repository to me'),
		terminal('Git status', 'git-branch', 'git status'),
		terminal('Git pull', 'git-pull-request', 'git pull'),
		terminal('Git push', 'cloud-arrow-up', 'git push'),
		terminal('Git log', 'list-bullets', 'git log --oneline -20'),
		terminal('Nx serve', 'rocket-launch', 'pnpm nx serve'),
		terminal('Nx build', 'hammer', 'pnpm nx run-many -t build'),
		terminal('Nx test', 'test-tube', 'pnpm nx run-many -t test'),
		terminal('Nx lint', 'check-square', 'pnpm nx run-many -t lint'),
		terminal('Nx affected', 'target', 'pnpm nx affected -t lint test build'),
		terminal('Nx graph', 'graph', 'pnpm nx graph'),
		terminal('Install', 'package', 'pnpm install'),
		url('Localhost', 'http://localhost:4200'),
	];
}

const MAC_APPS: PresetButton[] = [
	launch('Terminal', 'Terminal'),
	launch('Calculator', 'Calculator'),
	launch('Finder', 'Finder'),
	launch('Safari', 'Safari'),
	launch('Chrome', 'Google Chrome'),
	launch('Firefox', 'Firefox'),
	launch('VS Code', 'Visual Studio Code'),
	launch('Notes', 'Notes'),
	launch('Music', 'Music'),
	launch('Spotify', 'Spotify'),
	launch('Slack', 'Slack'),
	launch('Discord', 'Discord'),
	launch('Zoom', 'zoom.us'),
	launch('Teams', 'Microsoft Teams'),
	launch('Notion', 'Notion'),
	launch('Figma', 'Figma'),
	launch('Settings', 'System Settings'),
];

/** Windows launch targets are executable names, which the host resolves through PATH or the Start menu. */
const WINDOWS_APPS: PresetButton[] = [
	launch('Terminal', 'wt'),
	launch('Calculator', 'calc'),
	launch('Explorer', 'explorer'),
	launch('Edge', 'msedge'),
	launch('Chrome', 'chrome'),
	launch('Firefox', 'firefox'),
	launch('VS Code', 'code'),
	launch('Notepad', 'notepad'),
	launch('Spotify', 'spotify'),
	launch('Slack', 'slack'),
	launch('Discord', 'discord'),
	launch('Zoom', 'zoom'),
	launch('Teams', 'msteams'),
	launch('Notion', 'notion'),
	launch('Figma', 'figma'),
	launch('Settings', 'ms-settings:'),
];

const WEBSITES: PresetButton[] = [
	url('GitHub', 'https://github.com'),
	url('GitHub PRs', 'https://github.com/pulls'),
	url('GitHub notifications', 'https://github.com/notifications'),
	url('YouTube', 'https://www.youtube.com'),
	url('Gmail', 'https://mail.google.com'),
	url('Calendar', 'https://calendar.google.com'),
	url('Drive', 'https://drive.google.com'),
	url('Claude', 'https://claude.ai'),
	url('ChatGPT', 'https://chatgpt.com'),
	url('Notion', 'https://www.notion.so'),
	url('Figma', 'https://www.figma.com'),
	url('Jira', 'https://www.atlassian.com/software/jira'),
	url('Stack Overflow', 'https://stackoverflow.com'),
	url('MDN', 'https://developer.mozilla.org'),
	url('npm', 'https://www.npmjs.com'),
];
