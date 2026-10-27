/** The host platforms the editor adapts shortcuts and app names to. */
export type Platform = 'darwin' | 'windows' | 'linux';

/** Narrows what the host reports (runtime.GOOS) to a known platform; unknown values count as Linux. */
export function platformOf(value: string | undefined): Platform {
	return value === 'darwin' || value === 'windows' ? value : 'linux';
}

export function isMac(platform: string | undefined): boolean {
	return platformOf(platform) === 'darwin';
}
