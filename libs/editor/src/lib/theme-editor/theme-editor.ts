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
import { CustomTheme } from '@sd/protocol';
import {
	customThemeVars,
	readThemeSeed,
	ThemeSeed,
	varsToStyle,
} from '../theme-panel/custom-theme';
import { SAMPLE_KEYS } from '../theme-panel/sample-keys';
import { DEFAULT_THEME, THEMES } from '../theme-panel/themes';

/** Builds a custom theme from a handful of values with a live preview. */
@Component({
	selector: 'sd-theme-editor',
	imports: [FormsModule, DeckKey],
	templateUrl: './theme-editor.html',
	styleUrl: './theme-editor.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeEditor implements OnInit {
	/** Null creates a new theme. */
	readonly theme = input<CustomTheme | null>(null);
	readonly saved = output<CustomTheme>();
	readonly cancelled = output<void>();

	readonly bases = THEMES;
	readonly samples = SAMPLE_KEYS;
	readonly name = signal('');
	readonly base = signal(DEFAULT_THEME);
	readonly bg = signal('#111827');
	readonly surface = signal('#1f2937');
	readonly text = signal('#f9fafb');
	readonly accent = signal('#2563eb');
	readonly light = signal('');
	readonly keyRadius = signal(18);
	readonly keyMix = signal(100);
	readonly blur = signal(0);

	readonly draft = computed<CustomTheme>(() => ({
		id: this.theme()?.id ?? '',
		name: this.name().trim(),
		base: this.base(),
		bg: this.bg(),
		surface: this.surface(),
		text: this.text(),
		accent: this.accent(),
		light: this.light() || undefined,
		keyRadius: this.keyRadius(),
		keyMix: this.keyMix(),
		blur: this.blur(),
	}));
	readonly previewStyle = computed(() => varsToStyle(customThemeVars(this.draft())));
	readonly valid = computed(() => this.name().trim().length > 0);

	/** Inputs are only set after construction, so the draft is loaded here. */
	ngOnInit(): void {
		this.loadDraft();
	}

	loadDraft(): void {
		const theme = this.theme();
		if (theme) {
			this.name.set(theme.name);
			this.light.set(theme.light ?? '');
			this.applyValues(theme.base, theme);
			return;
		}
		this.name.set('');
		this.startFrom(DEFAULT_THEME);
	}

	/** Copies the values of a built-in theme so the user edits from something that already works. */
	startFrom(base: string): void {
		this.applyValues(base, readThemeSeed(base));
	}

	private applyValues(base: string, values: ThemeSeed): void {
		this.base.set(base);
		this.bg.set(values.bg);
		this.surface.set(values.surface);
		this.text.set(values.text);
		this.accent.set(values.accent);
		this.keyRadius.set(values.keyRadius);
		this.keyMix.set(values.keyMix);
		this.blur.set(values.blur);
	}

	save(): void {
		if (!this.valid()) {
			return;
		}
		this.saved.emit({ ...this.draft(), id: this.theme()?.id ?? randomId() });
	}
}
