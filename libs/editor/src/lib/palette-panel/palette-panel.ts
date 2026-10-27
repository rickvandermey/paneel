import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DeckKey } from '@sd/deck-ui';
import { Button, CustomPalette } from '@sd/protocol';
import { NO_PALETTE, paletteById, paletteColor, paletteGroups, recolorPlan } from './palettes';

/** How many of the page's keys the before-and-after preview shows. */
const PREVIEW_KEY_COUNT = 6;

/** Chooses the color palette of one page and can recolor the buttons already on it. */
@Component({
	selector: 'sd-palette-panel',
	imports: [DeckKey],
	templateUrl: './palette-panel.html',
	styleUrl: './palette-panel.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PalettePanel {
	readonly pageName = input('');
	readonly activePaletteId = input(NO_PALETTE);
	readonly customPalettes = input<CustomPalette[]>([]);
	/** The page's buttons, for the before and after preview. */
	readonly buttons = input<Button[]>([]);
	readonly assetUrl = input<(hash: string) => string>(() => '');
	readonly canUndo = input(false);

	readonly selected = output<string>();
	readonly recolorRequested = output<void>();
	readonly undoRequested = output<void>();
	readonly createRequested = output<void>();
	readonly editRequested = output<CustomPalette>();
	readonly deleteRequested = output<CustomPalette>();

	readonly noPalette = NO_PALETTE;
	readonly groups = paletteGroups();
	readonly confirmingDeleteId = signal<string | null>(null);
	/** True right after a pick, so the recolor prompt draws the eye. */
	readonly justSelected = signal(false);

	readonly activePaletteName = computed(
		() => paletteById(this.activePaletteId(), this.customPalettes()).name,
	);
	/** The first few keys of the page as they would look after recoloring. */
	readonly previewKeys = computed<Button[]>(() =>
		this.buttons()
			.slice(0, PREVIEW_KEY_COUNT)
			.map((button, index) => ({
				...button,
				id: `preview-${button.id}`,
				folder: null,
				toggle: null,
				color:
					paletteColor(this.activePaletteId(), index, this.customPalettes()) ??
					button.color,
			})),
	);
	/** How many buttons would get another color, folders included. */
	readonly changedCount = computed(
		() => recolorPlan(this.buttons(), this.activePaletteId(), this.customPalettes()).length,
	);

	choose(id: string): void {
		this.selected.emit(id);
		this.justSelected.set(true);
	}

	/** The first press arms the delete, the second one within the same card confirms it. */
	requestDelete(palette: CustomPalette): void {
		if (this.confirmingDeleteId() === palette.id) {
			this.confirmingDeleteId.set(null);
			this.deleteRequested.emit(palette);
			return;
		}
		this.confirmingDeleteId.set(palette.id);
	}
}
