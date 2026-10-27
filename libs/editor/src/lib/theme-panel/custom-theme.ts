import { contrastColor } from '@sd/deck-ui';
import { CustomTheme } from '@sd/protocol';

/** Values read from a built-in theme to prefill the editor. */
export interface ThemeSeed {
	bg: string;
	surface: string;
	text: string;
	accent: string;
	keyRadius: number;
	keyMix: number;
	blur: number;
}

/**
 * Derives every token from the few values a custom theme stores. Fonts, danger colors and key
 * bevels stay those of the base theme; a key opacity below 100 switches the keys to glass.
 */
export function customThemeVars(theme: CustomTheme): Record<string, string> {
	const glassPanels = theme.blur > 0;
	const glassKeys = theme.keyMix < 100;
	const vars: Record<string, string> = {
		'--sd-bg': theme.bg,
		'--sd-bg-image': theme.light
			? `radial-gradient(60% 45% at 15% 5%, color-mix(in srgb, ${theme.light} 40%, transparent), transparent 65%), radial-gradient(50% 40% at 90% 95%, color-mix(in srgb, ${theme.accent} 25%, transparent), transparent 65%)`
			: 'none',
		'--sd-surface': glassPanels
			? `color-mix(in srgb, ${theme.surface} 55%, transparent)`
			: theme.surface,
		'--sd-surface-2': `color-mix(in srgb, ${theme.surface} 85%, ${theme.text})`,
		'--sd-surface-blur': glassPanels ? `blur(${theme.blur}px) saturate(1.3)` : 'none',
		'--sd-surface-border': glassPanels
			? `1px solid color-mix(in srgb, ${theme.text} 18%, transparent)`
			: '1px solid transparent',
		'--sd-border': `color-mix(in srgb, ${theme.surface} 70%, ${theme.text})`,
		'--sd-text': theme.text,
		'--sd-text-muted': `color-mix(in srgb, ${theme.text} 65%, ${theme.bg})`,
		'--sd-text-faint': `color-mix(in srgb, ${theme.text} 40%, ${theme.bg})`,
		'--sd-accent': theme.accent,
		'--sd-accent-text': contrastColor(theme.accent),
		'--sd-accent-soft': `color-mix(in srgb, ${theme.accent} 60%, ${theme.text})`,
		'--sd-overlay': `color-mix(in srgb, ${theme.bg} 60%, transparent)`,
		'--sd-key-radius': `${theme.keyRadius}%`,
		'--sd-key-mix': `${theme.keyMix}%`,
		'--sd-key-blur': glassKeys ? 'blur(8px)' : 'none',
	};
	if (glassKeys) {
		vars['--sd-key-gloss'] = 'linear-gradient(rgb(255 255 255 / 0.12), transparent 55%)';
		vars['--sd-key-shadow'] =
			'0 0 0 1px rgb(255 255 255 / 0.22) inset, 0 8px 24px rgb(0 0 0 / 0.3)';
		vars['--sd-key-border'] = '0';
	}
	return vars;
}

export function varsToStyle(vars: Record<string, string>): string {
	return Object.entries(vars)
		.map(([name, value]) => `${name}: ${value}`)
		.join('; ');
}

/** Reads the tokens a built-in theme resolves to, by rendering an element in that theme. */
export function readThemeSeed(base: string): ThemeSeed {
	const probe = document.createElement('div');
	probe.dataset['theme'] = base;
	probe.style.display = 'none';
	document.body.appendChild(probe);
	const style = getComputedStyle(probe);
	const token = (name: string) => style.getPropertyValue(name).trim();
	const percent = (value: string, fallback: number) => {
		const parsed = parseFloat(value);
		return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
	};
	const blurMatch = /blur\((\d+(?:\.\d+)?)px\)/.exec(token('--sd-surface-blur'));
	const seed: ThemeSeed = {
		bg: toHex(token('--sd-bg'), '#111827'),
		surface: toHex(token('--sd-surface'), '#1f2937'),
		text: toHex(token('--sd-text'), '#f9fafb'),
		accent: toHex(token('--sd-accent'), '#2563eb'),
		keyRadius: percent(token('--sd-key-radius'), 18),
		keyMix: percent(token('--sd-key-mix'), 100),
		blur: blurMatch ? Math.round(parseFloat(blurMatch[1])) : 0,
	};
	probe.remove();
	return seed;
}

/** Color inputs only accept #rrggbb; translucent or named values fall back. */
function toHex(value: string, fallback: string): string {
	return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}
