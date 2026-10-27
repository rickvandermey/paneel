import { buildPairingUrl } from '@sd/host-client';

/**
 * The pairing URL lives in localStorage so the deck reconnects after a reload. Storage can be
 * blocked (private mode, cleared site data); the session then works without persistence.
 */
const STORAGE_KEY = 'sd.pairingUrl';

export function readSavedPairingUrl(): string {
	try {
		return localStorage.getItem(STORAGE_KEY) ?? '';
	} catch {
		return '';
	}
}

export function savePairingUrl(url: string): void {
	try {
		localStorage.setItem(STORAGE_KEY, url);
	} catch {
		// Blocked storage: the URL is still used for this session.
	}
}

export function clearSavedPairingUrl(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing was stored, so there is nothing to clean up.
	}
}

/**
 * A pairing link opened from the QR code carries the token in the address bar. It is saved and
 * stripped from the address, so the token is not left in the browser history.
 */
export function takeTokenFromAddressBar(): string | null {
	const token = new URLSearchParams(location.search).get('token');
	if (!token) {
		return null;
	}
	const url = buildPairingUrl(location.origin, token);
	savePairingUrl(url);
	history.replaceState(null, '', location.pathname);
	return url;
}
