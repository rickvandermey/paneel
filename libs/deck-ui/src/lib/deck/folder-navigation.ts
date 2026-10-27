import type { Button } from '@sd/protocol';

/**
 * The buttons shown for a path of opened folders: the root list when the path is empty, else
 * the contents of the innermost folder. A folder that disappeared (deleted on another deck)
 * falls back to the root.
 */
export function buttonsAtPath(root: Button[], folderPath: string[]): Button[] {
	let list = root;
	for (const folderId of folderPath) {
		const folder = list.find((button) => button.id === folderId);
		if (!folder) {
			return root;
		}
		list = folder.folder ?? [];
	}
	return list;
}
