import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	OnInit,
	output,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { contrastColor } from '@sd/deck-ui';
import { HostClient, InstalledApp } from '@sd/host-client';
import { Action, IconRef } from '@sd/protocol';
import { AppPicker } from '../app-picker/app-picker';
import { errorMessage } from '../shared/error-message';
import { EMOJI_GROUPS } from './emoji';
import { LogoEntry, searchLogos } from './logo-search';
import { PHOSPHOR_ICON_NAMES } from './phosphor-names';

export type IconTab = 'app' | 'website' | 'logo' | 'icon' | 'emoji' | 'upload';
export type PhosphorWeight = 'regular' | 'bold' | 'fill';

const MAX_ICON_RESULTS = 120;

/** Chooses an icon from the app, a website favicon, Phosphor, emoji or an uploaded image. */
@Component({
	selector: 'sd-icon-picker',
	imports: [FormsModule, AppPicker],
	templateUrl: './icon-picker.html',
	styleUrl: './icon-picker.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconPicker implements OnInit {
	readonly icon = input<IconRef | null | undefined>(null);
	/** The button's actions seed the app and website tabs. */
	readonly actions = input<Action[]>([]);
	/** Key color; logos are stored in the matching contrast color. */
	readonly keyColor = input('#374151');
	readonly picked = output<IconRef | null>();

	readonly tab = signal<IconTab>('icon');
	readonly tabs: { id: IconTab; label: string; icon: string }[] = [
		{ id: 'app', label: 'App', icon: 'app-window' },
		{ id: 'website', label: 'Website', icon: 'globe' },
		{ id: 'logo', label: 'Logo', icon: 'seal' },
		{ id: 'icon', label: 'Icon', icon: 'shapes' },
		{ id: 'emoji', label: 'Emoji', icon: 'smiley' },
		{ id: 'upload', label: 'Upload', icon: 'upload-simple' },
	];

	readonly appTarget = signal('');
	readonly websiteUrl = signal('');
	readonly phosphorQuery = signal('');
	readonly phosphorWeight = signal<PhosphorWeight>('regular');
	readonly customEmoji = signal('');
	readonly logoQuery = signal('');
	/** Loaded on first use; the list is a few thousand entries. */
	readonly logos = signal<readonly LogoEntry[] | null>(null);
	readonly busy = signal(false);
	readonly error = signal<string | null>(null);

	readonly emojiGroups = EMOJI_GROUPS;
	readonly phosphorResults = computed(() => {
		// Phosphor names are kebab-case, so "arrow up" finds "arrow-up".
		const query = this.phosphorQuery().trim().toLowerCase().replace(/\s+/g, '-');
		const names = query
			? PHOSPHOR_ICON_NAMES.filter((name) => name.includes(query))
			: PHOSPHOR_ICON_NAMES;
		return names.slice(0, MAX_ICON_RESULTS);
	});
	readonly logoResults = computed(() => searchLogos(this.logos() ?? [], this.logoQuery()));

	private readonly client = inject(HostClient);

	constructor() {
		effect(() => {
			if (this.tab() === 'logo' && this.logos() === null) {
				void this.loadLogos();
			}
		});
	}

	/** Inputs are only set after construction, so the tabs are seeded here. */
	ngOnInit(): void {
		this.seedFromActions();
	}

	isActivePhosphor(name: string): boolean {
		const icon = this.icon();
		return icon?.source === 'phosphor' && icon.name === name;
	}

	phosphorClass(name: string): string {
		const weight = this.phosphorWeight();
		return `${weight === 'regular' ? 'ph' : `ph-${weight}`} ph-${name}`;
	}

	pickPhosphor(name: string): void {
		const weight = this.phosphorWeight();
		this.picked.emit(
			weight === 'regular'
				? { source: 'phosphor', name }
				: { source: 'phosphor', name, weight },
		);
	}

	pickEmoji(value: string): void {
		const trimmed = value.trim();
		if (trimmed) {
			this.picked.emit({ source: 'emoji', value: trimmed });
		}
	}

	async pickLogo(slug: string): Promise<void> {
		const color = contrastColor(this.keyColor());
		await this.runWithBusyState(async () => {
			this.picked.emit(await this.client.resolveLogo(slug, color));
		});
	}

	async resolveApp(): Promise<void> {
		await this.resolveIconFor({ kind: 'launch', target: this.appTarget().trim() });
	}

	async useInstalledApp(app: InstalledApp): Promise<void> {
		this.appTarget.set(app.target);
		await this.resolveApp();
	}

	async resolveWebsite(): Promise<void> {
		let url = this.websiteUrl().trim();
		if (url && !/^https?:\/\//i.test(url)) {
			url = `https://${url}`;
		}
		await this.resolveIconFor({ kind: 'url', url });
	}

	async upload(event: Event): Promise<void> {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) {
			return;
		}
		await this.runWithBusyState(async () => {
			this.picked.emit(await this.client.uploadAsset(file));
		});
	}

	removeIcon(): void {
		this.picked.emit(null);
	}

	private async loadLogos(): Promise<void> {
		const module = await import('./simple-icons-names');
		this.logos.set(module.SIMPLE_ICONS);
	}

	/** Opens the tab that matches the button's first action, prefilled with its app or URL. */
	private seedFromActions(): void {
		const launch = this.actions().find((action) => action.kind === 'launch');
		const url = this.actions().find((action) => action.kind === 'url');
		if (launch?.target) {
			this.appTarget.set(launch.target);
			this.tab.set('app');
		} else if (url?.url) {
			this.websiteUrl.set(url.url);
			this.tab.set('website');
		}
	}

	/** Asks the host for the icon of a launch or URL action. */
	private async resolveIconFor(action: Action): Promise<void> {
		if (!action.target && !action.url) {
			return;
		}
		await this.runWithBusyState(async () => {
			this.picked.emit(await this.client.resolveIcon(action));
		});
	}

	private async runWithBusyState(task: () => Promise<void>): Promise<void> {
		this.busy.set(true);
		this.error.set(null);
		try {
			await task();
		} catch (cause) {
			this.error.set(errorMessage(cause, 'Failed'));
		} finally {
			this.busy.set(false);
		}
	}
}
