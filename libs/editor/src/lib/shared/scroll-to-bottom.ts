import { effect, type ElementRef, type Signal } from '@angular/core';

/**
 * Keeps a list scrolled to its newest entry, like a terminal, whenever the trigger signal
 * changes. Call it from a constructor, because it registers an effect.
 */
export function scrollToBottomOnChange(
	trigger: Signal<unknown>,
	element: Signal<ElementRef<HTMLElement> | undefined>,
): void {
	effect(() => {
		trigger();
		const native = element()?.nativeElement;
		if (native) {
			// The new entry is rendered after this effect runs, so the scroll waits a tick.
			queueMicrotask(() => native.scrollTo({ top: native.scrollHeight }));
		}
	});
}
