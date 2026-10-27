import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InstalledApp } from '@sd/host-client';
import { CustomPalette, IconRef, Profile } from '@sd/protocol';
import { AppPicker } from '../app-picker/app-picker';
import { IconPicker } from '../icon-picker/icon-picker';
import { paletteById } from '../palette-panel/palettes';
import { joinAppMatch, sameAppName, splitAppMatch } from '../shared/app-match';
import { emojiOf, phosphorIconClass } from '../shared/icons';

/** How many followed apps a row names before it switches to "+N". */
const FOLLOWED_APPS_SHOWN = 2;

/** Pages are profiles: ordered groups of buttons you swipe between vertically. */
@Component({
	selector: 'sd-profiles-panel',
	imports: [FormsModule, IconPicker, AppPicker],
	templateUrl: './profiles-panel.html',
	styleUrl: './profiles-panel.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilesPanel {
	readonly profiles = input.required<Profile[]>();
	readonly activeProfileId = input<string | null>(null);
	readonly customPalettes = input<CustomPalette[]>([]);

	readonly selected = output<string>();
	readonly addRequested = output<void>();
	readonly renamed = output<{ id: string; name: string }>();
	readonly iconChanged = output<{ id: string; icon: IconRef | null }>();
	readonly moved = output<{ id: string; index: number }>();
	readonly deleted = output<string>();
	readonly paletteRequested = output<string>();
	readonly appMatchChanged = output<{ id: string; appMatch: string }>();

	/** The page whose followed apps are being edited, if any. */
	readonly followAppsProfileId = signal<string | null>(null);
	readonly customAppName = signal('');
	/** The page whose icon is being picked, if any. */
	readonly iconPickerProfileId = signal<string | null>(null);
	/** The page being renamed and the name typed so far. */
	readonly renamingProfileId = signal<string | null>(null);
	readonly renameDraft = signal('');
	readonly confirmingDeleteId = signal<string | null>(null);

	/** Apps the page being edited follows, split from its comma-separated appMatch. */
	readonly followedApps = computed(() => {
		const id = this.followAppsProfileId();
		const profile = this.profiles().find((entry) => entry.id === id);
		return splitAppMatch(profile?.appMatch);
	});

	readonly emojiOf = emojiOf;

	iconClass(profile: Profile): string {
		return phosphorIconClass(profile.icon, 'image');
	}

	paletteName(id: string | undefined): string {
		return paletteById(id, this.customPalettes()).name;
	}

	followLabel(profile: Profile): string {
		return profile.appMatch ? `Follows ${profile.appMatch}` : 'Follow apps';
	}

	followedAppsSummary(appMatch: string | undefined): string {
		const apps = splitAppMatch(appMatch);
		if (apps.length <= FOLLOWED_APPS_SHOWN) {
			return apps.join(', ');
		}
		return `${apps.slice(0, FOLLOWED_APPS_SHOWN).join(', ')} +${apps.length - FOLLOWED_APPS_SHOWN}`;
	}

	startRename(profile: Profile): void {
		this.renamingProfileId.set(profile.id);
		this.renameDraft.set(profile.name);
	}

	commitRename(): void {
		const id = this.renamingProfileId();
		const name = this.renameDraft().trim();
		if (id && name) {
			this.renamed.emit({ id, name });
		}
		this.renamingProfileId.set(null);
	}

	onIconPicked(icon: IconRef | null): void {
		const id = this.iconPickerProfileId();
		if (id) {
			this.iconChanged.emit({ id, icon });
		}
		this.iconPickerProfileId.set(null);
	}

	/** Tapping a followed app in the list removes it again; the list is the selection. */
	onAppPicked(app: InstalledApp): void {
		const current = this.followedApps().find((entry) => sameAppName(entry, app.name));
		if (current) {
			this.removeFollowedApp(current);
		} else {
			this.addFollowedApp(app.name);
		}
	}

	addCustomApp(): void {
		this.addFollowedApp(this.customAppName());
		this.customAppName.set('');
	}

	addFollowedApp(name: string): void {
		const id = this.followAppsProfileId();
		const trimmed = name.trim();
		if (!id || !trimmed) {
			return;
		}
		const current = this.followedApps();
		if (current.some((entry) => sameAppName(entry, trimmed))) {
			return;
		}
		this.appMatchChanged.emit({ id, appMatch: joinAppMatch([...current, trimmed]) });
	}

	removeFollowedApp(name: string): void {
		const id = this.followAppsProfileId();
		if (!id) {
			return;
		}
		const remaining = this.followedApps().filter((entry) => entry !== name);
		this.appMatchChanged.emit({ id, appMatch: joinAppMatch(remaining) });
	}

	/** The first press arms the delete, the second one on the same row confirms it. */
	requestDelete(id: string): void {
		if (this.confirmingDeleteId() === id) {
			this.deleted.emit(id);
			this.confirmingDeleteId.set(null);
			return;
		}
		this.confirmingDeleteId.set(id);
	}
}
