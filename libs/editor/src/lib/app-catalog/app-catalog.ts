import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeckKey } from '@sd/deck-ui';
import { InstalledApp } from '@sd/host-client';
import { AppPreset, appPresets } from '../app-presets/app-presets';
import { presetPreview, PresetButton } from '../presets/helpers';
import { readStored, writeStored } from '../shared/browser-storage';
import { phosphorIconClass } from '../shared/icons';
import { isInstalledByExactName } from '../shared/installed-apps';

export interface AppEntry {
	preset: AppPreset;
	installed: boolean;
}

/** One app's matching buttons while searching. */
export interface AppMatch {
	preset: AppPreset;
	buttons: PresetButton[];
}

const INSTALLED_ONLY_KEY = 'sd.appCatalog.installedOnly';

/** Ready-made buttons per application: pick an app, then tap a button to add it. */
@Component({
	selector: 'sd-app-catalog',
	imports: [DeckKey, FormsModule],
	templateUrl: './app-catalog.html',
	styleUrl: './app-catalog.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppCatalog {
	readonly platform = input('');
	readonly assetUrl = input<(hash: string) => string>(() => '');
	/** Apps on the host; null while loading. Installed apps are listed first. */
	readonly installedApps = input<InstalledApp[] | null>(null);
	readonly added = output<PresetButton>();
	readonly addedAll = output<PresetButton[]>();

	readonly query = signal('');
	readonly selectedAppId = signal<string | null>(null);
	/** Hide apps that are not on this computer; remembered per browser. */
	readonly installedOnly = signal(readStored('local', INSTALLED_ONLY_KEY) === '1');
	readonly preview = presetPreview;

	readonly appsInstalledFirst = computed<AppEntry[]>(() => {
		const installed = this.installedApps() ?? [];
		const entries = appPresets(this.platform()).map((preset) => ({
			preset,
			installed: isInstalledByExactName(installed, preset.match),
		}));
		// Stable sort: installed first, otherwise the preset order.
		return [
			...entries.filter((entry) => entry.installed),
			...entries.filter((entry) => !entry.installed),
		];
	});

	readonly visibleApps = computed<AppEntry[]>(() =>
		this.installedOnly()
			? this.appsInstalledFirst().filter((entry) => entry.installed)
			: this.appsInstalledFirst(),
	);

	readonly selectedApp = computed<AppPreset | null>(
		() =>
			this.appsInstalledFirst().find((entry) => entry.preset.id === this.selectedAppId())
				?.preset ?? null,
	);

	/** While searching: per app the buttons whose label matches, or all of them when the app name matches. */
	readonly searchMatches = computed<AppMatch[]>(() => {
		const needle = this.query().trim().toLowerCase();
		if (!needle) {
			return [];
		}
		return this.visibleApps()
			.map(({ preset }) => ({
				preset,
				buttons: preset.name.toLowerCase().includes(needle)
					? preset.buttons
					: preset.buttons.filter((button) =>
							(button.label ?? '').toLowerCase().includes(needle),
						),
			}))
			.filter((match) => match.buttons.length > 0);
	});

	iconClass(preset: AppPreset): string {
		return phosphorIconClass(preset.icon, 'app-window', 'fill');
	}

	toggleInstalledOnly(): void {
		const next = !this.installedOnly();
		this.installedOnly.set(next);
		writeStored('local', INSTALLED_ONLY_KEY, next ? '1' : '0');
	}

	addAll(preset: AppPreset): void {
		this.addedAll.emit(preset.buttons.map((button) => structuredClone(button)));
	}
}
