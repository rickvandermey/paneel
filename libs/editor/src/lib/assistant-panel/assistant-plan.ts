import type { InstalledApp } from '@sd/host-client';
import type {
	Action,
	AssistantCatalogEntry,
	AssistantMessage,
	AssistantPlan,
	AssistantPlanButton,
	AssistantRequest,
	Profile,
} from '@sd/protocol';
import { applyPaletteColors, PALETTES } from '../palette-panel/palettes';
import { launch, PresetButton } from '../presets/helpers';
import { findPreset, presetGroups } from '../presets/presets';
import { phosphor } from '../shared/icons';
import type { Turn } from './assistant-session';

/** Custom keys the model invents get one color; the plan's palette may override it. */
const CUSTOM_KEY_COLOR = '#2563eb';

/** What one turn sends to the host: the conversation plus everything the model may pick from. */
export function buildAssistantRequest(options: {
	turns: Turn[];
	platform: string;
	profiles: Profile[];
	currentProfile: Profile | null;
	installedApps: InstalledApp[];
}): AssistantRequest {
	return {
		messages: options.turns.map(turnToMessage),
		catalog: buildAssistantCatalog(options.platform, options.installedApps),
		pages: options.profiles.map((profile) => ({
			id: profile.id,
			name: profile.name,
			buttons: profile.buttons.map((button) => button.label ?? ''),
		})),
		currentPage: options.currentProfile?.name,
		apps: options.installedApps.map((app) => app.name),
		palettes: PALETTES.map((palette) => palette.id),
		platform: options.platform,
	};
}

/** An assistant turn is sent back as the JSON it answered with, so the model sees its own plan. */
function turnToMessage(turn: Turn): AssistantMessage {
	return {
		role: turn.role,
		content: turn.role === 'assistant' && turn.reply ? JSON.stringify(turn.reply) : turn.text,
	};
}

/**
 * Presets plus the installed apps as launchers, the same set the catalog shows. Labels are
 * unique: the first entry wins, which matches how findPreset resolves a label.
 */
export function buildAssistantCatalog(
	platform: string,
	installedApps: InstalledApp[],
): AssistantCatalogEntry[] {
	const entries: AssistantCatalogEntry[] = [];
	const seen = new Set<string>();
	const add = (entry: AssistantCatalogEntry) => {
		const key = entry.label.toLowerCase();
		if (entry.label && !seen.has(key)) {
			seen.add(key);
			entries.push(entry);
		}
	};
	for (const group of presetGroups(platform)) {
		for (const button of group.buttons) {
			add({ label: button.label ?? '', group: group.name, summary: summarizeButton(button) });
		}
	}
	for (const app of installedApps) {
		add({ label: app.name, group: 'Your apps', summary: 'open app' });
	}
	return entries;
}

/** One line that tells the model what a preset does, without the whole action. */
export function summarizeButton(button: PresetButton): string {
	const action = button.actions[0];
	if (!action) {
		return '';
	}
	switch (action.kind) {
		case 'hotkey':
			return [...(action.modifiers ?? []), action.key].join('+');
		case 'launch':
			return `open ${action.target}`;
		case 'url':
			return action.url ? new URL(action.url).host : 'url';
		case 'terminal':
		case 'shell':
			return action.command ?? action.kind;
		case 'media':
			return `media ${action.control}`;
		default:
			return action.kind;
	}
}

/** Catalog presets by label, custom keys from their actions; colors follow the plan's palette. */
export function resolvePlanButtons(
	plan: AssistantPlan,
	platform: string,
	installedApps: InstalledApp[],
): PresetButton[] {
	const buttons: PresetButton[] = [];
	for (const entry of plan.buttons) {
		const button = resolvePlanButton(entry, platform, installedApps);
		if (button) {
			buttons.push(button);
		}
	}
	return applyPaletteColors(buttons, plan.palette ?? '');
}

function resolvePlanButton(
	entry: AssistantPlanButton,
	platform: string,
	installedApps: InstalledApp[],
): PresetButton | null {
	if (entry.preset) {
		const preset = findPreset(platform, entry.preset);
		if (preset) {
			return preset;
		}
		const app = installedApps.find((candidate) => candidate.name === entry.preset);
		return app ? launch(app.name, app.target) : null;
	}
	const actions = (entry.actions ?? []).map(planActionToAction);
	if (!entry.label || actions.length === 0) {
		return null;
	}
	return {
		label: entry.label,
		showLabel: true,
		color: CUSTOM_KEY_COLOR,
		icon: entry.icon ? phosphor(entry.icon) : undefined,
		actions,
	};
}

/** The model answers with nulls for fields that do not apply; the stored action leaves them out. */
function planActionToAction(action: NonNullable<AssistantPlanButton['actions']>[number]): Action {
	return {
		kind: action.kind,
		key: action.key || undefined,
		modifiers: action.modifiers || undefined,
		target: action.target || undefined,
		url: action.url || undefined,
		command: action.command || undefined,
		prompt: action.prompt || undefined,
		text: action.text || undefined,
		control: (action.control as Action['control']) || undefined,
	};
}
