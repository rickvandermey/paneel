import type { Button } from '@sd/protocol';
import { phosphor } from '../shared/icons';

/** Three keys in fixed colors, so theme cards and the theme editor preview look alike. */
export const SAMPLE_KEYS: Button[] = [
	{
		id: 'sample-play',
		label: 'Play',
		showLabel: true,
		color: '#6d28d9',
		icon: phosphor('play'),
		actions: [],
	},
	{
		id: 'sample-copy',
		label: 'Copy',
		showLabel: true,
		color: '#0f766e',
		icon: phosphor('copy'),
		actions: [],
	},
	{
		id: 'sample-claude',
		label: 'Claude',
		showLabel: true,
		color: '#b45309',
		icon: phosphor('sparkle'),
		actions: [],
	},
];
