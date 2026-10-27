import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	OnInit,
	output,
	signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeckKey } from '@sd/deck-ui';
import { InstalledApp } from '@sd/host-client';
import { Action, Button, IconRef, Profile, ToggleState } from '@sd/protocol';
import { ActionList } from '../action-list/action-list';
import { IconPicker } from '../icon-picker/icon-picker';

/** Everything of a button except its id and folder contents. */
export interface ButtonDraft {
	label: string;
	showLabel: boolean;
	color: string;
	icon: IconRef | null;
	actions: Action[];
	/** True when a new button should be created as an empty folder. */
	folder: boolean;
	/** Second state for toggle buttons; null removes it. */
	toggle: ToggleState | null;
	/** Keep pressing while held. */
	repeat: boolean;
}

export const COLOR_SWATCHES = [
	'#374151',
	'#1f2937',
	'#dc2626',
	'#ea580c',
	'#d97706',
	'#65a30d',
	'#16a34a',
	'#0d9488',
	'#0284c7',
	'#2563eb',
	'#4f46e5',
	'#7c3aed',
	'#c026d3',
	'#db2777',
	'#78716c',
	'#0f172a',
];

type IconTarget = 'button' | 'toggle';

/** Edits one button as a local draft; the shell turns the result into commands. */
@Component({
	selector: 'sd-button-editor',
	imports: [FormsModule, NgTemplateOutlet, DeckKey, IconPicker, ActionList],
	templateUrl: './button-editor.html',
	styleUrl: './button-editor.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonEditor implements OnInit {
	/** Null creates a new button. */
	readonly button = input<Button | null>(null);
	readonly profiles = input<Profile[]>([]);
	readonly platform = input('');
	readonly canMoveBack = input(false);
	readonly canMoveForward = input(false);
	readonly assetUrl = input<(hash: string) => string>(() => '');
	/** Colors of the page palette, shown before the generic swatches. */
	readonly paletteColors = input<string[]>([]);
	/** Color a new button starts with; comes from the page palette when there is one. */
	readonly defaultColor = input<string | null>(null);

	readonly saved = output<ButtonDraft>();
	readonly deleted = output<void>();
	readonly moved = output<'back' | 'forward'>();
	readonly openFolder = output<void>();
	readonly cancelled = output<void>();
	/** Runs the draft's actions on the host without saving anything. */
	readonly tried = output<Action[]>();

	readonly label = signal('');
	readonly showLabel = signal(true);
	readonly color = signal(COLOR_SWATCHES[0]);
	readonly icon = signal<IconRef | null>(null);
	readonly actions = signal<Action[]>([]);
	/** Only new buttons can become folders; existing folders keep their contents. */
	readonly asFolder = signal(false);
	readonly toggleEnabled = signal(false);
	readonly repeat = signal(false);
	readonly toggleLabel = signal('');
	readonly toggleColor = signal('');
	readonly toggleIcon = signal<IconRef | null>(null);
	readonly toggleActions = signal<Action[]>([]);
	readonly pickingIconFor = signal<IconTarget | null>(null);
	readonly confirmingDelete = signal(false);

	readonly swatches = computed(() => [
		...this.paletteColors(),
		...COLOR_SWATCHES.filter((color) => !this.paletteColors().includes(color)),
	]);
	readonly isNew = computed(() => this.button() === null);
	readonly isFolder = computed(
		() => !!this.button()?.folder || (this.isNew() && this.asFolder()),
	);
	readonly toggleDraft = computed<ToggleState | null>(() =>
		this.toggleEnabled() && !this.isFolder()
			? {
					label: this.toggleLabel().trim() || undefined,
					color: this.toggleColor() || undefined,
					icon: this.toggleIcon() ?? undefined,
					actions: this.toggleActions(),
				}
			: null,
	);
	readonly preview = computed<Button>(() => ({
		id: 'preview',
		label: this.label(),
		showLabel: this.showLabel(),
		color: this.color(),
		icon: this.icon() ?? undefined,
		actions: this.actions(),
		toggle: this.toggleDraft(),
	}));
	/** The actions of whichever state the icon is being picked for; they seed the picker's tabs. */
	readonly pickerActions = computed(() =>
		this.pickingIconFor() === 'toggle' ? this.toggleActions() : this.actions(),
	);
	readonly pickerIcon = computed(() =>
		this.pickingIconFor() === 'toggle' ? this.toggleIcon() : this.icon(),
	);
	readonly pickerColor = computed(() =>
		this.pickingIconFor() === 'toggle' && this.toggleColor()
			? this.toggleColor()
			: this.color(),
	);

	/** Inputs are only set after construction, so the draft is loaded here. */
	ngOnInit(): void {
		this.loadDraft();
	}

	loadDraft(): void {
		const button = this.button();
		this.label.set(button?.label ?? '');
		this.showLabel.set(button?.showLabel ?? true);
		this.color.set(button?.color ?? this.defaultColor() ?? COLOR_SWATCHES[0]);
		this.icon.set(button?.icon ?? null);
		this.actions.set(structuredClone(button?.actions ?? []));
		this.asFolder.set(false);
		this.repeat.set(button?.repeat ?? false);
		const toggle = button?.toggle ?? null;
		this.toggleEnabled.set(!!toggle);
		this.toggleLabel.set(toggle?.label ?? '');
		this.toggleColor.set(toggle?.color ?? '');
		this.toggleIcon.set(toggle?.icon ?? null);
		this.toggleActions.set(structuredClone(toggle?.actions ?? []));
	}

	// Arrow functions, because the swatch template calls them without a receiver.
	readonly setColor = (color: string): void => this.color.set(color);
	readonly setToggleColor = (color: string): void => this.toggleColor.set(color);

	/** Suggest the app name as label when the button has none yet. */
	onAppPicked(app: InstalledApp): void {
		if (!this.label().trim()) {
			this.label.set(app.name);
		}
	}

	onIconPicked(icon: IconRef | null): void {
		if (this.pickingIconFor() === 'toggle') {
			this.toggleIcon.set(icon);
		} else {
			this.icon.set(icon);
		}
		this.pickingIconFor.set(null);
	}

	save(): void {
		this.saved.emit({
			label: this.label().trim(),
			showLabel: this.showLabel(),
			color: this.color(),
			icon: this.icon(),
			actions: this.isFolder() ? [] : this.actions(),
			folder: this.isFolder(),
			toggle: this.toggleDraft(),
			repeat: this.repeat() && !this.toggleEnabled(),
		});
	}

	tryActions(): void {
		if (this.actions().length > 0) {
			this.tried.emit(this.actions());
		}
	}

	requestDelete(): void {
		if (this.confirmingDelete()) {
			this.deleted.emit();
			return;
		}
		this.confirmingDelete.set(true);
	}
}
