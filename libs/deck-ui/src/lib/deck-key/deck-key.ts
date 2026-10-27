import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from '@sd/protocol';
import { contrastColor } from '../color/contrast-color';
import { isVirtualKeyId } from '../deck/virtual-keys';

/** Hold timing for repeat keys: a short delay so a tap stays a single press, then a steady pace. */
export const REPEAT_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 120;

/** Produces the URL for an asset hash; provided by the app because it knows the host and token. */
export type AssetUrlFn = (hash: string) => string;

const PRIMARY_MOUSE_BUTTON = 0;

@Component({
	selector: 'sd-deck-key',
	templateUrl: './deck-key.html',
	styleUrl: './deck-key.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[style.--key-color]': 'color()',
		'[style.--key-foreground]': 'foreground()',
		'[class.key--on]': 'on()',
		'[class.key--active]': 'active()',
		'[class.key--folder]': '!!button().folder',
		'[class.key--editing]': 'editing() && !isVirtualKey()',
		'[class.key--special]': 'isVirtualKey()',
		'[class.key--dragging]': 'dragging()',
		'[class.key--drop-target]': 'dropTarget()',
		'[attr.data-key-id]': 'button().id',
		'(pointerdown)': 'onPointerDown($event)',
		'(pointerup)': 'stopRepeat()',
		'(pointercancel)': 'stopRepeat()',
		'(lostpointercapture)': 'stopRepeat()',
		'(click)': 'onClick()',
	},
})
export class DeckKey {
	readonly button = input.required<Button>();
	readonly active = input(false);
	readonly assetUrl = input<AssetUrlFn>(() => '');
	readonly editing = input(false);
	readonly dragging = input(false);
	readonly dropTarget = input(false);
	/** True while a toggle button is in its second state; its overrides are shown. */
	readonly on = input(false);
	readonly pressed = output<Button>();

	/** The look to render: the toggle overrides while on, the button itself otherwise. */
	readonly look = computed(() => {
		const button = this.button();
		const toggle = this.on() ? button.toggle : null;
		return {
			label: toggle?.label || button.label,
			color: toggle?.color || button.color,
			icon: toggle?.icon ?? button.icon,
		};
	});
	readonly color = computed(() => this.look().color);
	readonly foreground = computed(() => contrastColor(this.look().color));

	/** Navigation keys (back, add) are drawn muted and never get the edit badge. */
	readonly isVirtualKey = computed(() => isVirtualKeyId(this.button().id));

	/** Shown when the key has no icon: the first letter of the label. */
	readonly fallbackInitial = computed(
		() => (this.look().label ?? '?').trim().charAt(0).toUpperCase() || '?',
	);
	readonly assetHash = computed(() => {
		const icon = this.look().icon;
		return icon?.source === 'asset' ? icon.hash : '';
	});
	readonly emojiValue = computed(() => {
		const icon = this.look().icon;
		return icon?.source === 'emoji' ? icon.value : '';
	});
	readonly phosphorClass = computed(() => {
		const icon = this.look().icon;
		if (icon?.source !== 'phosphor') {
			return '';
		}
		const weightClass = icon.weight && icon.weight !== 'regular' ? `ph-${icon.weight}` : 'ph';
		return `${weightClass} ph-${icon.name}`;
	});

	private repeatDelayTimer: ReturnType<typeof setTimeout> | null = null;
	private repeatIntervalTimer: ReturnType<typeof setInterval> | null = null;

	/** Pressing fires on pointer down for speed; in edit mode the click waits for a possible drag. */
	onPointerDown(event: PointerEvent): void {
		if (isSecondaryMouseButton(event) || this.editing()) {
			return;
		}
		this.pressed.emit(this.button());
		if (this.button().repeat && !this.button().toggle) {
			this.startRepeat(event);
		}
	}

	/** In edit mode a tap opens the editor; it waits for the click so a drag is not mistaken for it. */
	onClick(): void {
		if (this.editing()) {
			this.pressed.emit(this.button());
		}
	}

	/** After a short hold the key fires again at a steady pace until the pointer lets go. */
	private startRepeat(event: PointerEvent): void {
		this.stopRepeat();
		try {
			(event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
		} catch {
			// Capture is best effort; the pointer events still reach the key while over it.
		}
		this.repeatDelayTimer = setTimeout(() => {
			this.repeatIntervalTimer = setInterval(
				() => this.pressed.emit(this.button()),
				REPEAT_INTERVAL_MS,
			);
		}, REPEAT_DELAY_MS);
	}

	stopRepeat(): void {
		if (this.repeatDelayTimer) {
			clearTimeout(this.repeatDelayTimer);
			this.repeatDelayTimer = null;
		}
		if (this.repeatIntervalTimer) {
			clearInterval(this.repeatIntervalTimer);
			this.repeatIntervalTimer = null;
		}
	}
}

function isSecondaryMouseButton(event: PointerEvent): boolean {
	return event.pointerType === 'mouse' && event.button !== PRIMARY_MOUSE_BUTTON;
}
