// Mirror of the WebSocket messages in apps/host/internal/protocol/messages.go. Keep both in sync.
import type { LogLevel } from './logs-api';
import type { Action, Command, Config } from './models';

// Deck -> host

export interface HelloMessage {
	type: 'hello';
	clientId: string;
	name: string;
	version: number;
}

export interface PressMessage {
	type: 'press';
	buttonId: string;
	sentAt: number;
}

/** Runs actions that are not stored as a button; the ack uses runId as buttonId. */
export interface RunMessage {
	type: 'run';
	runId: string;
	actions: Action[];
	sentAt: number;
}

export interface PingMessage {
	type: 'ping';
	sentAt: number;
}

export interface CommandMessage {
	type: 'command';
	commandId: string;
	baseRevision: number;
	command: Command;
}

/** Asks for the whole config again; the host currently ignores sinceRevision and sends it all. */
export interface SyncMessage {
	type: 'sync';
	sinceRevision: number;
}

/** A line the deck adds to the host log; never carries the token or typed text. */
export interface LogMessage {
	type: 'log';
	level: LogLevel;
	message: string;
	fields?: string;
}

export type ClientMessage =
	| HelloMessage
	| PressMessage
	| RunMessage
	| PingMessage
	| CommandMessage
	| SyncMessage
	| LogMessage;

// Host -> deck

export interface WelcomeMessage {
	type: 'welcome';
	hostName: string;
	platform: string;
	version: number;
	/** Fingerprint of the web deck build the host serves. */
	deckBuild?: string;
}

export interface ConfigMessage {
	type: 'config';
	config: Config;
}

export interface ChangedMessage {
	type: 'changed';
	revision: number;
	commandId?: string;
	command: Command;
}

export interface CommandResultMessage {
	type: 'commandResult';
	commandId: string;
	ok: boolean;
	revision: number;
	error?: string;
}

export interface AckMessage {
	type: 'ack';
	buttonId: string;
	ok: boolean;
	error?: string;
	sentAt?: number;
	executionMs: number;
}

/** Which application has the focus on the host. */
export interface ActiveAppMessage {
	type: 'activeApp';
	name: string;
	id: string;
}

/** Ids of the toggle buttons that are currently on. */
export interface ButtonStateMessage {
	type: 'buttonState';
	states: Record<string, boolean>;
}

export interface PongMessage {
	type: 'pong';
	sentAt: number;
}

export interface ErrorMessage {
	type: 'error';
	message: string;
}

export type HostMessage =
	| WelcomeMessage
	| ConfigMessage
	| ChangedMessage
	| CommandResultMessage
	| AckMessage
	| PongMessage
	| ActiveAppMessage
	| ButtonStateMessage
	| ErrorMessage;

export function isHostMessage(value: unknown): value is HostMessage {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { type?: unknown }).type === 'string'
	);
}
