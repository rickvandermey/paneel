import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HostClient } from '@sd/host-client';
import { Command, Config } from '@sd/protocol';
import { paletteById } from '../palette-panel/palettes';
import { matchesApp, pageForApp } from '../shared/app-match';
import { Shell } from './shell';

const config: Config = {
	schemaVersion: 1,
	revision: 3,
	settings: { terminal: 'Terminal', theme: 'paper' },
	profiles: [
		{
			id: 'music',
			name: 'Music',
			buttons: [
				{
					id: 'a',
					label: 'Play',
					showLabel: true,
					color: '#111111',
					actions: [],
				},
			],
		},
		{
			id: 'code',
			name: 'Coding',
			palette: 'ocean',
			appMatch: 'Visual Studio Code, com.microsoft.VSCode',
			buttons: [
				{ id: 'x', label: 'X', showLabel: true, color: '#000000', actions: [] },
				{ id: 'y', label: 'Y', showLabel: true, color: '#000000', actions: [] },
			],
		},
	],
};

class FakeHostClient {
	readonly status = signal('connected');
	readonly hostInfo = signal({
		type: 'welcome',
		hostName: 'mac',
		platform: 'darwin',
		version: 2,
	});
	readonly config = signal<Config | null>(structuredClone(config));
	readonly revision = signal(3);
	readonly networkMs = signal<number | null>(12);
	readonly lastExecutionMs = signal<number | null>(null);
	readonly error = signal<string | null>(null);
	readonly buttonStates = signal<Record<string, boolean>>({});
	readonly activeApp = signal<{
		type: 'activeApp';
		name: string;
		id: string;
	} | null>(null);
	readonly pairingUrl = signal<string | null>('http://127.0.0.1:48220/?token=t');
	readonly port = signal(48220);
	readonly apps = [{ name: 'Spotify', target: 'Spotify', path: '/Applications/Spotify.app' }];
	listApps(): Promise<unknown> {
		return Promise.resolve(this.apps);
	}
	resetConfig(): Promise<void> {
		return Promise.resolve();
	}
	backupUrl(): string {
		return 'http://127.0.0.1:48220/api/backup?token=t';
	}
	readonly sent: Command[] = [];
	readonly pressed: string[] = [];
	readonly ran: unknown[] = [];
	run(actions: unknown): void {
		this.ran.push(actions);
	}

	assetUrl(hash: string): string {
		return `/assets/${hash}`;
	}

	press(id: string): void {
		this.pressed.push(id);
	}

	send(command: Command): Promise<unknown> {
		this.sent.push(command);
		return Promise.resolve({ ok: true });
	}
}

describe('Shell', () => {
	let fixture: ComponentFixture<Shell>;
	let client: FakeHostClient;

	beforeEach(async () => {
		client = new FakeHostClient();
		await TestBed.configureTestingModule({
			imports: [Shell],
			providers: [{ provide: HostClient, useValue: client }],
		}).compileComponents();
		fixture = TestBed.createComponent(Shell);
		await fixture.whenStable();
	});

	function text(selector: string): string[] {
		return Array.from(fixture.nativeElement.querySelectorAll(selector)).map(
			(el) => (el as HTMLElement).textContent?.trim() ?? '',
		);
	}

	it('shows one chip per page and switches with it', async () => {
		expect(text('.chip')).toEqual(['Music', 'Coding']);
		fixture.componentInstance.selectProfile('code');
		await fixture.whenStable();
		expect(fixture.componentInstance.profile()?.name).toBe('Coding');
	});

	it('presses keys outside edit mode and opens the editor inside it', async () => {
		const button = config.profiles[0].buttons[0];
		fixture.componentInstance.onPressed(button);
		expect(client.pressed).toEqual(['a']);
		fixture.componentInstance.onMenu('edit');
		await fixture.whenStable();
		expect(fixture.nativeElement.querySelectorAll('sd-deck-key').length).toBe(2);
		fixture.componentInstance.onEditRequested(button);
		await fixture.whenStable();
		expect(fixture.nativeElement.querySelector('sd-button-editor')).not.toBeNull();
	});

	it('turns a saved draft into a button.update command', () => {
		fixture.componentInstance.onEditRequested(config.profiles[0].buttons[0]);
		fixture.componentInstance.onDraftSaved({
			label: 'Pause',
			showLabel: false,
			color: '#222222',
			icon: null,
			actions: [{ kind: 'media', control: 'playPause' }],
			folder: false,
			toggle: null,
			repeat: false,
		});
		expect(client.sent).toEqual([
			{
				type: 'button.update',
				id: 'a',
				patch: {
					label: 'Pause',
					showLabel: false,
					color: '#222222',
					icon: null,
					actions: [{ kind: 'media', control: 'playPause' }],
					toggle: null,
					repeat: false,
				},
			},
		]);
		expect(fixture.componentInstance.panel()).toBeNull();
	});

	it('applies the configured theme to the document and switches it through a command', () => {
		expect(document.documentElement.dataset['theme']).toBe('paper');
		fixture.componentInstance.onThemeChanged('neon');
		expect(client.sent).toEqual([{ type: 'settings.update', patch: { theme: 'neon' } }]);
	});

	it('turns a drag into a button.move inside the current page', () => {
		fixture.componentInstance.onMoveRequested({ id: 'a', index: 3 });
		expect(client.sent).toEqual([
			{
				type: 'button.move',
				id: 'a',
				profileId: 'music',
				parentId: undefined,
				index: 3,
			},
		]);
	});

	it('colors new presets with the page palette and recolors existing buttons', () => {
		fixture.componentInstance.selectProfile('code');
		fixture.componentInstance.onPresetAdded({
			label: 'Mute',
			showLabel: true,
			color: '#333333',
			actions: [{ kind: 'media', control: 'mute' }],
		});
		const created = client.sent[0];
		if (created.type === 'button.create') {
			expect(created.button.color).toBe(paletteById('ocean').colors[2]);
		} else {
			throw new Error('expected button.create');
		}
		client.sent.length = 0;
		fixture.componentInstance.onPaletteRequested('code');
		fixture.componentInstance.onRecolorRequested();
		const ocean = paletteById('ocean').colors;
		expect(client.sent).toEqual([
			{ type: 'button.update', id: 'x', patch: { color: ocean[0] } },
			{ type: 'button.update', id: 'y', patch: { color: ocean[1] } },
		]);
		client.sent.length = 0;
		fixture.componentInstance.undoRecolor();
		expect(client.sent).toEqual([
			{ type: 'button.update', id: 'x', patch: { color: '#000000' } },
			{ type: 'button.update', id: 'y', patch: { color: '#000000' } },
		]);
		expect(fixture.componentInstance.recolorUndo()).toBeNull();
	});

	it('saves a custom theme, activates it and falls back to the default when deleted', () => {
		const custom = {
			id: 'ct1',
			name: 'Studio',
			base: 'graphite',
			bg: '#101010',
			surface: '#202020',
			text: '#ffffff',
			accent: '#e11d48',
			keyRadius: 30,
			keyMix: 100,
			blur: 0,
		};
		fixture.componentInstance.onCustomThemeSaved(custom);
		expect(client.sent[0]).toEqual({
			type: 'settings.update',
			patch: { customThemes: [custom], theme: 'ct1' },
		});
		client.config.update((config) =>
			config
				? {
						...config,
						settings: {
							...config.settings,
							theme: 'ct1',
							customThemes: [custom],
						},
					}
				: config,
		);
		fixture.detectChanges();
		expect(fixture.componentInstance.theme()).toBe('ct1');
		expect(document.documentElement.style.getPropertyValue('--sd-accent')).toBe('#e11d48');
		client.sent.length = 0;
		fixture.componentInstance.onCustomThemeDeleted(custom);
		expect(client.sent[0]).toEqual({
			type: 'settings.update',
			patch: { customThemes: [], theme: 'midnight' },
		});
	});

	it('removes a deleted custom palette from the pages that used it', () => {
		const palette = { id: 'cp1', name: 'Brand', colors: ['#ff00ff'] };
		client.config.update((config) =>
			config
				? {
						...config,
						settings: { ...config.settings, customPalettes: [palette] },
						profiles: config.profiles.map((profile, index) =>
							index === 0 ? { ...profile, palette: 'cp1' } : profile,
						),
					}
				: config,
		);
		fixture.detectChanges();
		fixture.componentInstance.onCustomPaletteDeleted(palette);
		expect(client.sent).toEqual([
			{ type: 'settings.update', patch: { customPalettes: [] } },
			{ type: 'profile.update', id: 'music', patch: { palette: '' } },
		]);
	});

	it('switches to the page that follows the focused app', () => {
		expect(fixture.componentInstance.profile()?.id).toBe('music');
		client.activeApp.set({
			type: 'activeApp',
			name: 'Code',
			id: 'com.microsoft.VSCode',
		});
		fixture.detectChanges();
		expect(fixture.componentInstance.profile()?.id).toBe('code');
		client.activeApp.set({
			type: 'activeApp',
			name: 'Finder',
			id: 'com.apple.finder',
		});
		fixture.detectChanges();
		expect(fixture.componentInstance.profile()?.id).toBe('code');
	});

	it('shows the welcome screen without pages and can restore the sample page', async () => {
		client.config.update((config) => (config ? { ...config, profiles: [] } : config));
		fixture.detectChanges();
		await fixture.whenStable();
		expect(fixture.nativeElement.querySelector('sd-welcome')).not.toBeNull();
		expect(fixture.nativeElement.querySelectorAll('sd-welcome sd-deck-key').length).toBe(6);
		fixture.componentInstance.onExamplePressed({
			id: 'example-0',
			showLabel: true,
			color: '#000000',
			actions: [{ kind: 'media', control: 'playPause' }],
		});
		expect(client.ran).toEqual([[{ kind: 'media', control: 'playPause' }]]);
		fixture.componentInstance.restoreSamplePage();
		const command = client.sent[0];
		expect(command.type).toBe('profile.create');
		if (command.type === 'profile.create') {
			expect(command.profile.name).toBe('Start');
			expect(command.profile.buttons?.length).toBe(6);
		}
	});

	it('creates a Start page when a preset is added without any page', () => {
		client.config.update((config) => (config ? { ...config, profiles: [] } : config));
		fixture.detectChanges();
		fixture.componentInstance.onPresetAdded({
			label: 'Mute',
			showLabel: true,
			color: '#333333',
			actions: [{ kind: 'media', control: 'mute' }],
		});
		expect(client.sent.map((command) => command.type)).toEqual([
			'profile.create',
			'button.create',
		]);
	});

	it('adds presets to the current page with a fresh id', () => {
		fixture.componentInstance.onPresetAdded({
			label: 'Mute',
			showLabel: true,
			color: '#333333',
			actions: [{ kind: 'media', control: 'mute' }],
		});
		const command = client.sent[0];
		expect(command.type).toBe('button.create');
		if (command.type === 'button.create') {
			expect(command.profileId).toBe('music');
			expect(command.button.id).not.toBe('');
			expect(command.button.label).toBe('Mute');
		}
	});
});

describe('pageForApp', () => {
	const music = {
		id: 'music',
		name: 'Music',
		buttons: [
			{
				id: 's',
				label: 'Spotify',
				showLabel: true,
				color: '#000000',
				actions: [{ kind: 'launch' as const, target: 'Spotify' }],
			},
		],
	};
	const code = { id: 'code', name: 'Coding', appMatch: 'spotify', buttons: [] };

	it('follows the apps a page can launch when no page claims the app explicitly', () => {
		const app = { name: 'Spotify', id: 'com.spotify.client' };
		expect(pageForApp([music], app, 'buttons')?.id).toBe('music');
		expect(pageForApp([music], app, 'explicit')).toBeNull();
		expect(
			pageForApp([music], { name: 'Finder', id: 'com.apple.finder' }, 'buttons'),
		).toBeNull();
	});

	it('prefers an explicit appMatch over launch buttons', () => {
		expect(pageForApp([music, code], { name: 'Spotify', id: 'x' }, 'buttons')?.id).toBe('code');
	});
});

describe('matchesApp', () => {
	it('matches any comma-separated entry against name or id, ignoring case', () => {
		const app = { name: 'Google Chrome', id: 'com.google.Chrome' };
		expect(matchesApp('chrome', app)).toBe(true);
		expect(matchesApp('Safari, com.google.chrome', app)).toBe(true);
		expect(matchesApp('Safari', app)).toBe(false);
		expect(matchesApp('', app)).toBe(false);
	});
});
