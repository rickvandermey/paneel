import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	OnInit,
	output,
	signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeckKey } from '@sd/deck-ui';
import { randomId } from '@sd/host-client';
import { Button, CustomPalette } from '@sd/protocol';
import { tintForColor } from '../palette-panel/palettes';
import { phosphor } from '../shared/icons';

const MAX_COLORS = 8;
const DEFAULT_COLORS = ['#2563eb', '#7c3aed', '#0d9488', '#d97706', '#dc2626', '#4b5563'];

/** Builds a custom palette: a name, up to eight colors and an optional tint. */
@Component({
	selector: 'sd-palette-editor',
	imports: [FormsModule, DeckKey],
	templateUrl: './palette-editor.html',
	styleUrl: './palette-editor.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaletteEditor implements OnInit {
	/** Null creates a new palette. */
	readonly palette = input<CustomPalette | null>(null);
	readonly saved = output<CustomPalette>();
	readonly cancelled = output<void>();

	readonly name = signal('');
	readonly colors = signal<string[]>(DEFAULT_COLORS);
	readonly tint = signal('');
	readonly maxColors = MAX_COLORS;

	readonly valid = computed(() => this.name().trim().length > 0 && this.colors().length > 0);
	readonly previewKeys = computed<Button[]>(() =>
		this.colors().map((color, index) => ({
			id: `c${index}`,
			label: `Key ${index + 1}`,
			showLabel: true,
			color,
			icon: phosphor('circle'),
			actions: [],
		})),
	);
	readonly previewTint = computed(() => (this.tint() ? tintForColor(this.tint()) : 'none'));

	/** Inputs are only set after construction, so the draft is loaded here. */
	ngOnInit(): void {
		this.loadDraft();
	}

	loadDraft(): void {
		const palette = this.palette();
		this.name.set(palette?.name ?? '');
		this.colors.set(palette?.colors ?? DEFAULT_COLORS);
		this.tint.set(palette?.tint ?? '');
	}

	setColor(index: number, color: string): void {
		this.colors.update((list) => list.map((entry, i) => (i === index ? color : entry)));
	}

	addColor(): void {
		if (this.colors().length < MAX_COLORS) {
			this.colors.update((list) => [...list, list.at(-1) ?? DEFAULT_COLORS[0]]);
		}
	}

	removeColor(index: number): void {
		if (this.colors().length > 1) {
			this.colors.update((list) => list.filter((_, i) => i !== index));
		}
	}

	save(): void {
		if (!this.valid()) {
			return;
		}
		this.saved.emit({
			id: this.palette()?.id ?? randomId(),
			name: this.name().trim(),
			colors: this.colors(),
			tint: this.tint() || undefined,
		});
	}
}
