import { applyCommand, findButton } from './apply-command';
import { Config } from './models';

function baseConfig(): Config {
	return {
		schemaVersion: 1,
		revision: 0,
		settings: { terminal: '' },
		profiles: [
			{
				id: 'p1',
				name: 'One',
				buttons: [
					{ id: 'a', showLabel: true, color: '#111111', actions: [] },
					{ id: 'b', showLabel: true, color: '#222222', actions: [] },
					{
						id: 'f',
						showLabel: true,
						color: '#333333',
						actions: [],
						folder: [{ id: 'c', showLabel: true, color: '#444444', actions: [] }],
					},
				],
			},
		],
	};
}

const ids = (config: Config) => config.profiles[0].buttons.map((button) => button.id);

describe('applyCommand', () => {
	it('does not mutate the input', () => {
		const config = baseConfig();
		applyCommand(config, { type: 'button.delete', id: 'a' });
		expect(ids(config)).toEqual(['a', 'b', 'f']);
	});

	it('creates at an index and into folders', () => {
		let config = applyCommand(baseConfig(), {
			type: 'button.create',
			profileId: 'p1',
			index: 1,
			button: { id: 'x', showLabel: true, color: '#000000', actions: [] },
		});
		expect(ids(config)).toEqual(['a', 'x', 'b', 'f']);
		config = applyCommand(config, {
			type: 'button.create',
			parentId: 'f',
			button: { id: 'y', showLabel: true, color: '#000000', actions: [] },
		});
		expect(findButton(config, 'f')?.folder?.map((button) => button.id)).toEqual(['c', 'y']);
	});

	it('patches with null clearing a field', () => {
		let config = applyCommand(baseConfig(), {
			type: 'button.update',
			id: 'c',
			patch: { label: 'C', icon: { source: 'emoji', value: '🎉' } },
		});
		expect(findButton(config, 'c')).toMatchObject({
			label: 'C',
			icon: { source: 'emoji' },
		});
		config = applyCommand(config, {
			type: 'button.update',
			id: 'c',
			patch: { icon: null },
		});
		expect(findButton(config, 'c')?.icon).toBeUndefined();
	});

	it('moves between lists and clamps the index', () => {
		let config = applyCommand(baseConfig(), {
			type: 'button.move',
			id: 'c',
			profileId: 'p1',
			index: 0,
		});
		expect(ids(config)).toEqual(['c', 'a', 'b', 'f']);
		config = applyCommand(config, {
			type: 'button.move',
			id: 'a',
			profileId: 'p1',
			index: 99,
		});
		expect(ids(config)).toEqual(['c', 'b', 'f', 'a']);
	});

	it('handles profiles and settings', () => {
		let config = applyCommand(baseConfig(), {
			type: 'profile.create',
			profile: { id: 'p2', name: 'Two' },
			index: 0,
		});
		expect(config.profiles.map((profile) => profile.id)).toEqual(['p2', 'p1']);
		config = applyCommand(config, { type: 'profile.move', id: 'p2', index: 5 });
		config = applyCommand(config, {
			type: 'profile.update',
			id: 'p2',
			patch: { name: 'Renamed' },
		});
		expect(config.profiles[1].name).toBe('Renamed');
		config = applyCommand(config, {
			type: 'settings.update',
			patch: { terminal: 'iTerm' },
		});
		expect(config.settings.terminal).toBe('iTerm');
		config = applyCommand(config, { type: 'profile.delete', id: 'p2' });
		expect(config.profiles.length).toBe(1);
	});
});
