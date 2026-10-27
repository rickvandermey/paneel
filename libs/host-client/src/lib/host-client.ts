import { computed, Injectable, signal } from '@angular/core';
import {
	Action,
	ActiveAppMessage,
	AckMessage,
	applyCommand,
	AssistantReply,
	AssistantRequest,
	AssistantStatus,
	ClientMessage,
	Command,
	CommandResultMessage,
	Config,
	HostMessage,
	IconRef,
	isHostMessage,
	LogEntry,
	LogLevel,
	LogsResponse,
	PROTOCOL_VERSION,
	WelcomeMessage,
} from '@sd/protocol';
import { configAfterChange } from './config-sync';
import { isTokenRejected, requestHost, requestJson } from './host-api';
import {
	PairingTarget,
	pairingUrlToSocketUrl,
	pairingUrlWithNetwork,
	parsePairingUrl,
	tokenUrl,
} from './pairing-url';
import { failedCommandResult, NO_REVISION, PendingCommands } from './pending-commands';
import { randomId } from './random-id';

/** 'unpaired' means the host is reachable but rejects the token, so the deck must pair again. */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'unpaired';

const RECONNECT_DELAY_MS = 2000;
const MAX_LOCAL_LOG_ENTRIES = 300;
const PING_INTERVAL_MS = 5000;
/** The host restarts shortly after answering a network change; reconnecting right away would hit the old port. */
const RECONNECT_AFTER_NETWORK_CHANGE_MS = 800;
const DEFAULT_HTTP_PORT = 80;

/** An application installed on the host; target is what a launch action needs. */
export interface InstalledApp {
	name: string;
	target: string;
	path: string;
}

export interface NetworkChange {
	port?: number;
	rotateToken?: boolean;
}

/**
 * The deck's connection to one host: a WebSocket for the live protocol plus the REST endpoints
 * for icons, logs, backups and the assistant. Everything the UI shows is exposed as signals.
 */
@Injectable({ providedIn: 'root' })
export class HostClient {
	readonly status = signal<ConnectionStatus>('idle');
	/** What the host said about itself in its welcome message. */
	readonly hostInfo = signal<WelcomeMessage | null>(null);
	readonly config = signal<Config | null>(null);
	readonly revision = computed(() => this.config()?.revision ?? NO_REVISION);
	/** Round trip of the last ping, or of the last press minus its execution time. */
	readonly networkMs = signal<number | null>(null);
	readonly lastExecutionMs = signal<number | null>(null);
	readonly error = signal<string | null>(null);
	/** The application that has the focus on the host, for automatic page switching. */
	readonly activeApp = signal<ActiveAppMessage | null>(null);
	/** Toggle buttons that are on right now. */
	readonly buttonStates = signal<Record<string, boolean>>({});
	/** What this deck logged itself, kept for the logs panel when the host cannot be asked. */
	readonly logs = signal<LogEntry[]>([]);
	/** The URL currently used to pair; changes when the port or token is rotated from the editor. */
	readonly pairingUrl = signal<string | null>(null);
	readonly port = computed(() => {
		const url = this.pairingUrl();
		return url ? Number(new URL(url).port) || DEFAULT_HTTP_PORT : 0;
	});

	private pairing: PairingTarget | null = null;
	private socket: WebSocket | null = null;
	private socketUrl: string | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private pingTimer: ReturnType<typeof setInterval> | null = null;
	private readonly clientId = randomId();
	private readonly pendingCommands = new PendingCommands();
	/** Bumped by connect and disconnect so a pairing check that finishes late is ignored. */
	private connectionGeneration = 0;

	connect(pairingUrl: string): void {
		this.disconnect();
		this.pairing = parsePairingUrl(pairingUrl);
		this.socketUrl = pairingUrlToSocketUrl(pairingUrl);
		this.pairingUrl.set(pairingUrl);
		this.openSocket();
	}

	disconnect(): void {
		this.clearTimers();
		this.connectionGeneration += 1;
		this.socketUrl = null;
		this.pairing = null;
		this.socket?.close();
		this.socket = null;
		this.status.set('idle');
		this.pairingUrl.set(null);
		this.pendingCommands.failAll('disconnected');
	}

	press(buttonId: string): void {
		this.sendMessage({ type: 'press', buttonId, sentAt: Date.now() });
	}

	/** Executes actions right away without a stored button, for example keys and try-outs. */
	run(actions: Action[]): void {
		this.sendMessage({ type: 'run', runId: randomId(), actions, sentAt: Date.now() });
	}

	/** Applies the command locally right away and resolves with the host's verdict. */
	send(command: Command): Promise<CommandResultMessage> {
		const commandId = randomId();
		const current = this.config();
		if (!current || !this.isSocketOpen()) {
			return Promise.resolve(failedCommandResult(commandId, 'not connected'));
		}
		this.config.set(applyCommand(current, command));
		const verdict = this.pendingCommands.waitFor(commandId);
		this.sendMessage({ type: 'command', commandId, baseRevision: current.revision, command });
		return verdict;
	}

	assetUrl(hash: string): string {
		return this.pairing ? tokenUrl(this.pairing, `/assets/${hash}`) : '';
	}

	/** Direct download link for a zip with pages, settings and icons. */
	backupUrl(): string {
		return this.pairing ? tokenUrl(this.pairing, '/api/backup') : '';
	}

	logsUrl(): string {
		return this.pairing ? tokenUrl(this.pairing, '/api/logs', 'format=text') : '';
	}

	/**
	 * Keeps a line here and hands it to the host when connected, so one log tells the whole story.
	 * Callers never pass the token, typed text or prompts.
	 */
	log(level: LogLevel, message: string, fields?: string): void {
		const entry: LogEntry = {
			time: new Date().toISOString(),
			level,
			source: 'deck',
			message,
			fields,
		};
		this.logs.update((entries) => [...entries, entry].slice(-MAX_LOCAL_LOG_ENTRIES));
		if (this.isSocketOpen()) {
			this.sendMessage({ type: 'log', level, message, fields });
		}
	}

	// REST endpoints

	resolveIcon(action: Action): Promise<IconRef> {
		return this.postJson<IconRef>('/api/icons/resolve', action);
	}

	/** Stores a Simple Icons logo on the host in one flat color and returns the asset. */
	resolveLogo(slug: string, color: string): Promise<IconRef> {
		return this.postJson<IconRef>('/api/icons/logo', { slug, color });
	}

	uploadAsset(file: Blob): Promise<IconRef> {
		return this.postBody<IconRef>('/api/assets', file);
	}

	/** Applications installed on the host, for the app picker. */
	listApps(): Promise<InstalledApp[]> {
		return this.getJson<InstalledApp[]>('/api/apps');
	}

	assistantStatus(): Promise<AssistantStatus> {
		return this.getJson<AssistantStatus>('/api/assistant');
	}

	/** One page-builder turn; the host validates the reply before it gets here. */
	assistant(request: AssistantRequest): Promise<AssistantReply> {
		return this.postJson<AssistantReply>('/api/assistant', request);
	}

	fetchLogs(): Promise<LogsResponse> {
		return this.getJson<LogsResponse>('/api/logs');
	}

	async clearLogs(): Promise<void> {
		await requestHost(this.requirePairing(), '/api/logs/clear', { method: 'POST' });
		this.logs.set([]);
	}

	/** Replaces pages, settings and icons with a backup zip; the host pushes the result to all decks. */
	async restore(file: Blob): Promise<number> {
		const result = await this.postBody<{ pages: number }>('/api/restore', file);
		return result.pages;
	}

	/** Replaces pages and settings with the defaults; the host pushes the fresh config to all decks. */
	async resetConfig(): Promise<void> {
		await requestHost(this.requirePairing(), '/api/reset', { method: 'POST' });
	}

	/**
	 * Changes the port or rotates the token on the host, then reconnects with the new pairing URL.
	 * Other decks are dropped by the host and must pair again.
	 */
	async updateNetwork(change: NetworkChange): Promise<string> {
		const current = this.pairingUrl();
		if (!current) {
			throw new Error('not connected');
		}
		const network = await this.postJson<{ port: number; token: string }>(
			'/api/network',
			change,
		);
		const nextPairingUrl = pairingUrlWithNetwork(current, network.port, network.token);
		setTimeout(() => this.connect(nextPairingUrl), RECONNECT_AFTER_NETWORK_CHANGE_MS);
		return nextPairingUrl;
	}

	private getJson<T>(path: string): Promise<T> {
		return requestJson<T>(this.requirePairing(), path, { method: 'GET' });
	}

	private postJson<T>(path: string, body: unknown): Promise<T> {
		return requestJson<T>(this.requirePairing(), path, {
			method: 'POST',
			body: JSON.stringify(body),
		});
	}

	private postBody<T>(path: string, body: Blob): Promise<T> {
		return requestJson<T>(this.requirePairing(), path, { method: 'POST', body });
	}

	private requirePairing(): PairingTarget {
		if (!this.pairing) {
			throw new Error('not connected');
		}
		return this.pairing;
	}

	// The WebSocket

	private openSocket(): void {
		if (!this.socketUrl) {
			return;
		}
		this.status.set('connecting');
		this.error.set(null);
		this.log('debug', 'connecting', `origin=${this.pairing?.origin ?? ''}`);
		const socket = new WebSocket(this.socketUrl);
		this.socket = socket;
		// The browser hides why a socket closed; whether it ever opened is the one clue we keep.
		let handshakeOpened = false;
		socket.onopen = () => {
			handshakeOpened = true;
			this.onSocketOpen();
		};
		socket.onmessage = (event) => {
			const message = parseHostMessage(event.data);
			if (message) {
				this.handleHostMessage(message);
			}
		};
		socket.onerror = () => this.error.set('Cannot reach your computer. Retrying…');
		socket.onclose = () => this.onSocketClose(socket, handshakeOpened);
	}

	private onSocketOpen(): void {
		this.status.set('connected');
		this.sendMessage({
			type: 'hello',
			clientId: this.clientId,
			name: navigator.userAgent,
			version: PROTOCOL_VERSION,
		});
		this.log('info', 'connected', `clientId=${this.clientId}`);
		this.pingTimer = setInterval(
			() => this.sendMessage({ type: 'ping', sentAt: Date.now() }),
			PING_INTERVAL_MS,
		);
	}

	private onSocketClose(socket: WebSocket, handshakeOpened: boolean): void {
		this.clearTimers();
		if (this.socket !== socket) {
			// A newer socket replaced this one; its close is old news.
			return;
		}
		this.socket = null;
		this.status.set('disconnected');
		this.pendingCommands.failAll('connection lost');
		this.log(
			handshakeOpened ? 'warn' : 'debug',
			handshakeOpened ? 'connection lost' : 'handshake did not open',
		);
		if (!this.socketUrl) {
			return;
		}
		if (handshakeOpened) {
			this.scheduleReconnect();
		} else {
			void this.checkPairingAfterFailedHandshake();
		}
	}

	/**
	 * A handshake that never opened is either a host that is down (keep retrying) or a host that
	 * rejects the token, which the browser hides behind the same close event. The session endpoint
	 * tells the two apart, so a stale pairing stops looping and asks to pair again.
	 */
	private async checkPairingAfterFailedHandshake(): Promise<void> {
		const generation = this.connectionGeneration;
		const pairing = this.pairing;
		if (!pairing || !this.socketUrl) {
			return;
		}
		const rejected = await isTokenRejected(pairing);
		if (generation !== this.connectionGeneration || !this.socketUrl) {
			return;
		}
		if (rejected) {
			this.log('warn', 'token rejected by the host, pairing needed');
			this.socketUrl = null;
			this.status.set('unpaired');
			this.error.set(
				'This deck is no longer paired with your computer. Scan the QR code again.',
			);
			return;
		}
		this.scheduleReconnect();
	}

	private scheduleReconnect(): void {
		this.reconnectTimer = setTimeout(() => this.openSocket(), RECONNECT_DELAY_MS);
	}

	private handleHostMessage(message: HostMessage): void {
		switch (message.type) {
			case 'welcome':
				this.hostInfo.set(message);
				break;
			case 'config':
				this.config.set(message.config);
				break;
			case 'changed':
				this.applyChange(message.commandId, message);
				break;
			case 'commandResult':
				this.pendingCommands.settle(message);
				if (!message.ok) {
					this.error.set(message.error ?? 'Change rejected');
					this.requestSync();
				}
				break;
			case 'ack':
				this.recordAck(message);
				break;
			case 'pong':
				this.networkMs.set(Date.now() - message.sentAt);
				break;
			case 'activeApp':
				this.activeApp.set(message);
				break;
			case 'buttonState':
				this.buttonStates.set(message.states);
				break;
			case 'error':
				this.error.set(message.message);
				break;
		}
	}

	private applyChange(
		commandId: string | undefined,
		message: Extract<HostMessage, { type: 'changed' }>,
	): void {
		const current = this.config();
		if (!current) {
			return;
		}
		const isOwnCommand = commandId !== undefined && this.pendingCommands.has(commandId);
		const updated = configAfterChange(current, message, isOwnCommand);
		if (updated === 'resync') {
			this.requestSync();
			return;
		}
		this.config.set(updated);
	}

	private recordAck(message: AckMessage): void {
		this.lastExecutionMs.set(message.executionMs);
		if (message.sentAt) {
			// The ack comes back after the action ran, so the execution time is not network time.
			this.networkMs.set(Math.max(0, Date.now() - message.sentAt - message.executionMs));
		}
		if (!message.ok) {
			this.error.set(message.error ?? 'Action failed');
			this.log(
				'warn',
				'action failed',
				`button=${message.buttonId} error=${message.error ?? ''}`,
			);
		}
	}

	/** Asks for the whole config again after a missed or rejected change. */
	private requestSync(): void {
		this.sendMessage({ type: 'sync', sinceRevision: this.config()?.revision ?? NO_REVISION });
	}

	private isSocketOpen(): boolean {
		return this.socket?.readyState === WebSocket.OPEN;
	}

	private sendMessage(message: ClientMessage): void {
		if (this.isSocketOpen()) {
			this.socket?.send(JSON.stringify(message));
		}
	}

	private clearTimers(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
	}
}

/** Decodes one frame; frames that are not JSON or carry no type are ignored. */
function parseHostMessage(data: unknown): HostMessage | null {
	try {
		const parsed: unknown = JSON.parse(String(data));
		return isHostMessage(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
