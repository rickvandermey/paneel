// Mirror of apps/host/internal/logs, as GET /api/logs returns it.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** One line of the host log. */
export interface LogEntry {
	time: string;
	level: LogLevel;
	source: 'host' | 'deck';
	message: string;
	fields?: string;
}

export interface LogsResponse {
	/** Versions and platform details, in display order, to paste above the lines. */
	header: { key: string; value: string }[];
	entries: LogEntry[];
}
