import type { InstalledApp } from '@sd/host-client';

/**
 * Three ways to ask whether an app is installed, from strict to loose. They differ on purpose:
 * app presets must not mistake "Photos" for Photoshop, page presets may, and launch targets on
 * Windows are executable names rather than app names.
 */

/** An exact name, or a versioned one such as "Adobe Photoshop 2025". */
export function isInstalledByExactName(installed: { name: string }[], names: string[]): boolean {
	return names.some((name) => {
		const wanted = name.toLowerCase();
		return installed.some((app) => {
			const have = app.name.toLowerCase();
			return have === wanted || have.startsWith(`${wanted} `);
		});
	});
}

/** Either name contains the other, so "Code" finds "Visual Studio Code" and the other way round. */
export function isInstalledByLooseName(installed: { name: string }[], name: string): boolean {
	const wanted = name.toLowerCase();
	return installed.some((app) => {
		const have = app.name.toLowerCase();
		return have === wanted || have.includes(wanted) || wanted.includes(have);
	});
}

/** A launch target: an app name on macOS, an executable or shortcut name on Windows. */
export function isLaunchTargetInstalled(installed: InstalledApp[], target: string): boolean {
	const wanted = target.toLowerCase();
	return installed.some((app) => {
		const name = app.name.toLowerCase();
		const file = app.path.toLowerCase();
		return (
			name === wanted ||
			name.includes(wanted) ||
			file.includes(`${wanted}.exe`) ||
			file.includes(`${wanted}.lnk`)
		);
	});
}
