export interface Logo {
	title: string;
	slug: string;
	/** Brand color as six hex digits without the hash. */
	hex: string;
}

/** The generated list stores each logo as a tuple to keep the file small. */
export type LogoEntry = readonly [title: string, slug: string, hex: string];

const MAX_LOGO_RESULTS = 60;

/** Logos whose title starts with the query come first, then those that merely contain it. */
export function searchLogos(logos: readonly LogoEntry[], query: string): Logo[] {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return [];
	}
	const startsWith: Logo[] = [];
	const contains: Logo[] = [];
	for (const [title, slug, hex] of logos) {
		const lowerTitle = title.toLowerCase();
		if (lowerTitle.startsWith(needle)) {
			startsWith.push({ title, slug, hex });
		} else if (lowerTitle.includes(needle) || slug.includes(needle)) {
			contains.push({ title, slug, hex });
		}
	}
	return [...startsWith, ...contains].slice(0, MAX_LOGO_RESULTS);
}
