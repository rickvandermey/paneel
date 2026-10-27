import { NO_PALETTE, paletteById, paletteColor, paletteGroups } from './palettes';

describe('palettes', () => {
	it('falls back to no palette for unknown ids', () => {
		expect(paletteById('nope').id).toBe(NO_PALETTE);
		expect(paletteColor(undefined, 3)).toBeNull();
	});

	it('hands out colors in turn and wraps around', () => {
		const first = paletteColor('ocean', 0);
		expect(first).toBe(paletteById('ocean').colors[0]);
		expect(paletteColor('ocean', 6)).toBe(first);
	});
});

describe('palette distinctness', () => {
	it('never reuses a color across palettes', () => {
		const seen = new Map<string, string>();
		for (const group of paletteGroups()) {
			for (const palette of group.palettes) {
				for (const color of palette.colors) {
					const owner = seen.get(color);
					expect(owner, `${color} in ${palette.id} and ${owner}`).toBeUndefined();
					seen.set(color, palette.id);
				}
			}
		}
	});
});
