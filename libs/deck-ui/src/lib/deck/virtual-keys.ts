import type { Button } from '@sd/protocol';

/**
 * Keys the deck draws itself, next to the user's buttons: "Back" inside a folder and "Add" in
 * edit mode. Their ids start with a marker so they can never collide with a stored button.
 */
const VIRTUAL_KEY_PREFIX = '__';
export const BACK_KEY_ID = `${VIRTUAL_KEY_PREFIX}back`;
export const ADD_KEY_ID = `${VIRTUAL_KEY_PREFIX}add`;

const VIRTUAL_KEY_COLOR = '#1f2937';

export const BACK_KEY: Button = {
	id: BACK_KEY_ID,
	label: 'Back',
	showLabel: true,
	color: VIRTUAL_KEY_COLOR,
	icon: { source: 'phosphor', name: 'arrow-u-up-left' },
	actions: [],
};

export const ADD_KEY: Button = {
	id: ADD_KEY_ID,
	label: 'Add',
	showLabel: true,
	color: VIRTUAL_KEY_COLOR,
	icon: { source: 'phosphor', name: 'plus', weight: 'bold' },
	actions: [],
};

export function isVirtualKeyId(id: string): boolean {
	return id.startsWith(VIRTUAL_KEY_PREFIX);
}

/** Index of a button among the real buttons of a list, skipping the virtual keys; null for a virtual or unknown id. */
export function indexAmongRealButtons(visible: Button[], targetId: string): number | null {
	let index = 0;
	for (const button of visible) {
		if (button.id === targetId) {
			return isVirtualKeyId(button.id) ? null : index;
		}
		if (!isVirtualKeyId(button.id)) {
			index++;
		}
	}
	return null;
}
