import { CustomTheme } from '@sd/protocol';
import { groupBy } from '../shared/group-by';
import { customThemeVars } from './custom-theme';

export interface ThemeInfo {
	id: string;
	name: string;
	description: string;
	/** Section in the picker. */
	group: string;
}

export const DEFAULT_THEME = 'midnight';

/** Ids match the [data-theme] blocks in styles/themes.css. */
export const THEMES: ThemeInfo[] = [
	{
		id: 'midnight',
		name: 'Midnight',
		description: 'Dark slate with a blue accent. The default.',
		group: 'Dark',
	},
	{
		id: 'graphite',
		name: 'Graphite',
		description: 'Neutral dark gray with a quiet steel accent.',
		group: 'Dark',
	},
	{
		id: 'hardware',
		name: 'Hardware',
		description: 'Charcoal with bevelled keys and monospace labels.',
		group: 'Dark',
	},
	{
		id: 'arctic',
		name: 'Arctic',
		description: 'Muted blue-gray with frost highlights.',
		group: 'Tinted',
	},
	{
		id: 'moss',
		name: 'Moss',
		description: 'Dark green-black with a sage accent.',
		group: 'Tinted',
	},
	{
		id: 'espresso',
		name: 'Espresso',
		description: 'Warm brown-black with a copper accent.',
		group: 'Tinted',
	},
	{
		id: 'neon',
		name: 'Neon',
		description: 'Glass over black with cyan and violet glow.',
		group: 'Expressive',
	},
	{
		id: 'magenta',
		name: 'Magenta',
		description: 'Frosted glass over plum with magenta and aqua light.',
		group: 'Expressive',
	},
	{
		id: 'daylight',
		name: 'Daylight',
		description: 'Clean light theme with cool grays and a blue accent.',
		group: 'Light',
	},
	{
		id: 'paper',
		name: 'Paper',
		description: 'Warm light theme with soft shadows and serif headings.',
		group: 'Light',
	},
];

/** Themes grouped in picker order. */
export function themeGroups(): { name: string; themes: ThemeInfo[] }[] {
	return groupBy(THEMES, (theme) => theme.group).map((group) => ({
		name: group.name,
		themes: group.items,
	}));
}

export function isBuiltInTheme(id: string | undefined | null): boolean {
	return THEMES.some((theme) => theme.id === id);
}

/** The id when it names a built-in or custom theme, otherwise the default. */
export function knownThemeIdOrDefault(
	value: string | undefined | null,
	custom: CustomTheme[] = [],
): string {
	if (isBuiltInTheme(value) || custom.some((theme) => theme.id === value)) {
		return value as string;
	}
	return DEFAULT_THEME;
}

/** The built-in theme a custom theme keeps its fonts and bevels from; unknown bases use the default. */
export function builtInBaseOf(theme: CustomTheme): string {
	return isBuiltInTheme(theme.base) ? theme.base : DEFAULT_THEME;
}

/** What the document needs for a theme: the built-in data-theme and, for custom, its vars. */
export interface ResolvedTheme {
	base: string;
	vars: Record<string, string> | null;
}

export function resolveTheme(id: string, custom: CustomTheme[]): ResolvedTheme {
	const found = custom.find((theme) => theme.id === id);
	if (!found) {
		return { base: id, vars: null };
	}
	return { base: builtInBaseOf(found), vars: customThemeVars(found) };
}
