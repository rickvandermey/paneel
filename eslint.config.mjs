import nx from '@nx/eslint-plugin';

export default [
	...nx.configs['flat/base'],
	...nx.configs['flat/typescript'],
	...nx.configs['flat/javascript'],
	{
		ignores: ['**/dist', '**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'],
	},
	{
		files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
		rules: {
			'@nx/enforce-module-boundaries': [
				'error',
				{
					enforceBuildableLibDependency: true,
					allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
					depConstraints: [
						{ sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
						{ sourceTag: 'type:lib', onlyDependOnLibsWithTags: ['type:lib'] },
						{
							sourceTag: 'type:e2e',
							onlyDependOnLibsWithTags: ['type:lib', 'type:e2e'],
						},
						{
							sourceTag: 'scope:e2e',
							onlyDependOnLibsWithTags: ['scope:shared', 'scope:e2e'],
						},
						{
							sourceTag: 'scope:shared',
							onlyDependOnLibsWithTags: ['scope:shared'],
						},
						{
							sourceTag: 'scope:desktop',
							onlyDependOnLibsWithTags: ['scope:shared', 'scope:desktop'],
						},
						{
							sourceTag: 'scope:mobile',
							onlyDependOnLibsWithTags: ['scope:shared', 'scope:mobile'],
						},
					],
				},
			],
		},
	},
	{
		files: [
			'**/*.ts',
			'**/*.tsx',
			'**/*.cts',
			'**/*.mts',
			'**/*.js',
			'**/*.jsx',
			'**/*.cjs',
			'**/*.mjs',
		],
		// Override or add rules here
		rules: {},
	},
];
