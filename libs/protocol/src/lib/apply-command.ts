import { Button, Command, Config, Profile } from './models';

/** A button's place in the config: the list that directly holds it and its position there. */
export interface ButtonLocation {
	list: Button[];
	index: number;
}

/**
 * Pure mirror of the host's command application, used for optimistic updates and for
 * applying broadcast changes. Validation lives on the host; this only transforms.
 * Returns a new config; the input is not mutated.
 */
export function applyCommand(config: Config, command: Command): Config {
	const updated: Config = structuredClone(config);
	switch (command.type) {
		case 'profile.create': {
			const profile: Profile = {
				...command.profile,
				buttons: command.profile.buttons ?? [],
			};
			insertAt(updated.profiles, command.index, profile);
			break;
		}
		case 'profile.update': {
			const profile = updated.profiles.find((item) => item.id === command.id);
			if (profile) {
				mergePatch(profile, command.patch);
			}
			break;
		}
		case 'profile.delete':
			updated.profiles = updated.profiles.filter((item) => item.id !== command.id);
			break;
		case 'profile.move': {
			const index = updated.profiles.findIndex((item) => item.id === command.id);
			if (index >= 0) {
				const [profile] = updated.profiles.splice(index, 1);
				insertAt(updated.profiles, command.index, profile);
			}
			break;
		}
		case 'button.create': {
			const list = destinationList(updated, command.profileId, command.parentId);
			if (list) {
				insertAt(list, command.index, structuredClone(command.button));
			}
			break;
		}
		case 'button.update': {
			const location = locateButton(updated, command.id);
			if (location) {
				mergePatch(location.list[location.index], command.patch);
			}
			break;
		}
		case 'button.delete': {
			const location = locateButton(updated, command.id);
			location?.list.splice(location.index, 1);
			break;
		}
		case 'button.move': {
			const location = locateButton(updated, command.id);
			if (!location) {
				break;
			}
			const [button] = location.list.splice(location.index, 1);
			// The destination is looked up after the removal, because removing the button may
			// have shifted the list it is about to join.
			const destination = destinationList(updated, command.profileId, command.parentId);
			if (destination) {
				insertAt(destination, command.index, button);
			}
			break;
		}
		case 'settings.update':
			mergePatch(updated.settings, command.patch);
			break;
	}
	return updated;
}

/** Finds the list that directly contains the button, searching folders. */
export function locateButton(config: Config, id: string): ButtonLocation | null {
	for (const profile of config.profiles) {
		const location = locateButtonIn(profile.buttons, id);
		if (location) {
			return location;
		}
	}
	return null;
}

export function findButton(config: Config, id: string): Button | null {
	const location = locateButton(config, id);
	return location ? location.list[location.index] : null;
}

function locateButtonIn(list: Button[], id: string): ButtonLocation | null {
	for (let index = 0; index < list.length; index++) {
		const button = list[index];
		if (button.id === id) {
			return { list, index };
		}
		if (button.folder) {
			const location = locateButtonIn(button.folder, id);
			if (location) {
				return location;
			}
		}
	}
	return null;
}

/**
 * The list a button goes into: a folder when parentId is set, otherwise the top level of the
 * page. A folder is created lazily, because a button only becomes one once something is put in it.
 */
function destinationList(config: Config, profileId?: string, parentId?: string): Button[] | null {
	if (parentId) {
		const parent = findButton(config, parentId);
		if (!parent) {
			return null;
		}
		parent.folder ??= [];
		return parent.folder;
	}
	const profile = config.profiles.find((item) => item.id === profileId);
	return profile ? profile.buttons : null;
}

/** Inserts at the index, clamped to the list; no index means at the end. */
function insertAt<T>(list: T[], index: number | undefined, item: T): void {
	list.splice(clampIndex(index, list.length), 0, item);
}

/** JSON merge patch on the top level: a null or undefined value removes the field. */
function mergePatch<T extends object>(target: T, patch: Partial<Record<keyof T, unknown>>): void {
	const fields = target as Record<string, unknown>;
	for (const [key, value] of Object.entries(patch)) {
		if (value === null || value === undefined) {
			delete fields[key];
		} else {
			fields[key] = value;
		}
	}
}

function clampIndex(index: number | undefined, length: number): number {
	if (index === undefined || index > length) {
		return length;
	}
	return Math.max(0, index);
}
