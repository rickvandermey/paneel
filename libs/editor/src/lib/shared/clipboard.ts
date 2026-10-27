/**
 * Copies text, falling back to a hidden textarea and the old copy command for browsers that
 * block the async clipboard API outside a secure context (the deck runs on plain http).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return copyWithTextarea(text);
	}
}

function copyWithTextarea(text: string): boolean {
	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.opacity = '0';
	document.body.appendChild(area);
	area.select();
	let copied = false;
	try {
		copied = document.execCommand('copy');
	} finally {
		area.remove();
	}
	return copied;
}
