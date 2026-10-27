import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DeckKey } from '@sd/deck-ui';
import { Button } from '@sd/protocol';
import { findPreset } from '../presets/presets';

/** Keys every computer has: media and system shortcuts from the catalog, so they really work. */
const EXAMPLE_LABELS = [
	'Play / Pause',
	'Volume up',
	'Volume down',
	'Mute',
	'Screenshot',
	'Lock screen',
];

/** Shown instead of the deck when there are no pages: examples, a short guide and the way in. */
@Component({
	selector: 'sd-welcome',
	imports: [DeckKey],
	templateUrl: './welcome.html',
	styleUrl: './welcome.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Welcome {
	readonly connected = input(false);
	readonly platform = input('');
	/** Theme id; only read so the example colors follow a theme switch. */
	readonly theme = input('');
	readonly addPage = output<void>();
	readonly restoreSample = output<void>();
	readonly examplePressed = output<Button>();

	readonly examples = computed<Button[]>(() => {
		this.theme();
		// Example keys wear the theme instead of the catalog colors: accent for media, panels for system.
		const accent = themeColor('--sd-accent', '#6d28d9');
		const surface = themeColor('--sd-surface-2', '#475569');
		return EXAMPLE_LABELS.flatMap((label, index) => {
			const preset = findPreset(this.platform(), label);
			if (!preset) {
				return [];
			}
			// Mute is a toggle in the catalog; here it is a plain key because nothing stores its state.
			const color = preset.actions[0]?.kind === 'media' ? accent : surface;
			return [{ id: `example-${index}`, ...preset, color, toggle: null }];
		});
	});
}

/** Resolves a theme token on the document to #rrggbb; non-opaque or missing values use the fallback. */
function themeColor(token: string, fallback: string): string {
	if (typeof document === 'undefined') {
		return fallback;
	}
	const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
	if (/^#[0-9a-f]{6}$/i.test(value)) {
		return value.toLowerCase();
	}
	const match = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(value);
	if (!match) {
		return fallback;
	}
	return `#${[match[1], match[2], match[3]]
		.map((part) => Number(part).toString(16).padStart(2, '0'))
		.join('')}`;
}
