/**
 * localStorage and sessionStorage throw in private windows and when site data is blocked, so
 * every access goes through these helpers and a blocked storage simply behaves as empty.
 */

type Storage = 'local' | 'session';

function storageFor(kind: Storage): globalThis.Storage {
	return kind === 'local' ? localStorage : sessionStorage;
}

export function readStored(kind: Storage, key: string): string | null {
	try {
		return storageFor(kind).getItem(key);
	} catch {
		return null;
	}
}

export function writeStored(kind: Storage, key: string, value: string): void {
	try {
		storageFor(kind).setItem(key, value);
	} catch {
		// Blocked storage: the value lives on in memory for this visit only.
	}
}

export function removeStored(kind: Storage, key: string): void {
	try {
		storageFor(kind).removeItem(key);
	} catch {
		// Nothing was stored, so there is nothing to remove.
	}
}
