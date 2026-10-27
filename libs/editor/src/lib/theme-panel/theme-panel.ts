import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DeckKey } from '@sd/deck-ui';
import { CustomTheme } from '@sd/protocol';
import { customThemeVars, varsToStyle } from './custom-theme';
import { SAMPLE_KEYS } from './sample-keys';
import { builtInBaseOf, DEFAULT_THEME, themeGroups } from './themes';

/** Lists built-in and custom themes as cards rendered in their own colors. */
@Component({
	selector: 'sd-theme-panel',
	imports: [DeckKey],
	templateUrl: './theme-panel.html',
	styleUrl: './theme-panel.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemePanel {
	readonly activeTheme = input(DEFAULT_THEME);
	readonly customThemes = input<CustomTheme[]>([]);
	readonly selected = output<string>();
	readonly createRequested = output<void>();
	readonly editRequested = output<CustomTheme>();
	readonly deleteRequested = output<CustomTheme>();

	readonly groups = themeGroups();
	readonly samples = SAMPLE_KEYS;
	readonly confirmingDeleteId = signal<string | null>(null);
	/** Custom themes render their card in their own tokens, on top of their base theme. */
	readonly customCards = computed(() =>
		this.customThemes().map((theme) => ({
			theme,
			base: builtInBaseOf(theme),
			style: varsToStyle(customThemeVars(theme)),
		})),
	);

	/** The first press arms the delete, the second one within the same card confirms it. */
	requestDelete(theme: CustomTheme): void {
		if (this.confirmingDeleteId() === theme.id) {
			this.confirmingDeleteId.set(null);
			this.deleteRequested.emit(theme);
			return;
		}
		this.confirmingDeleteId.set(theme.id);
	}
}
