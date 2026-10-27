export interface GridSpec {
	columns: number;
	rows: number;
	/** Key size in CSS pixels; keys are square. */
	size: number;
	gap: number;
}

export interface GridOptions {
	/** Key size the grid aims for; the real size stretches to fill the width. */
	targetSize?: number;
	minSize?: number;
	maxSize?: number;
	gap?: number;
}

/**
 * The minimum stays well above the WCAG target sizes (24 px for 2.5.8, 44 px for 2.5.5) and the
 * platform guidelines (44 pt, 48 dp) because a key also carries a label and an icon.
 */
const DEFAULTS: Omit<Required<GridOptions>, 'targetSize'> = {
	minSize: 72,
	maxSize: 200,
	gap: 12,
};

/** Screens whose shorter side is below this are phones, in either orientation. */
const PHONE_MAX_SHORT_SIDE = 600;
/** Up to this shorter side a screen is a tablet or a desktop window; beyond it a large monitor. */
const TABLET_MAX_SHORT_SIDE = 900;
const PHONE_KEY_SIZE = 112;
const TABLET_KEY_SIZE = 144;
const MONITOR_KEY_SIZE = 176;

/**
 * Larger screens get larger keys rather than more of them, so a page stays easy to scan. The
 * class follows the shorter side: a phone held sideways is still a phone, and a tablet is a
 * tablet in both orientations. Phones land on 3 x 5, tablets on 5 x 6, a desktop window on 8 x 4.
 */
function targetKeySize(width: number, height: number): number {
	const shortSide = Math.min(width, height);
	if (shortSide < PHONE_MAX_SHORT_SIDE) {
		return PHONE_KEY_SIZE;
	}
	return shortSide < TABLET_MAX_SHORT_SIDE ? TABLET_KEY_SIZE : MONITOR_KEY_SIZE;
}

/**
 * A fixed rhythm per screen: the number of columns follows the width at the target key size, the
 * rows follow the height, and the keys stretch to fill the width. The grid never depends on how
 * many keys a page has, so keys keep their size and place while a page grows and extra keys
 * spill into further sets.
 */
export function computeGrid(width: number, height: number, options: GridOptions = {}): GridSpec {
	const { minSize, maxSize, gap } = { ...DEFAULTS, ...options };
	const targetSize = options.targetSize ?? targetKeySize(width, height);
	const stretchedFor = (columns: number) => (width - (columns - 1) * gap) / columns;
	let columns = Math.max(1, Math.round((width + gap) / (targetSize + gap)));
	// Narrow screens round to a column count whose keys would drop below the minimum.
	while (columns > 1 && stretchedFor(columns) < minSize) {
		columns -= 1;
	}
	const size = Math.floor(Math.min(maxSize, Math.max(minSize, stretchedFor(columns))));
	const rows = Math.max(1, Math.floor((height + gap) / (size + gap)));
	return { columns, rows, size, gap };
}

/** Splits the keys into screenfuls of setSize; an empty list still gives one empty set to show. */
export function splitIntoSets<T>(items: T[], setSize: number): T[][] {
	if (setSize <= 0) {
		return [items];
	}
	const sets: T[][] = [];
	for (let index = 0; index < items.length; index += setSize) {
		sets.push(items.slice(index, index + setSize));
	}
	return sets.length ? sets : [[]];
}
