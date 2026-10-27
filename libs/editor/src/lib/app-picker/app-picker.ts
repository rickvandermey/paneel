import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HostClient, InstalledApp } from '@sd/host-client';
import { sameAppName } from '../shared/app-match';
import { errorMessage } from '../shared/error-message';

/** Searchable list of the applications installed on the host. */
@Component({
	selector: 'sd-app-picker',
	imports: [FormsModule],
	templateUrl: './app-picker.html',
	styleUrl: './app-picker.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppPicker {
	readonly picked = output<InstalledApp>();
	/** Names already chosen; shown with a check so the list doubles as the current selection. */
	readonly selected = input<string[]>([]);

	readonly query = signal('');
	readonly apps = signal<InstalledApp[] | null>(null);
	readonly error = signal<string | null>(null);
	readonly total = computed(() => this.apps()?.length ?? 0);
	readonly results = computed(() => {
		const list = this.apps() ?? [];
		const query = this.query().trim().toLowerCase();
		return query ? list.filter((app) => app.name.toLowerCase().includes(query)) : list;
	});
	/** "12 apps" or "3 of 12 apps" while searching. */
	readonly countLabel = computed(() => {
		const shown = this.results().length;
		const total = this.total();
		return shown === total ? `${total} apps` : `${shown} of ${total} apps`;
	});

	private readonly client = inject(HostClient);

	constructor() {
		void this.load();
	}

	isSelected(app: InstalledApp): boolean {
		return this.selected().some((entry) => sameAppName(entry, app.name));
	}

	private async load(): Promise<void> {
		try {
			this.apps.set(await this.client.listApps());
		} catch (cause) {
			this.error.set(errorMessage(cause, 'Could not list apps'));
			this.apps.set([]);
		}
	}
}
