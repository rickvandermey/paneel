export interface Group<T> {
	name: string;
	items: T[];
}

/** Groups items under the name the key function gives them, keeping first-seen order. */
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Group<T>[] {
	const groups: Group<T>[] = [];
	for (const item of items) {
		const name = keyOf(item);
		let group = groups.find((entry) => entry.name === name);
		if (!group) {
			group = { name, items: [] };
			groups.push(group);
		}
		group.items.push(item);
	}
	return groups;
}
