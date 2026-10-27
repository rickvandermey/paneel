import type { PairingTarget } from './pairing-url';

/** Calls one of the host's REST endpoints with the pairing token; a non-2xx answer throws its text. */
export async function requestHost(
	target: PairingTarget,
	path: string,
	init: RequestInit,
): Promise<Response> {
	const response = await fetch(`${target.origin}${path}`, {
		...init,
		headers: { Authorization: `Bearer ${target.token}` },
	});
	if (!response.ok) {
		throw new Error((await response.text()) || `request failed (${response.status})`);
	}
	return response;
}

/** requestHost for endpoints that answer with JSON. */
export async function requestJson<T>(
	target: PairingTarget,
	path: string,
	init: RequestInit,
): Promise<T> {
	const response = await requestHost(target, path, init);
	return (await response.json()) as T;
}

/**
 * Asks the session endpoint whether the token is still valid. A host that cannot be reached
 * counts as "not rejected", because that is a network problem rather than a pairing problem.
 */
export async function isTokenRejected(target: PairingTarget): Promise<boolean> {
	try {
		const response = await fetch(`${target.origin}/api/session`, {
			headers: { Authorization: `Bearer ${target.token}` },
		});
		return response.status === 401;
	} catch {
		return false;
	}
}
