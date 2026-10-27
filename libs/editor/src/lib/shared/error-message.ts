/** The message of a thrown value, or the fallback when something other than an Error was thrown. */
export function errorMessage(cause: unknown, fallback: string): string {
	return cause instanceof Error && cause.message ? cause.message : fallback;
}
