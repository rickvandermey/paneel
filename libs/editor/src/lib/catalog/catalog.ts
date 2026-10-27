import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeckKey } from '@sd/deck-ui';
import { InstalledApp } from '@sd/host-client';
import { launch, presetPreview, PresetButton, PresetGroup } from '../presets/helpers';
import { presetGroups } from '../presets/presets';
import { isLaunchTargetInstalled } from '../shared/installed-apps';

/** The preset group that lists well-known apps; trimmed to what is installed once that is known. */
const APPS_GROUP = 'Apps';

/** Shows ready-made buttons per platform; tapping one adds it to the current page. */
@Component({
	selector: 'sd-catalog',
	imports: [DeckKey, FormsModule],
	templateUrl: './catalog.html',
	styleUrl: './catalog.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalog {
	readonly platform = input('');
	readonly assetUrl = input<(hash: string) => string>(() => '');
	/** Apps on the host; null while loading. Adds a "Your apps" group and trims the Apps group. */
	readonly installedApps = input<InstalledApp[] | null>(null);
	readonly added = output<PresetButton>();

	readonly query = signal('');
	readonly preview = presetPreview;

	/** The platform's groups, with the Apps group limited to installed apps. */
	private readonly groupsForThisComputer = computed<PresetGroup[]>(() => {
		const installed = this.installedApps();
		return presetGroups(this.platform()).map((group) =>
			group.name === APPS_GROUP && installed
				? {
						...group,
						buttons: group.buttons.filter((button) =>
							isLaunchTargetInstalled(installed, button.actions[0]?.target ?? ''),
						),
					}
				: group,
		);
	});

	private readonly yourAppsGroup = computed<PresetGroup | null>(() => {
		const installed = this.installedApps();
		if (!installed || installed.length === 0) {
			return null;
		}
		return {
			name: 'Your apps',
			description: 'Every app found on this computer.',
			buttons: installed.map((app) => launch(app.name, app.target)),
		};
	});

	/** What the panel shows: every group narrowed by the search, empty groups left out. */
	readonly groups = computed<PresetGroup[]>(() => {
		const yourApps = this.yourAppsGroup();
		const groups = yourApps
			? [...this.groupsForThisComputer(), yourApps]
			: this.groupsForThisComputer();
		return groups
			.map((group) => ({ ...group, buttons: filterButtons(group, this.query()) }))
			.filter((group) => group.buttons.length > 0);
	});
}

/** A group's buttons that match the search: by label, or all of them when the group name matches. */
function filterButtons(group: PresetGroup, query: string): PresetButton[] {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return group.buttons;
	}
	if (group.name.toLowerCase().includes(needle)) {
		return group.buttons;
	}
	return group.buttons.filter((button) => (button.label ?? '').toLowerCase().includes(needle));
}
