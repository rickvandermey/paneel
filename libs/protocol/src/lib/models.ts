// Mirror of the models in apps/host/internal/protocol/messages.go. Keep both in sync.
export const PROTOCOL_VERSION = 2;

export type ActionKind =
	| 'hotkey'
	| 'text'
	| 'launch'
	| 'url'
	| 'shell'
	| 'terminal'
	| 'delay'
	| 'media'
	| 'switchProfile'
	| 'appControl';

export type Modifier = 'cmd' | 'ctrl' | 'alt' | 'shift';

export type MediaControl =
	| 'playPause'
	| 'next'
	| 'previous'
	| 'volumeUp'
	| 'volumeDown'
	| 'mute'
	| 'brightnessUp'
	| 'brightnessDown';

/** Apps an appControl action can drive. */
export type AppId = 'spotify' | 'music';

/** App controls; playPause, next and previous share their names with the media controls. */
export type AppControl = 'shuffle' | 'repeat' | 'playPause' | 'next' | 'previous';

/** For shuffle and repeat: switch on, off, or flip the current state. */
export type AppControlValue = 'on' | 'off' | 'toggle';

/**
 * Where a terminal action runs. 'reuse' (the default) types into the integrated terminal of the
 * editor in front, or else into the open terminal window; 'new' always opens a window. 'editor'
 * is an older spelling of 'reuse' that saved configs may still carry.
 */
export type TerminalWindow = 'reuse' | 'new' | 'editor';

export interface Action {
	kind: ActionKind;
	key?: string;
	modifiers?: Modifier[];
	text?: string;
	/** App to open (launch), or to bring to the front before the key is sent (hotkey). */
	target?: string;
	url?: string;
	command?: string;
	workDir?: string;
	/** Terminal actions: text for the program the command starts, e.g. a Claude prompt. */
	prompt?: string;
	/** Terminal actions: where the command runs; absent means the open terminal is reused. */
	window?: TerminalWindow;
	millis?: number;
	/** A media key for media actions, a command for appControl actions. */
	control?: MediaControl | AppControl;
	profileId?: string;
	/** appControl: which app to drive and, for shuffle and repeat, the wanted state. */
	app?: AppId;
	value?: AppControlValue;
	/** Shell actions notify the desktop when they finish unless silent. */
	silent?: boolean;
}

export type IconRef =
	| { source: 'asset'; hash: string }
	| {
			source: 'phosphor';
			name: string;
			weight?: 'regular' | 'bold' | 'fill' | 'duotone';
	  }
	| { source: 'simple-icons'; slug: string }
	| { source: 'emoji'; value: string };

export interface Button {
	id: string;
	label?: string;
	showLabel: boolean;
	color: string;
	icon?: IconRef;
	actions: Action[];
	/** Present (possibly empty) for folders; the host serializes non-folders as null. */
	folder?: Button[] | null;
	/** Second state: pressed again runs these actions; look overrides apply while on. */
	toggle?: ToggleState | null;
	/** Keep pressing while held, for volume, brightness and scrolling. */
	repeat?: boolean;
}

export interface ToggleState {
	label?: string;
	color?: string;
	icon?: IconRef;
	actions: Action[];
}

export interface Profile {
	id: string;
	name: string;
	icon?: IconRef;
	appMatch?: string;
	/** Id of a per-page color palette (see libs/editor palettes); empty means none. */
	palette?: string;
	buttons: Button[];
}

export interface Settings {
	terminal: string;
	/** Visual style shared by every client; empty means the default. */
	theme: string;
	customThemes?: CustomTheme[];
	customPalettes?: CustomPalette[];
	/** "explicit": only pages with an appMatch follow the focused app; otherwise buttons count too. */
	smartPages?: 'buttons' | 'explicit';
	/** Records debug lines too (active app changes, terminal decisions, API calls). */
	verboseLogging?: boolean;
	/** The page builder's model; the API keys live on the computer, outside the config. */
	assistant?: AssistantSettings;
}

export type AssistantProvider = 'anthropic' | 'openai';

export interface AssistantSettings {
	/** 'anthropic' (default) or 'openai', which also covers Ollama, LM Studio and OpenRouter. */
	provider?: AssistantProvider;
	model?: string;
	/** Replaces the OpenAI endpoint for compatible servers. */
	baseUrl?: string;
	/** Lets the names of installed apps go to the provider, so pages can follow them. */
	shareApps?: boolean;
}

/** A user-made theme; the editor derives every other token from these values. */
export interface CustomTheme {
	id: string;
	name: string;
	/** Built-in theme whose remaining tokens (fonts, danger colors) are kept. */
	base: string;
	bg: string;
	surface: string;
	text: string;
	accent: string;
	/** Optional glow color behind everything; empty means a flat background. */
	light?: string;
	/** Key corner radius in percent. */
	keyRadius: number;
	/** Key opacity in percent; below 100 the keys become glass. */
	keyMix: number;
	/** Panel blur in pixels. */
	blur: number;
}

export interface CustomPalette {
	id: string;
	name: string;
	colors: string[];
	tint?: string;
}

export interface Config {
	schemaVersion: number;
	revision: number;
	settings: Settings;
	profiles: Profile[];
}

/** A null icon removes it (JSON merge patch semantics). */
export type ButtonPatch = Partial<Omit<Button, 'id' | 'folder' | 'icon' | 'toggle'>> & {
	icon?: IconRef | null;
	toggle?: ToggleState | null;
};
export type ProfilePatch = Partial<Omit<Profile, 'id' | 'buttons' | 'icon'>> & {
	icon?: IconRef | null;
};

export type Command =
	| {
			type: 'profile.create';
			profile: Omit<Profile, 'buttons'> & { buttons?: Button[] };
			index?: number;
	  }
	| { type: 'profile.update'; id: string; patch: ProfilePatch }
	| { type: 'profile.delete'; id: string }
	| { type: 'profile.move'; id: string; index: number }
	| {
			type: 'button.create';
			profileId?: string;
			parentId?: string;
			index?: number;
			button: Button;
	  }
	| { type: 'button.update'; id: string; patch: ButtonPatch }
	| { type: 'button.delete'; id: string }
	| {
			type: 'button.move';
			id: string;
			profileId?: string;
			parentId?: string;
			index: number;
	  }
	| { type: 'settings.update'; patch: Partial<Settings> };
