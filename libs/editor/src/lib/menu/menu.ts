import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ConnectionStatus } from '@sd/host-client';
import { Profile } from '@sd/protocol';
import { emojiOf, phosphorIconClass } from '../shared/icons';

export type MenuItem =
	'edit' | 'catalog' | 'app-catalog' | 'assistant' | 'profiles' | 'theme' | 'settings';

/** Hamburger drawer with the main entries and a quick profile switch. */
@Component({
	selector: 'sd-menu',
	templateUrl: './menu.html',
	styleUrl: './menu.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(keydown.escape)': 'closed.emit()',
	},
})
export class Menu {
	readonly profiles = input.required<Profile[]>();
	readonly activeProfileId = input<string | null>(null);
	readonly editing = input(false);
	readonly status = input<ConnectionStatus>('idle');
	readonly hostName = input('');
	readonly selected = output<MenuItem>();
	readonly profileSelected = output<string>();
	readonly closed = output<void>();

	readonly emojiOf = emojiOf;

	iconClass(profile: Profile): string {
		return phosphorIconClass(profile.icon, 'square');
	}
}
