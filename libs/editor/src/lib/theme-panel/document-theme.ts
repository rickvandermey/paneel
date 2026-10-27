import { readStored, writeStored } from '../shared/browser-storage';
import { DEFAULT_THEME, type ResolvedTheme } from './themes';

const THEME_STORAGE_KEY = 'sd.theme';

/** The theme of the last visit, so a reload does not flash the default before the config arrives. */
export function readCachedTheme(): string | null {
	return readStored('local', THEME_STORAGE_KEY);
}

/**
 * Applies a theme to <html>, where sheets, menus and the body background all pick it up.
 * Built-in themes are CSS blocks selected by data-theme; custom themes set their tokens inline.
 */
export function applyThemeToDocument(themeId: string, resolved: ResolvedTheme): void {
	const root = document.documentElement;
	root.dataset['theme'] = resolved.base;
	// Clear the inline tokens of a previous custom theme before setting the new ones.
	for (const name of Array.from(root.style)) {
		if (name.startsWith('--sd-')) {
			root.style.removeProperty(name);
		}
	}
	for (const [name, value] of Object.entries(resolved.vars ?? {})) {
		root.style.setProperty(name, value);
	}
	// A custom theme needs the config to be rebuilt, so the cache remembers the default instead.
	writeStored('local', THEME_STORAGE_KEY, resolved.vars ? DEFAULT_THEME : themeId);
}
