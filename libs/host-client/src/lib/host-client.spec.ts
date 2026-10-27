import { TestBed } from '@angular/core/testing';
import { Config } from '@sd/protocol';
import { HostClient } from './host-client';
import { pairingUrlToSocketUrl, parsePairingUrl } from './pairing-url';
import { randomId } from './random-id';

/** Minimal stand-in for the browser WebSocket so the client can be driven from tests. */
class FakeWebSocket {
	static OPEN = 1;
	static instances: FakeWebSocket[] = [];
	readyState = FakeWebSocket.OPEN;
	sent: string[] = [];
	onopen: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;
	onerror: (() => void) | null = null;
	onclose: (() => void) | null = null;

	constructor(readonly url: string) {
		FakeWebSocket.instances.push(this);
		queueMicrotask(() => this.onopen?.());
	}

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		this.onclose?.();
	}

	receive(message: object): void {
		this.onmessage?.({ data: JSON.stringify(message) });
	}

	lastSent<T>(): T {
		return JSON.parse(this.sent[this.sent.length - 1]) as T;
	}
}

const config: Config = {
	schemaVersion: 1,
	revision: 3,
	settings: { terminal: '' },
	profiles: [
		{
			id: 'p',
			name: 'P',
			buttons: [{ id: 'a', showLabel: true, color: '#000000', actions: [] }],
		},
	],
};

describe('pairing helpers', () => {
	it('parses origin and token', () => {
		expect(parsePairingUrl('http://192.168.1.10:48220/?token=abc123')).toEqual({
			origin: 'http://192.168.1.10:48220',
			token: 'abc123',
		});
		expect(pairingUrlToSocketUrl('http://192.168.1.10:48220/?token=abc123')).toBe(
			'ws://192.168.1.10:48220/ws?token=abc123',
		);
		expect(pairingUrlToSocketUrl('https://deck.local/?token=x')).toBe(
			'wss://deck.local/ws?token=x',
		);
	});

	it('randomId falls back when crypto.randomUUID is unavailable, as on plain http', () => {
		const original = crypto.randomUUID;
		Object.defineProperty(crypto, 'randomUUID', {
			value: undefined,
			configurable: true,
		});
		try {
			const id = randomId();
			expect(id.length).toBeGreaterThan(8);
			expect(randomId()).not.toBe(id);
		} finally {
			Object.defineProperty(crypto, 'randomUUID', {
				value: original,
				configurable: true,
			});
		}
	});
});

describe('HostClient sync', () => {
	let client: HostClient;
	let socket: FakeWebSocket;
	const originalWebSocket = globalThis.WebSocket;

	beforeEach(async () => {
		FakeWebSocket.instances = [];
		(globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
		client = TestBed.inject(HostClient);
		client.connect('http://127.0.0.1:1/?token=t');
		await Promise.resolve();
		socket = FakeWebSocket.instances[0];
		socket.receive({
			type: 'welcome',
			hostName: 'h',
			platform: 'darwin',
			version: 2,
		});
		socket.receive({ type: 'config', config });
	});

	afterEach(() => {
		client.disconnect();
		(globalThis as unknown as { WebSocket: unknown }).WebSocket = originalWebSocket;
	});

	it('applies own commands optimistically and confirms on changed', async () => {
		const pending = client.send({
			type: 'button.update',
			id: 'a',
			patch: { label: 'Hi' },
		});
		expect(client.config()?.profiles[0].buttons[0].label).toBe('Hi');
		const message = socket.lastSent<{
			commandId: string;
			baseRevision: number;
		}>();
		expect(message.baseRevision).toBe(3);
		socket.receive({
			type: 'changed',
			revision: 4,
			commandId: message.commandId,
			command: { type: 'button.update', id: 'a', patch: { label: 'Hi' } },
		});
		socket.receive({
			type: 'commandResult',
			commandId: message.commandId,
			ok: true,
			revision: 4,
		});
		const result = await pending;
		expect(result.ok).toBe(true);
		expect(client.revision()).toBe(4);
	});

	it('applies changes from other clients in order', () => {
		socket.receive({
			type: 'changed',
			revision: 4,
			command: { type: 'button.delete', id: 'a' },
		});
		expect(client.config()?.profiles[0].buttons).toEqual([]);
		expect(client.revision()).toBe(4);
	});

	it('requests a sync when a revision is skipped or a command is rejected', async () => {
		socket.receive({
			type: 'changed',
			revision: 9,
			command: { type: 'button.delete', id: 'a' },
		});
		expect(socket.lastSent<{ type: string }>().type).toBe('sync');
		expect(client.revision()).toBe(3);

		const pending = client.send({ type: 'button.delete', id: 'a' });
		const commandId = socket.lastSent<{ commandId: string }>().commandId;
		socket.receive({
			type: 'commandResult',
			commandId,
			ok: false,
			revision: 3,
			error: 'nope',
		});
		expect((await pending).ok).toBe(false);
		expect(client.error()).toBe('nope');
		expect(socket.lastSent<{ type: string }>().type).toBe('sync');
		socket.receive({ type: 'config', config });
		expect(client.config()?.profiles[0].buttons.length).toBe(1);
	});

	it('derives network latency from acks', () => {
		socket.receive({
			type: 'ack',
			buttonId: 'a',
			ok: true,
			sentAt: Date.now() - 50,
			executionMs: 30,
		});
		expect(client.networkMs()).toBeLessThanOrEqual(25);
		expect(client.lastExecutionMs()).toBe(30);
	});
});
