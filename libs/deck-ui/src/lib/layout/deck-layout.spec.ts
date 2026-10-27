import { computeGrid, splitIntoSets } from './deck-layout';
import { contrastColor } from '../color/contrast-color';

describe('computeGrid', () => {
	const footprint = (grid: ReturnType<typeof computeGrid>) =>
		grid.size * grid.columns + grid.gap * (grid.columns - 1);

	it('gives a phone a 3 by 5 grid that fills the width', () => {
		const grid = computeGrid(390, 690);
		expect(grid.columns).toBe(3);
		expect(grid.rows).toBe(5);
		expect(footprint(grid)).toBeLessThanOrEqual(390);
		expect(footprint(grid)).toBeGreaterThan(380);
	});

	it('keeps phone-sized keys when the phone is held sideways', () => {
		expect(computeGrid(844, 300)).toMatchObject({ columns: 7, rows: 2 });
	});

	it('gives tablets and desktop windows larger keys instead of more of them', () => {
		expect(computeGrid(768, 944)).toMatchObject({ columns: 5, rows: 6, size: 144 });
		expect(computeGrid(820, 1124)).toMatchObject({ columns: 5, rows: 6, size: 154 });
		expect(computeGrid(1180, 764)).toMatchObject({ columns: 8, rows: 5 });
		expect(computeGrid(1280, 744)).toMatchObject({ columns: 8, rows: 4, size: 149 });
	});

	it('scales up again on a large monitor within the maximum', () => {
		const monitor = computeGrid(1920, 1000);
		expect(monitor).toMatchObject({ columns: 10, rows: 5 });
		expect(monitor.size).toBeLessThanOrEqual(200);
	});

	it('keeps the key size between the minimum and the maximum', () => {
		expect(computeGrid(500, 500, { targetSize: 400 }).size).toBe(200);
		const tiny = computeGrid(60, 60);
		expect(tiny.columns).toBe(1);
		expect(tiny.rows).toBe(1);
		expect(tiny.size).toBe(72);
	});

	it('drops a column rather than shrinking keys below the minimum', () => {
		// 150 px rounds to one column at the target size; 200 px rounds to two but 94 px keys fit.
		expect(computeGrid(150, 400).columns).toBe(1);
		expect(computeGrid(200, 400)).toMatchObject({ columns: 2, size: 94 });
	});
});

describe('splitIntoSets', () => {
	it('splits into sets and always returns at least one set', () => {
		expect(splitIntoSets([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(splitIntoSets([], 4)).toEqual([[]]);
	});
});

describe('contrastColor', () => {
	it('picks dark icons on light keys and white on dark keys', () => {
		expect(contrastColor('#facc15')).toBe('#111111');
		expect(contrastColor('#1e3a8a')).toBe('#ffffff');
		expect(contrastColor('nonsense')).toBe('#ffffff');
	});
});
