import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
	// The Android project holds the copied web build and Gradle files, nothing to lint.
	{ ignores: ['android/**'] },
	...nx.configs['flat/angular'],
	...nx.configs['flat/angular-template'],
	...baseConfig,
	{
		files: ['**/*.ts'],
		rules: {
			'@angular-eslint/directive-selector': [
				'error',
				{
					type: 'attribute',
					prefix: 'sd',
					style: 'camelCase',
				},
			],
			'@angular-eslint/component-selector': [
				'error',
				{
					type: 'element',
					prefix: 'sd',
					style: 'kebab-case',
				},
			],
		},
	},
];
