import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		ignores: ['src/features-gen/**'],
	},
	{
		files: ['**/*.steps.ts', '**/fixtures.ts', '**/helpers.ts', '**/host-api.ts'],
		...playwright.configs['flat/recommended'],
	},
	{
		files: ['**/*.steps.ts', '**/fixtures.ts', '**/helpers.ts', '**/host-api.ts'],
		rules: {
			'playwright/no-standalone-expect': 'off',
			'playwright/no-conditional-in-test': 'off',
		},
	},
];
