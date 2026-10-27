import { signal } from '@angular/core';

export interface ToastAction {
	label: string;
	run: () => void;
}

export interface Toast {
	message: string;
	action?: ToastAction;
}

const TOAST_MS = 1800;
/** A toast with an Undo button stays longer, so the user has time to read and press it. */
const TOAST_WITH_ACTION_MS = 8000;

/** One toast at a time; a new one replaces the current one and restarts the timer. */
export class ToastQueue {
	readonly current = signal<Toast | null>(null);
	private timer: ReturnType<typeof setTimeout> | null = null;

	show(message: string, action?: ToastAction): void {
		this.current.set({ message, action });
		if (this.timer) {
			clearTimeout(this.timer);
		}
		this.timer = setTimeout(
			() => this.current.set(null),
			action ? TOAST_WITH_ACTION_MS : TOAST_MS,
		);
	}

	runAction(): void {
		const action = this.current()?.action;
		this.current.set(null);
		action?.run();
	}
}
