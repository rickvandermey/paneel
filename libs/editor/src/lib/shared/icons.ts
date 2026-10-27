import type { IconRef } from '@sd/protocol';

/** A Phosphor icon reference; the fill weight is what presets and pages use. */
export function phosphor(name: string): IconRef {
	return { source: 'phosphor', name, weight: 'fill' };
}

/**
 * The CSS classes that draw an icon reference as a Phosphor icon, or the fallback icon when
 * the reference is not a Phosphor one. Keeps templates free of casts on the icon union.
 */
export function phosphorIconClass(
	icon: IconRef | null | undefined,
	fallbackName: string,
	weight: 'regular' | 'fill' = 'regular',
): string {
	const weightClass = weight === 'fill' ? 'ph-fill' : 'ph';
	if (icon?.source === 'phosphor') {
		return `${weightClass} ph-${icon.name}`;
	}
	return `${weightClass} ph-${fallbackName}`;
}

/** The emoji of an emoji icon reference, or an empty string for any other icon. */
export function emojiOf(icon: IconRef | null | undefined): string {
	return icon?.source === 'emoji' ? icon.value : '';
}
