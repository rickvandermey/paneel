import { CustomPalette } from '@sd/protocol';
import { Button } from '@sd/protocol';
import { groupBy } from '../shared/group-by';

/** A per-page color set: key colors handed out in turn, plus a faint tint behind the deck. */
export interface Palette {
	id: string;
	name: string;
	description: string;
	/** Section in the picker; palettes are ordered by hue within it. */
	group: string;
	colors: string[];
	/** CSS background for the deck area; keeps pages apart while swiping. */
	tint: string;
}

export const NO_PALETTE = 'none';

/** A faint glow of the palette's main color at the top of the deck. */
function radialTint(rgb: string, alpha = 0.14): string {
	return `radial-gradient(120% 80% at 50% 0%, rgb(${rgb} / ${alpha}), transparent 70%)`;
}

export const PALETTES: Palette[] = [
	{
		id: NO_PALETTE,
		name: 'None',
		description: 'Every button keeps its own color.',
		group: 'Neutral',
		colors: [],
		tint: 'none',
	},
	{
		id: 'mono',
		name: 'Mono',
		description: 'Grays for a quiet page.',
		group: 'Neutral',
		colors: ['#374151', '#4b5563', '#1f2937', '#6b7280', '#111827', '#9ca3af'],
		tint: 'none',
	},
	{
		id: 'carbon',
		name: 'Carbon',
		description: 'Black and white, alternating.',
		group: 'Neutral',
		colors: ['#0b0b0d', '#f3f4f6', '#1f2023', '#e5e7eb', '#111113', '#d1d5db'],
		tint: 'none',
	},
	{
		id: 'sand',
		name: 'Sand',
		description: 'Beige, taupe and terracotta.',
		group: 'Neutral',
		colors: ['#a8a29e', '#c2410c', '#78716c', '#d6d3d1', '#9a3412', '#57534e'],
		tint: radialTint('168 162 158'),
	},
	{
		id: 'honey',
		name: 'Honey',
		description: 'Yellows and gold.',
		group: 'Warm',
		colors: ['#eab308', '#ca8a04', '#facc15', '#a16207', '#fde047', '#d97706'],
		tint: radialTint('234 179 8'),
	},
	{
		id: 'ember',
		name: 'Ember',
		description: 'Copper, rust and brown.',
		group: 'Warm',
		colors: ['#b45309', '#92400e', '#a0522d', '#78350f', '#8b5a2b', '#7c2d12'],
		tint: radialTint('180 83 9'),
	},
	{
		id: 'sunset',
		name: 'Sunset',
		description: 'Bright oranges and reds.',
		group: 'Warm',
		colors: ['#f97316', '#dc2626', '#ea580c', '#b91c1c', '#f59e0b', '#ef4444'],
		tint: radialTint('249 115 22', 0.16),
	},
	{
		id: 'wine',
		name: 'Wine',
		description: 'Burgundy and deep rose.',
		group: 'Warm',
		colors: ['#9f1239', '#881337', '#be123c', '#4c0519', '#e11d48', '#6b0f2a'],
		tint: radialTint('159 18 57', 0.16),
	},
	{
		id: 'berry',
		name: 'Berry',
		description: 'Magenta, fuchsia and plum.',
		group: 'Purple',
		colors: ['#c026d3', '#a21caf', '#d946ef', '#86198f', '#db2777', '#701a75'],
		tint: radialTint('192 38 211', 0.16),
	},
	{
		id: 'lavender',
		name: 'Lavender',
		description: 'Violet, indigo and periwinkle.',
		group: 'Purple',
		colors: ['#8b5cf6', '#6366f1', '#a78bfa', '#4f46e5', '#7c3aed', '#818cf8'],
		tint: radialTint('139 92 246'),
	},
	{
		id: 'ocean',
		name: 'Ocean',
		description: 'Sky blue to navy.',
		group: 'Cool',
		colors: ['#2563eb', '#0ea5e9', '#1d4ed8', '#3b82f6', '#1e3a8a', '#1e40af'],
		tint: radialTint('37 99 235', 0.16),
	},
	{
		id: 'lagoon',
		name: 'Lagoon',
		description: 'Teal and cyan.',
		group: 'Cool',
		colors: ['#0f766e', '#0891b2', '#115e59', '#06b6d4', '#14b8a6', '#155e75'],
		tint: radialTint('13 148 136', 0.16),
	},
	{
		id: 'mint',
		name: 'Mint',
		description: 'Fresh mint and aqua.',
		group: 'Cool',
		colors: ['#10b981', '#34d399', '#2dd4bf', '#059669', '#6ee7b7', '#5eead4'],
		tint: radialTint('16 185 129'),
	},
	{
		id: 'forest',
		name: 'Forest',
		description: 'Deep greens.',
		group: 'Cool',
		colors: ['#16a34a', '#15803d', '#166534', '#22c55e', '#14532d', '#4d7c0f'],
		tint: radialTint('22 163 74'),
	},
	{
		id: 'royal',
		name: 'Royal',
		description: 'Navy and gold, for a formal page.',
		group: 'Mixed',
		colors: ['#1b2a63', '#b8860b', '#243b8c', '#cf9b1f', '#0f1a3d', '#e0b341'],
		tint: radialTint('30 58 138', 0.2),
	},
	{
		id: 'steel',
		name: 'Steel',
		description: 'Cool blue-grays.',
		group: 'Cool',
		colors: ['#475569', '#64748b', '#334155', '#94a3b8', '#1e293b', '#7b8ca3'],
		tint: radialTint('100 116 139'),
	},
	{
		id: 'indigo',
		name: 'Indigo',
		description: 'Deep indigo to cornflower.',
		group: 'Cool',
		colors: ['#3730a3', '#4338ca', '#312e81', '#5b5bd6', '#1e1b4b', '#6b7ddb'],
		tint: radialTint('67 56 202', 0.16),
	},
	{
		id: 'lime',
		name: 'Lime',
		description: 'Zesty lime and chartreuse.',
		group: 'Cool',
		colors: ['#84cc16', '#a3e635', '#65a30d', '#bef264', '#5a8f10', '#3f6212'],
		tint: radialTint('132 204 22'),
	},
	{
		id: 'cherry',
		name: 'Cherry',
		description: 'Clear reds and crimson.',
		group: 'Warm',
		colors: ['#e5173f', '#c41244', '#f0506b', '#a3123b', '#ff8599', '#8c1536'],
		tint: radialTint('225 29 72'),
	},
	{
		id: 'cocoa',
		name: 'Cocoa',
		description: 'Chocolate, caramel and cream.',
		group: 'Warm',
		colors: ['#5c3a21', '#8b5e34', '#3f2a18', '#c89b6d', '#704a2a', '#e8d2b8'],
		tint: radialTint('139 94 52', 0.16),
	},
	{
		id: 'sorbet',
		name: 'Sorbet',
		description: 'Warm pastels: peach, lemon, rose.',
		group: 'Pastel',
		colors: ['#fdba74', '#fde68a', '#fecdd3', '#fca5a5', '#fed7aa', '#f8b4d9'],
		tint: radialTint('253 186 116', 0.16),
	},
	{
		id: 'breeze',
		name: 'Breeze',
		description: 'Cool pastels: sky, mint, lilac.',
		group: 'Pastel',
		colors: ['#bae6fd', '#a7f3d0', '#ddd6fe', '#99f6e4', '#c7d2fe', '#bbf7d0'],
		tint: radialTint('186 230 253', 0.18),
	},
	{
		id: 'dusk',
		name: 'Dusk',
		description: 'Violet fading into orange.',
		group: 'Mixed',
		colors: ['#5b21b6', '#7e22ce', '#be185d', '#c4461a', '#ec6a1f', '#f5a623'],
		tint: radialTint('126 34 206', 0.16),
	},
	{
		id: 'rainbow',
		name: 'Rainbow',
		description: 'One color per hue, in order.',
		group: 'Mixed',
		colors: ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'],
		tint: 'none',
	},
	{
		id: 'earth',
		name: 'Earth',
		description: 'Moss, clay and stone.',
		group: 'Mixed',
		colors: ['#4a6b1a', '#a0441c', '#5f5a53', '#6b8e23', '#86381a', '#8a827b'],
		tint: radialTint('154 52 18'),
	},
	{
		id: 'candy',
		name: 'Candy',
		description: 'Bright pastels with dark icons.',
		group: 'Pastel',
		colors: ['#fda4af', '#fcd34d', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4'],
		tint: radialTint('253 164 175'),
	},
];

export function paletteById(id: string | undefined | null, custom: CustomPalette[] = []): Palette {
	const builtIn = PALETTES.find((palette) => palette.id === id);
	if (builtIn) {
		return builtIn;
	}
	const own = custom.find((palette) => palette.id === id);
	return own ? paletteFromCustom(own) : PALETTES[0];
}

function paletteFromCustom(palette: CustomPalette): Palette {
	return {
		id: palette.id,
		name: palette.name,
		description: 'Your own palette.',
		group: 'Custom',
		colors: palette.colors,
		tint: palette.tint ? tintForColor(palette.tint) : 'none',
	};
}

/** The deck background for a custom palette, from its chosen tint color. */
export function tintForColor(color: string): string {
	return `radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, ${color} 16%, transparent), transparent 70%)`;
}

/** Color for the button at this position, or null when the page has no palette. */
export function paletteColor(
	id: string | undefined | null,
	index: number,
	custom: CustomPalette[] = [],
): string | null {
	const palette = paletteById(id, custom);
	if (palette.colors.length === 0) {
		return null;
	}
	return palette.colors[index % palette.colors.length];
}

/** Which buttons change color under a palette, in page order, folders included. */
export function recolorPlan(
	buttons: Button[],
	paletteId: string | undefined | null,
	custom: CustomPalette[] = [],
): { button: Button; color: string }[] {
	const plan: { button: Button; color: string }[] = [];
	let position = 0;
	const walk = (list: Button[]) => {
		for (const button of list) {
			const color = paletteColor(paletteId, position++, custom);
			if (color && color !== button.color) {
				plan.push({ button, color });
			}
			if (button.folder) {
				walk(button.folder);
			}
		}
	};
	walk(buttons);
	return plan;
}

/** Gives each button the palette color of its position; without a palette the colors stay. */
export function applyPaletteColors<T extends { color: string }>(
	buttons: T[],
	paletteId: string | undefined | null,
	custom: CustomPalette[] = [],
): T[] {
	return buttons.map((button, index) => ({
		...button,
		color: paletteColor(paletteId, index, custom) ?? button.color,
	}));
}

/** Palettes grouped in picker order. */
export function paletteGroups(): { name: string; palettes: Palette[] }[] {
	return groupBy(PALETTES, (palette) => palette.group).map((group) => ({
		name: group.name,
		palettes: group.items,
	}));
}
