import type { DestroyRef } from '@angular/core';

export interface Size {
	width: number;
	height: number;
}

/**
 * Reports the element's content size whenever it changes, until the owner is destroyed. Does
 * nothing where ResizeObserver does not exist (server rendering, some test runners).
 */
export function observeSize(
	element: HTMLElement,
	destroyRef: DestroyRef,
	onSize: (size: Size) => void,
): void {
	if (typeof ResizeObserver === 'undefined') {
		return;
	}
	const observer = new ResizeObserver((entries) => {
		const rect = entries[0]?.contentRect;
		if (rect && rect.width > 0 && rect.height > 0) {
			onSize({ width: rect.width, height: rect.height });
		}
	});
	observer.observe(element);
	destroyRef.onDestroy(() => observer.disconnect());
}
