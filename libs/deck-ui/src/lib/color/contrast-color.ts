/** Above this relative luminance a key colour is light enough to need dark icons and text. */
const LIGHT_LUMINANCE = 0.4;

/** Relative luminance per WCAG; used to choose black or white icons on a key colour. */
export function contrastColor(hex: string): '#ffffff' | '#111111' {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!match) {
		return '#ffffff';
	}
	const channel = (offset: number) => {
		const value = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
	return luminance > LIGHT_LUMINANCE ? '#111111' : '#ffffff';
}
