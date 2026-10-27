import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InstalledApp } from '@sd/host-client';
import { Action, ActionKind, Modifier, Profile } from '@sd/protocol';
import { AppPicker } from '../app-picker/app-picker';
import {
	ACTION_KINDS,
	actionKindLabel,
	APP_CONTROLS,
	APP_VALUES,
	appIdsFor,
	defaultActionFor,
	isTwoStateControl,
	MEDIA_CONTROLS,
	modifierLabels,
	MODIFIERS,
	TERMINAL_WINDOWS,
} from './action-options';

/** Editable, ordered list of actions; used for a button and for its toggle state. */
@Component({
	selector: 'sd-action-list',
	imports: [FormsModule, NgTemplateOutlet, AppPicker],
	templateUrl: './action-list.html',
	styleUrl: './action-list.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionList {
	readonly actions = input.required<Action[]>();
	readonly profiles = input<Profile[]>([]);
	readonly platform = input('');
	readonly actionsChange = output<Action[]>();
	/** Emits the app name when an app was picked for a launch action, so a label can be suggested. */
	readonly appPicked = output<InstalledApp>();

	readonly actionKinds = ACTION_KINDS;
	readonly mediaControls = MEDIA_CONTROLS;
	readonly appControls = APP_CONTROLS;
	readonly appValues = APP_VALUES;
	readonly terminalWindows = TERMINAL_WINDOWS;
	readonly modifiers = MODIFIERS;
	readonly appIds = computed(() => appIdsFor(this.platform()));
	readonly modifierLabel = computed(() => modifierLabels(this.platform()));
	readonly kindLabel = actionKindLabel;
	readonly isTwoState = isTwoStateControl;

	/** Index of the action an app is being picked for, while the app picker is open. */
	readonly pickingAppForIndex = signal<number | null>(null);

	addAction(kind: ActionKind): void {
		this.actionsChange.emit([...this.actions(), defaultActionFor(kind, this.profiles())]);
	}

	updateAction(index: number, patch: Partial<Action>): void {
		this.actionsChange.emit(
			this.actions().map((action, i) => (i === index ? { ...action, ...patch } : action)),
		);
	}

	removeAction(index: number): void {
		this.actionsChange.emit(this.actions().filter((_, i) => i !== index));
	}

	/** Swaps the action with its neighbour; delta is -1 for up and 1 for down. */
	moveAction(index: number, delta: number): void {
		const list = [...this.actions()];
		const target = index + delta;
		if (target < 0 || target >= list.length) {
			return;
		}
		[list[index], list[target]] = [list[target], list[index]];
		this.actionsChange.emit(list);
	}

	toggleModifier(index: number, modifier: Modifier): void {
		const current = this.actions()[index]?.modifiers ?? [];
		const next = current.includes(modifier)
			? current.filter((entry) => entry !== modifier)
			: [...current, modifier];
		this.updateAction(index, { modifiers: next });
	}

	hasModifier(action: Action, modifier: Modifier): boolean {
		return action.modifiers?.includes(modifier) ?? false;
	}

	onAppPicked(app: InstalledApp): void {
		const index = this.pickingAppForIndex();
		if (index !== null) {
			this.updateAction(index, { target: app.target });
			// Only a launch button is named after its app; a hotkey keeps describing the key.
			if (this.actions()[index]?.kind === 'launch') {
				this.appPicked.emit(app);
			}
		}
		this.pickingAppForIndex.set(null);
	}
}
