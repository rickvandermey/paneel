/**
 * An id for commands, pages and buttons. crypto.randomUUID is only available in secure contexts
 * and the deck is usually opened over plain http on a LAN IP, so there is a fallback.
 */
export function randomId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
