import { defineConfig } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';
import { join } from 'node:path';
import { baseConfig } from '@sd/playwright-config';

/**
 * The suite runs the web deck against a real headless host on its own port and config folder, so
 * it never touches the developer's pairing or pages. The mobile build must exist in
 * apps/host/static/deck; the Nx e2e target builds it first.
 */
export const PORT = 48240;
export const CONFIG_DIR = join(workspaceRoot, 'tmp', 'deck-e2e-config');
/** The host records pressed actions here instead of running them, so a press moves nothing. */
export const ACTIONS_FILE = join(CONFIG_DIR, 'actions.jsonl');
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
	...baseConfig({
		appName: 'deck-e2e',
		baseURL,
		webServer: {
			command: `rm -rf "${CONFIG_DIR}" && go run ./cmd/hostd -static static/deck -port ${PORT} -config-dir "${CONFIG_DIR}" -record-actions "${ACTIONS_FILE}" -assistant-fake`,
			cwd: join(workspaceRoot, 'apps', 'host'),
			url: `${baseURL}/api/info`,
			reuseExistingServer: false,
			timeout: 180_000,
		},
	}),
});
