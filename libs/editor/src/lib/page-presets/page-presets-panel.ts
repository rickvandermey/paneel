import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InstalledApp } from '@sd/host-client';
import { phosphorIconClass } from '../shared/icons';
import { PagePreset, rankPagePresets } from './page-presets';

/** Picks a ready-made page or a blank one; presets for installed apps are listed first. */
@Component({
	selector: 'sd-page-presets-panel',
	imports: [FormsModule],
	templateUrl: './page-presets-panel.html',
	styleUrl: './page-presets-panel.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagePresetsPanel {
	readonly installedApps = input<InstalledApp[] | null>(null);
	readonly presetChosen = output<{ preset: PagePreset; installed: string[] }>();
	readonly blankChosen = output<string>();

	readonly query = signal('');
	readonly blankName = signal('');
	readonly ranked = computed(() => rankPagePresets(this.installedApps() ?? [], this.query()));

	iconClass(preset: PagePreset): string {
		return phosphorIconClass(preset.icon, 'squares-four', 'fill');
	}

	createBlank(): void {
		const name = this.blankName().trim();
		if (name) {
			this.blankChosen.emit(name);
		}
	}
}
