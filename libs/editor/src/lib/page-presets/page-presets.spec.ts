import { PAGE_PRESETS, rankPagePresets } from './page-presets';

const installed = [
	{ name: 'Spotify', target: 'Spotify', path: '/Applications/Spotify.app' },
	{
		name: 'Google Chrome',
		target: 'Google Chrome',
		path: '/Applications/Google Chrome.app',
	},
	{ name: 'Safari', target: 'Safari', path: '/Applications/Safari.app' },
];

describe('rankPagePresets', () => {
	it('puts presets with installed apps first, most matches on top', () => {
		const { recommended, others } = rankPagePresets(installed);
		expect(recommended.map((entry) => entry.preset.id)).toEqual(['browsing', 'music']);
		expect(recommended[0].installed).toEqual(['Google Chrome', 'Safari']);
		expect(others.map((entry) => entry.preset.id)).not.toContain('music');
	});

	it('filters by name, description or app', () => {
		const { recommended, others } = rankPagePresets(installed, 'spot');
		expect(recommended.map((entry) => entry.preset.id)).toEqual(['music']);
		expect(others).toEqual([]);
	});

	it('builds buttons for every preset on both platforms', () => {
		for (const preset of PAGE_PRESETS) {
			for (const platform of ['darwin', 'windows']) {
				expect(preset.buttons(platform, installed).length).toBeGreaterThan(3);
			}
		}
	});
});
