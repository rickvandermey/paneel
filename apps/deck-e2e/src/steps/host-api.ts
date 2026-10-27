import { expect } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Button, Command, Config, Profile } from '@sd/protocol';
import { ACTIONS_FILE, CONFIG_DIR } from '../../playwright.config';

interface HostMessage {
	type: string;
	[key: string]: unknown;
}

type MessageMatcher = (message: HostMessage) => boolean;

/** Resolves with the first host message the matcher accepts, or rejects after the timeout. */
type WaitForMessage = (match: MessageMatcher, timeoutMs?: number) => Promise<HostMessage>;

const DEFAULT_MESSAGE_TIMEOUT_MS = 5000;

/** One action the dry-run host recorded instead of executing. */
export interface RecordedAction {
	kind: string;
	key?: string;
	modifiers?: string[];
	target?: string;
	text?: string;
	command?: string;
	app?: string;
	control?: string;
	value?: string;
	script?: string;
}

/** What a button created by a step looks like unless the step says otherwise. */
const BUTTON_DEFAULTS: Omit<Button, 'id'> = {
	showLabel: true,
	color: '#334155',
	actions: [],
};

/** Talks to the headless host the suite started: resets it and sends commands like a deck would. */
export class HostApi {
	constructor(private readonly baseURL: string) {}

	/** Read from disk on every call because some scenarios rotate the token. */
	readPairingToken(): string {
		const config = JSON.parse(readFileSync(join(CONFIG_DIR, 'config.json'), 'utf8'));
		return config.token as string;
	}

	pairingUrl(token = this.readPairingToken()): string {
		return `${this.baseURL}/?token=${token}`;
	}

	async downloadBackup(): Promise<Buffer> {
		const response = await fetch(`${this.baseURL}/api/backup`, {
			headers: this.authorizationHeader(),
		});
		expect(response.ok).toBe(true);
		return Buffer.from(await response.arrayBuffer());
	}

	/** Back to the default pages and settings; the host keeps its token and port. */
	async reset(): Promise<void> {
		const response = await fetch(`${this.baseURL}/api/reset`, {
			method: 'POST',
			headers: this.authorizationHeader(),
		});
		expect(response.ok).toBe(true);
		writeFileSync(ACTIONS_FILE, '');
	}

	/** Everything pressed since the last reset, in order. */
	recordedActions(): RecordedAction[] {
		if (!existsSync(ACTIONS_FILE)) {
			return [];
		}
		return readFileSync(ACTIONS_FILE, 'utf8')
			.split('\n')
			.filter((line) => line.trim() !== '')
			.map((line) => JSON.parse(line) as RecordedAction);
	}

	/** Sends one command over a fresh WebSocket and fails the step when the host rejects it. */
	async sendCommand(command: Command): Promise<void> {
		const result = await this.withHostSocket(async (socket, waitForMessage) => {
			const commandId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			socket.send(JSON.stringify({ type: 'command', commandId, baseRevision: 0, command }));
			return waitForMessage(
				(message) => message.type === 'commandResult' && message['commandId'] === commandId,
			);
		});
		expect(result['ok'], String(result['error'] ?? '')).toBe(true);
	}

	/** The host sends its whole config right after the handshake. */
	async readConfig(): Promise<Config> {
		const message = await this.withHostSocket((_, waitForMessage) =>
			waitForMessage((entry) => entry.type === 'config'),
		);
		return message['config'] as Config;
	}

	async profileNamed(name: string): Promise<Profile> {
		const config = await this.readConfig();
		const profile = config.profiles.find((entry) => entry.name === name);
		expect(profile, `page "${name}"`).toBeDefined();
		return profile as Profile;
	}

	/** Searches the top level of every page; buttons inside folders are not included. */
	async buttonLabelled(label: string): Promise<Button> {
		const config = await this.readConfig();
		const button = config.profiles
			.flatMap((profile) => profile.buttons)
			.find((entry) => entry.label === label);
		expect(button, `button "${label}"`).toBeDefined();
		return button as Button;
	}

	/** Creates a button on the named page, filling in the defaults a step does not care about. */
	async addButtonToPage(
		pageName: string,
		button: Partial<Button> & { id: string },
	): Promise<void> {
		const profile = await this.profileNamed(pageName);
		await this.sendCommand({
			type: 'button.create',
			profileId: profile.id,
			button: { ...BUTTON_DEFAULTS, ...button },
		});
	}

	/** Creates a button inside a folder button, filling in the same defaults. */
	async addButtonToFolder(
		folderId: string,
		button: Partial<Button> & { id: string },
	): Promise<void> {
		await this.sendCommand({
			type: 'button.create',
			parentId: folderId,
			button: { ...BUTTON_DEFAULTS, ...button },
		});
	}

	/** The app the host reports as focused, or null when it reports none within two seconds. */
	async activeApp(): Promise<{ name: string; id: string } | null> {
		try {
			const message = await this.withHostSocket((_, waitForMessage) =>
				waitForMessage((entry) => entry.type === 'activeApp', 2000),
			);
			return { name: message['name'] as string, id: message['id'] as string };
		} catch {
			return null;
		}
	}

	private authorizationHeader(): Record<string, string> {
		return { Authorization: `Bearer ${this.readPairingToken()}` };
	}

	/**
	 * Opens a WebSocket, says hello like a deck would, runs the conversation and closes the socket
	 * again. Messages that arrive before anyone waits for them are queued, so a conversation never
	 * misses the config the host sends right after the handshake.
	 */
	private withHostSocket<T>(
		conversation: (socket: WebSocket, waitForMessage: WaitForMessage) => Promise<T>,
	): Promise<T> {
		const url = `${this.baseURL.replace('http', 'ws')}/ws?token=${this.readPairingToken()}`;
		return new Promise<T>((resolve, reject) => {
			const socket = new WebSocket(url);
			const unclaimedMessages: HostMessage[] = [];
			const waiters: { match: MessageMatcher; resolve: (message: HostMessage) => void }[] =
				[];

			socket.onmessage = (event) => {
				const message = JSON.parse(String(event.data)) as HostMessage;
				const waiterIndex = waiters.findIndex((waiter) => waiter.match(message));
				if (waiterIndex >= 0) {
					waiters.splice(waiterIndex, 1)[0].resolve(message);
				} else {
					unclaimedMessages.push(message);
				}
			};

			const waitForMessage: WaitForMessage = (
				match,
				timeoutMs = DEFAULT_MESSAGE_TIMEOUT_MS,
			) =>
				new Promise<HostMessage>((resolveMessage, rejectMessage) => {
					const queuedIndex = unclaimedMessages.findIndex(match);
					if (queuedIndex >= 0) {
						resolveMessage(unclaimedMessages.splice(queuedIndex, 1)[0]);
						return;
					}
					const timer = setTimeout(
						() => rejectMessage(new Error('host message timeout')),
						timeoutMs,
					);
					waiters.push({
						match,
						resolve: (message) => {
							clearTimeout(timer);
							resolveMessage(message);
						},
					});
				});

			socket.onerror = () => reject(new Error('host websocket failed'));
			socket.onopen = () => {
				socket.send(
					JSON.stringify({
						type: 'hello',
						clientId: 'e2e',
						name: 'deck-e2e',
						version: 2,
					}),
				);
				conversation(socket, waitForMessage)
					.then((value) => {
						socket.close();
						resolve(value);
					})
					.catch((error) => {
						socket.close();
						reject(error);
					});
			};
		});
	}
}
