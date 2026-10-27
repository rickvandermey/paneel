import type { InstalledApp } from '@sd/host-client';
import type { AssistantPlan, Button, ButtonPatch, Profile } from '@sd/protocol';
import type { ButtonDraft } from '../button-editor/button-editor';
import type { PagePreset } from '../page-presets/page-presets';
import { paletteColor } from '../palette-panel/palettes';
import { findPreset, type PresetButton } from '../presets/presets';
import { joinAppMatch } from '../shared/app-match';
import { phosphor } from '../shared/icons';

/**
 * Pure builders that turn what a panel produced (a draft, a preset, a plan) into the pages and
 * buttons the host stores. The shell only has to send them.
 */

export const START_PAGE_NAME = 'Start';

/** The sample page the host starts with: a few keys that show the kinds of actions. */
const SAMPLE_PAGE_LABELS = ['Copy', 'Paste', 'Calculator', 'GitHub', 'Play / Pause', 'Claude'];

/** A new page from the blank-page form or when a button is added without any page. */
export function blankPage(id: string, name: string): Profile {
	return { id, name, buttons: [] };
}

export function samplePage(id: string, platform: string, newId: () => string): Profile {
	const buttons = SAMPLE_PAGE_LABELS.map((label) => findPreset(platform, label))
		.filter((button): button is PresetButton => button !== null)
		.map((button) => ({ id: newId(), ...button }));
	return { id, name: START_PAGE_NAME, icon: phosphor('house'), buttons };
}

/** A page from a preset; installed apps from its list become its appMatch. */
export function pageFromPreset(
	id: string,
	preset: PagePreset,
	installedFromPreset: string[],
	platform: string,
	installed: InstalledApp[],
	newId: () => string,
): Profile {
	const buttons = preset.buttons(platform, installed).map((button, index) => ({
		id: newId(),
		...button,
		color: paletteColor(preset.palette, index) ?? button.color,
	}));
	return {
		id,
		name: preset.name,
		icon: preset.icon,
		palette: preset.palette,
		appMatch: installedFromPreset.length > 0 ? joinAppMatch(installedFromPreset) : undefined,
		buttons,
	};
}

/** A page from an accepted assistant plan; the buttons already carry ids. */
export function pageFromPlan(id: string, plan: AssistantPlan, buttons: Button[]): Profile {
	return {
		id,
		name: plan.name,
		icon: plan.icon ? phosphor(plan.icon) : undefined,
		palette: plan.palette || undefined,
		appMatch: plan.apps.length > 0 ? joinAppMatch(plan.apps) : undefined,
		buttons,
	};
}

/** A new button from the editor's draft. */
export function buttonFromDraft(id: string, draft: ButtonDraft): Button {
	return {
		id,
		label: draft.label,
		showLabel: draft.showLabel,
		color: draft.color,
		icon: draft.icon ?? undefined,
		actions: draft.actions,
		...(draft.toggle ? { toggle: draft.toggle } : {}),
		...(draft.repeat ? { repeat: true } : {}),
		...(draft.folder ? { folder: [] } : {}),
	};
}

/** The fields an edited button changes; a null icon or toggle removes it. */
export function buttonPatchFromDraft(draft: ButtonDraft): ButtonPatch {
	return {
		label: draft.label,
		showLabel: draft.showLabel,
		color: draft.color,
		icon: draft.icon,
		actions: draft.actions,
		toggle: draft.toggle,
		repeat: draft.repeat,
	};
}

/** A preset placed on a page: it gets an id and the page's next palette color. */
export function buttonFromPreset(id: string, preset: PresetButton, color: string | null): Button {
	return { id, ...preset, color: color ?? preset.color };
}
