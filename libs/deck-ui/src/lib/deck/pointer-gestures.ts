/** How far a pointer must travel before a release counts as a swipe rather than a tap. */
export const SWIPE_THRESHOLD_PX = 48;
/** Width of the zone at the left and right edge that flips to the next set while dragging. */
export const EDGE_ZONE_PX = 28;

export type SwipeOutcome =
	'none' | 'next-set' | 'previous-set' | 'next-profile' | 'previous-profile';

/** Classifies a pointer release: horizontal swipes change sets, vertical ones change profiles. */
export function swipeOutcome(dx: number, dy: number): SwipeOutcome {
	if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) {
		return 'none';
	}
	if (Math.abs(dx) >= Math.abs(dy)) {
		return dx < 0 ? 'next-set' : 'previous-set';
	}
	return dy < 0 ? 'next-profile' : 'previous-profile';
}

/**
 * While dragging a key, holding it near an edge moves to the neighbouring set so a key can be
 * dropped on another set. Returns the step to take, or 0 when not at an edge or no set is there.
 */
export function edgeSwitchStep(
	clientX: number,
	rect: DOMRect,
	setIndex: number,
	setCount: number,
): -1 | 0 | 1 {
	if (clientX < rect.left + EDGE_ZONE_PX && setIndex > 0) {
		return -1;
	}
	if (clientX > rect.right - EDGE_ZONE_PX && setIndex < setCount - 1) {
		return 1;
	}
	return 0;
}

/** The id of the deck key under the given element, or null when the element is not inside a key. */
export function keyIdAt(target: EventTarget | Element | null): string | null {
	if (!(target instanceof Element)) {
		return null;
	}
	return target.closest<HTMLElement>('sd-deck-key')?.dataset['keyId'] ?? null;
}
