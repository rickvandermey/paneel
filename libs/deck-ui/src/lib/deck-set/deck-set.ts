import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from '@sd/protocol';
import { AssetUrlFn, DeckKey } from '../deck-key/deck-key';
import { GridSpec } from '../layout/deck-layout';

/** One screenful of keys laid out on a fixed grid. */
@Component({
	selector: 'sd-deck-set',
	imports: [DeckKey],
	templateUrl: './deck-set.html',
	styleUrl: './deck-set.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[style.--columns]': 'grid().columns',
		'[style.--rows]': 'grid().rows',
		'[style.--size.px]': 'grid().size',
		'[style.--gap.px]': 'grid().gap',
	},
})
export class DeckSet {
	readonly buttons = input.required<Button[]>();
	readonly grid = input.required<GridSpec>();
	readonly activeButtonId = input<string | null>(null);
	readonly assetUrl = input<AssetUrlFn>(() => '');
	readonly editing = input(false);
	readonly draggingId = input<string | null>(null);
	readonly dropTargetId = input<string | null>(null);
	/** Toggle buttons that are on; drawn with their second-state look. */
	readonly buttonStates = input<Record<string, boolean>>({});
	readonly pressed = output<Button>();
}
