/** Where a deck talks to: the host's origin and the pairing token that authorizes it. */
export interface PairingTarget {
	origin: string;
	token: string;
}

/** Pairing URLs look like http://192.168.1.10:48220/?token=abc. */
export function parsePairingUrl(pairingUrl: string): PairingTarget {
	const url = new URL(pairingUrl);
	return { origin: url.origin, token: url.searchParams.get('token') ?? '' };
}

export function buildPairingUrl(origin: string, token: string): string {
	return `${origin}/?token=${encodeURIComponent(token)}`;
}

export function pairingUrlToSocketUrl(pairingUrl: string): string {
	const { origin, token } = parsePairingUrl(pairingUrl);
	const scheme = origin.startsWith('https:') ? 'wss:' : 'ws:';
	return `${scheme}${origin.slice(origin.indexOf('//'))}/ws?token=${encodeURIComponent(token)}`;
}

/** A host URL that carries the token as a query value, for links the browser opens itself. */
export function tokenUrl(target: PairingTarget, path: string, query = ''): string {
	const tokenQuery = `token=${encodeURIComponent(target.token)}`;
	return `${target.origin}${path}?${query ? `${query}&` : ''}${tokenQuery}`;
}

/** The pairing URL after the host moved to another port or token. */
export function pairingUrlWithNetwork(pairingUrl: string, port: number, token: string): string {
	const url = new URL(pairingUrl);
	url.port = String(port);
	url.search = `?token=${encodeURIComponent(token)}`;
	return url.toString();
}
