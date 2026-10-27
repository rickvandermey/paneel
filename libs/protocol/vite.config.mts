/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/libs/protocol',
	test: {
		name: 'protocol',
		watch: false,
		globals: true,
		environment: 'node',
		include: ['src/**/*.spec.ts'],
		reporters: ['default'],
		coverage: {
			reportsDirectory: '../../coverage/libs/protocol',
			provider: 'v8' as const,
		},
	},
}));
