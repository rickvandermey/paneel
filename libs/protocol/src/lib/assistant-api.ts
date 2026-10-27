// Mirror of apps/host/internal/assistant/types.go, as the /api/assistant endpoints use it.
import type { ActionKind, Modifier } from './models';

/** One turn of the page builder conversation; assistant content is the JSON reply as received. */
export interface AssistantMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface AssistantCatalogEntry {
	label: string;
	group: string;
	summary?: string;
}

export interface AssistantPageSummary {
	id: string;
	name: string;
	buttons: string[];
}

/** What the deck sends for one turn; mirrors internal/assistant.Request. */
export interface AssistantRequest {
	messages: AssistantMessage[];
	catalog: AssistantCatalogEntry[];
	pages: AssistantPageSummary[];
	currentPage?: string;
	apps?: string[];
	palettes: string[];
	platform: string;
}

/** The action kinds the assistant may propose; delays, page switches and app controls are not among them. */
export type AssistantActionKind = Extract<
	ActionKind,
	'hotkey' | 'text' | 'launch' | 'url' | 'shell' | 'terminal' | 'media'
>;

export interface AssistantPlanAction {
	kind: AssistantActionKind;
	key?: string | null;
	modifiers?: Modifier[] | null;
	target?: string | null;
	url?: string | null;
	command?: string | null;
	prompt?: string | null;
	text?: string | null;
	control?: string | null;
}

export interface AssistantPlanButton {
	/** A catalog label; when set, the other fields are empty. */
	preset?: string | null;
	label?: string | null;
	icon?: string | null;
	actions?: AssistantPlanAction[] | null;
}

export interface AssistantPlan {
	target: 'new' | 'current';
	name: string;
	icon?: string | null;
	palette?: string | null;
	apps: string[];
	buttons: AssistantPlanButton[];
}

/** The only shape the model may answer in; mirrors internal/assistant.Reply. */
export interface AssistantReply {
	kind: 'question' | 'plan' | 'decline';
	message: string;
	plan: AssistantPlan | null;
}

/** What the computer is set up with; never carries a key. */
export interface AssistantStatus {
	provider: string;
	model: string;
	baseUrl?: string;
	configured: boolean;
	shareApps: boolean;
}
