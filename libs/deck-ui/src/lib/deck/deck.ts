import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	input,
	linkedSignal,
	output,
	signal,
} from '@angular/core';
import { Button, Profile } from '@sd/protocol';
import { AssetUrlFn } from '../deck-key/deck-key';
import { DeckSet } from '../deck-set/deck-set';
import { computeGrid, GridSpec, splitIntoSets } from '../layout/deck-layout';
import { observeSize } from '../layout/observe-size';
import { buttonsAtPath } from './folder-navigation';
import { edgeSwitchStep, keyIdAt, swipeOutcome } from './pointer-gestures';
import {
	ADD_KEY,
	ADD_KEY_ID,
	BACK_KEY,
	BACK_KEY_ID,
	indexAmongRealButtons,
	isVirtualKeyId,
} from './virtual-keys';

/** Movement before a pressed key is picked up for dragging (mouse) or the long press is cancelled (touch). */
const DRAG_START_PX = 8;
/** How long a finger must rest on a key before it can be dragged; a shorter touch is a swipe. */
const LONG_PRESS_MS = 250;
/** Minimum time between two edge switches while dragging, so one hover does not fly past every set. */
const EDGE_SWITCH_MS = 700;
const DRAG_START_HAPTIC_MS = 10;
/** Used until the first measurement arrives; roughly a phone, so the first paint is close. */
const DEFAULT_VIEWPORT = { width: 360, height: 640 };

export interface MoveRequest {
	id: string;
	/** Index within the list that holds the button (profile root or the open folder). */
	index: number;
}

export type SwipeDirection = 'next' | 'previous';

interface GestureStart {
	x: number;
	y: number;
	pointerId: number;
}

/**
 * Shows one profile as swipeable sets of keys. Folders open in place with a back key; vertical
 * swipes are reported to the parent so it can switch profiles. In edit mode keys can be dragged
 * onto each other to reorder them.
 */
@Component({
	selector: 'sd-deck',
	imports: [DeckSet],
	templateUrl: './deck.html',
	styleUrl: './deck.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(pointerdown)': 'onPointerDown($event)',
		'(pointermove)': 'onPointerMove($event)',
		'(pointerup)': 'onPointerUp($event)',
		'(pointercancel)': 'onPointerCancel()',
	},
})
export class Deck {
	readonly profile = input.required<Profile>();
	readonly activeButtonId = input<string | null>(null);
	readonly assetUrl = input<AssetUrlFn>(() => '');
	/** In edit mode taps open the editor instead of pressing, and an add key closes every list. */
	readonly editing = input(false);
	/** Toggle buttons that are on; drawn with their second-state look. */
	readonly buttonStates = input<Record<string, boolean>>({});
	readonly pressed = output<Button>();
	readonly editRequested = output<Button>();
	/** Emits the folder id the new button should go into, or null for the profile root. */
	readonly addRequested = output<string | null>();
	/** Emitted after a drag in edit mode; the parent turns it into a button.move command. */
	readonly moveRequested = output<MoveRequest>();
	readonly profileSwipe = output<SwipeDirection>();

	/** The key being dragged in edit mode, if any. */
	readonly draggingKeyId = signal<string | null>(null);
	readonly dropTargetId = signal<string | null>(null);

	/** Measured deck area; the grid follows it alone, never the number of keys. */
	readonly viewport = signal(DEFAULT_VIEWPORT);
	readonly grid = computed<GridSpec>(() => {
		const { width, height } = this.viewport();
		return computeGrid(width, height);
	});
	/**
	 * Both reset only when another profile is shown. The computation also runs when the same profile
	 * arrives as a new object after a config change, so it keeps the previous value for the same id.
	 */
	readonly setIndex = linkedSignal<string, number>({
		source: () => this.profile().id,
		computation: (id, previous) => (previous && previous.source === id ? previous.value : 0),
	});
	/** Stack of opened folder ids; empty means the profile root. */
	readonly folderPath = linkedSignal<string, string[]>({
		source: () => this.profile().id,
		computation: (id, previous) => (previous && previous.source === id ? previous.value : []),
	});

	/** The current list plus the virtual keys: Back inside a folder, Add in edit mode. */
	readonly visibleButtons = computed<Button[]>(() => {
		const buttons = buttonsAtPath(this.profile().buttons, this.folderPath());
		const back = this.folderPath().length > 0 ? [BACK_KEY] : [];
		const add = this.editing() ? [ADD_KEY] : [];
		return [...back, ...buttons, ...add];
	});

	readonly sets = computed(() => {
		const grid = this.grid();
		return splitIntoSets(this.visibleButtons(), grid.columns * grid.rows);
	});

	readonly trackTransform = computed(() => `translateX(${-this.setIndex() * 100}%)`);

	private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly destroyRef = inject(DestroyRef);

	// Gesture state, from pointer down to pointer up.
	private gestureStart: GestureStart | null = null;
	/** The real key under the pointer in edit mode; becomes the dragged key after a long press or a mouse move. */
	private dragCandidateId: string | null = null;
	private longPressTimer: ReturnType<typeof setTimeout> | null = null;
	private lastEdgeSwitchAt = 0;
	/** The press that follows a drop would open the editor for the dragged key, so it is swallowed. */
	private ignoreNextPress = false;

	constructor() {
		afterNextRender(() => {
			observeSize(this.element.nativeElement, this.destroyRef, (size) =>
				this.viewport.set(size),
			);
		});
		effect(() => this.keepSetIndexInRange());
	}

	/** Opens a folder of the current list, used by the editor after editing a folder key. */
	openFolder(id: string): void {
		this.folderPath.update((path) => [...path, id]);
		this.setIndex.set(0);
	}

	closeFolder(): void {
		this.folderPath.update((path) => path.slice(0, -1));
		this.setIndex.set(0);
	}

	goToSet(index: number): void {
		const clamped = Math.min(Math.max(0, index), this.sets().length - 1);
		this.setIndex.set(clamped);
	}

	onKeyPressed(button: Button): void {
		if (this.ignoreNextPress) {
			this.ignoreNextPress = false;
			return;
		}
		if (button.id === BACK_KEY_ID) {
			this.closeFolder();
			return;
		}
		if (button.id === ADD_KEY_ID) {
			this.addRequested.emit(this.folderPath().at(-1) ?? null);
			return;
		}
		if (this.editing()) {
			this.editRequested.emit(button);
			return;
		}
		if (button.folder) {
			this.openFolder(button.id);
			return;
		}
		this.pressed.emit(button);
	}

	onPointerDown(event: PointerEvent): void {
		this.gestureStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
		if (!this.editing()) {
			return;
		}
		const keyId = keyIdAt(event.target);
		this.dragCandidateId = keyId && !isVirtualKeyId(keyId) ? keyId : null;
		if (!this.dragCandidateId) {
			return;
		}
		// Touch needs a long press so a quick swipe still changes sets; the mouse can drag right away.
		if (event.pointerType !== 'mouse') {
			this.longPressTimer = setTimeout(() => this.startDrag(event), LONG_PRESS_MS);
		}
	}

	onPointerMove(event: PointerEvent): void {
		if (!this.isSameGesture(event)) {
			return;
		}
		if (this.draggingKeyId()) {
			this.updateDropTarget(event);
			return;
		}
		if (!this.dragCandidateId) {
			return;
		}
		const { dx, dy } = this.distanceFromStart(event);
		if (Math.hypot(dx, dy) <= DRAG_START_PX) {
			return;
		}
		if (event.pointerType === 'mouse') {
			this.startDrag(event);
		} else {
			// A finger that moves this early is swiping, not picking up a key.
			this.clearLongPress();
		}
	}

	onPointerUp(event: PointerEvent): void {
		this.clearLongPress();
		if (!this.isSameGesture(event)) {
			return;
		}
		const { dx, dy } = this.distanceFromStart(event);
		this.resetGesture();
		if (this.draggingKeyId()) {
			this.finishDrag();
			return;
		}
		switch (swipeOutcome(dx, dy)) {
			case 'next-set':
				this.goToSet(this.setIndex() + 1);
				break;
			case 'previous-set':
				this.goToSet(this.setIndex() - 1);
				break;
			case 'next-profile':
				this.profileSwipe.emit('next');
				break;
			case 'previous-profile':
				this.profileSwipe.emit('previous');
				break;
			case 'none':
				break;
		}
	}

	onPointerCancel(): void {
		this.clearLongPress();
		this.resetGesture();
		this.draggingKeyId.set(null);
		this.dropTargetId.set(null);
	}

	private keepSetIndexInRange(): void {
		const count = this.sets().length;
		if (this.setIndex() >= count) {
			this.setIndex.set(Math.max(0, count - 1));
		}
	}

	private isSameGesture(event: PointerEvent): boolean {
		return this.gestureStart !== null && this.gestureStart.pointerId === event.pointerId;
	}

	private distanceFromStart(event: PointerEvent): { dx: number; dy: number } {
		return {
			dx: event.clientX - (this.gestureStart?.x ?? event.clientX),
			dy: event.clientY - (this.gestureStart?.y ?? event.clientY),
		};
	}

	private resetGesture(): void {
		this.gestureStart = null;
		this.dragCandidateId = null;
	}

	private startDrag(event: PointerEvent): void {
		this.clearLongPress();
		if (!this.dragCandidateId) {
			return;
		}
		this.draggingKeyId.set(this.dragCandidateId);
		this.dropTargetId.set(null);
		try {
			this.element.nativeElement.setPointerCapture(event.pointerId);
		} catch {
			// Capture is best effort; hit testing below works without it.
		}
		navigator.vibrate?.(DRAG_START_HAPTIC_MS);
	}

	private updateDropTarget(event: PointerEvent): void {
		const now = Date.now();
		if (now - this.lastEdgeSwitchAt > EDGE_SWITCH_MS) {
			const rect = this.element.nativeElement.getBoundingClientRect();
			const step = edgeSwitchStep(event.clientX, rect, this.setIndex(), this.sets().length);
			if (step !== 0) {
				this.lastEdgeSwitchAt = now;
				this.goToSet(this.setIndex() + step);
			}
		}
		const targetId = keyIdAt(document.elementFromPoint(event.clientX, event.clientY));
		const isDroppable =
			targetId !== null && targetId !== this.draggingKeyId() && !isVirtualKeyId(targetId);
		this.dropTargetId.set(isDroppable ? targetId : null);
	}

	private finishDrag(): void {
		const draggingId = this.draggingKeyId();
		const targetId = this.dropTargetId();
		this.draggingKeyId.set(null);
		this.dropTargetId.set(null);
		this.ignoreNextPress = true;
		setTimeout(() => (this.ignoreNextPress = false), 0);
		if (!draggingId || !targetId) {
			return;
		}
		const index = indexAmongRealButtons(this.visibleButtons(), targetId);
		if (index !== null) {
			this.moveRequested.emit({ id: draggingId, index });
		}
	}

	private clearLongPress(): void {
		if (this.longPressTimer) {
			clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}
	}
}
