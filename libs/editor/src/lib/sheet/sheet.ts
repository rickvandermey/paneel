import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Modal panel: a bottom sheet on phones and a side panel on wide screens. */
@Component({
	selector: 'sd-sheet',
	templateUrl: './sheet.html',
	styleUrl: './sheet.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(keydown.escape)': 'closed.emit()',
	},
})
export class Sheet {
	readonly title = input.required<string>();
	readonly closed = output<void>();
}
