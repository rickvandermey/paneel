import type { LogEntry, LogsResponse } from '@sd/protocol';

/** One log line the way the host writes it to its file. */
export function formatLogEntry(entry: LogEntry): string {
	const base = `${entry.time} ${entry.level.padEnd(5)} ${entry.source.padEnd(4)} ${entry.message}`;
	return entry.fields ? `${base} ${entry.fields}` : base;
}

/** The header (host, platform, versions) above the lines, as one text to paste into a bug report. */
export function logAsText(header: LogsResponse['header'], entries: LogEntry[]): string {
	const headerText = header.map((field) => `${field.key}: ${field.value}`).join('\n');
	const lines = entries.map(formatLogEntry).join('\n');
	return headerText ? `${headerText}\n\n${lines}\n` : `${lines}\n`;
}
