import { createBdd, test as base } from 'playwright-bdd';
import { HostApi } from './host-api';

/** Per-scenario memory for values a later step compares against. */
export interface ScenarioState {
	originalColors: string[];
	backup: Buffer | null;
	keySize: { width: number; height: number } | null;
}

/** Every WebSocket frame of the running scenario except pings; printed when the scenario fails. */
export const webSocketFrames: string[] = [];

const FRAME_PREVIEW_LENGTH = 200;

export const test = base.extend<{
	host: HostApi;
	state: ScenarioState;
	consoleErrors: string[];
	recordWebSocketFrames: void;
}>({
	host: async ({ baseURL }, use) => {
		await use(new HostApi(baseURL ?? ''));
	},
	// eslint-disable-next-line no-empty-pattern -- Playwright fixtures take the destructured deps first
	state: async ({}, use) => {
		await use({ originalColors: [], backup: null, keySize: null });
	},
	// Registered automatically so console errors are captured from the first navigation.
	consoleErrors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
			page.on('console', (message) => {
				if (message.type() === 'error' && !/favicon\.ico/.test(message.text())) {
					errors.push(`console: ${message.text()}`);
				}
			});
			await use(errors);
		},
		{ auto: true },
	],
	recordWebSocketFrames: [
		async ({ page }, use) => {
			page.on('websocket', (socket) => {
				socket.on('framesent', (frame) => {
					const text = String(frame.payload);
					if (!text.includes('"type":"ping"')) {
						webSocketFrames.push(`SENT ${text.slice(0, FRAME_PREVIEW_LENGTH)}`);
					}
				});
				socket.on('framereceived', (frame) => {
					const text = String(frame.payload);
					if (!text.includes('"type":"pong"')) {
						webSocketFrames.push(`RECV ${text.slice(0, FRAME_PREVIEW_LENGTH)}`);
					}
				});
			});
			await use();
		},
		{ auto: true },
	],
});

export const { Given, When, Then, After } = createBdd(test);
