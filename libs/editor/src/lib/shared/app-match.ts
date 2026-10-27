import type { Button, Profile } from '@sd/protocol';

/** What the host reports about the focused application. */
export interface FocusedApp {
	name: string;
	id: string;
}

export type SmartPagesMode = 'buttons' | 'explicit';

/** A page's appMatch is stored as comma-separated app names or bundle ids. */
export function splitAppMatch(appMatch: string | undefined): string[] {
	return (appMatch ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

export function joinAppMatch(names: string[]): string {
	return names.join(', ');
}

export function sameAppName(left: string, right: string): boolean {
	return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** Any case-insensitive substring hit on the app's name or id counts as a match. */
export function matchesApp(appMatch: string | undefined, app: FocusedApp): boolean {
	if (!appMatch) {
		return false;
	}
	const haystack = `${app.name}\n${app.id}`.toLowerCase();
	return splitAppMatch(appMatch).some((entry) => haystack.includes(entry.toLowerCase()));
}

/** Strips a path or bundle to the app's plain name for loose comparisons. */
function appKey(value: string): string {
	const base = value.split(/[\\/]/).pop() ?? value;
	return base
		.replace(/\.(app|exe|lnk)$/i, '')
		.trim()
		.toLowerCase();
}

/** The apps the page's launch buttons open, folders included. */
function launchTargets(profile: Profile): string[] {
	const targets: string[] = [];
	const walk = (buttons: Button[]) => {
		for (const button of buttons) {
			for (const action of button.actions) {
				if (action.kind === 'launch' && action.target) {
					targets.push(action.target);
				}
			}
			if (button.folder) {
				walk(button.folder);
			}
		}
	};
	walk(profile.buttons);
	return targets;
}

/** A page follows an app through its explicit appMatch, or through the apps its buttons open. */
export function pageFollowsApp(profile: Profile, app: FocusedApp, mode: SmartPagesMode): boolean {
	if (matchesApp(profile.appMatch, app)) {
		return true;
	}
	if (mode === 'explicit') {
		return false;
	}
	const name = appKey(app.name);
	const id = app.id.toLowerCase();
	return launchTargets(profile).some((target) => {
		const key = appKey(target);
		// Single-letter keys would match far too much.
		return (
			key.length > 1 &&
			(key === name || name.includes(key) || key.includes(name) || id.endsWith(`.${key}`))
		);
	});
}

/** Pages with an explicit appMatch win over pages that only open the app. */
export function pageForApp(
	profiles: Profile[],
	app: FocusedApp,
	mode: SmartPagesMode,
): Profile | null {
	return (
		profiles.find((profile) => matchesApp(profile.appMatch, app)) ??
		profiles.find((profile) => pageFollowsApp(profile, app, mode)) ??
		null
	);
}
