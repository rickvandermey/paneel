import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HostClient } from '@sd/host-client';
import { LogEntry, LogsResponse } from '@sd/protocol';
import { copyToClipboard } from '../shared/clipboard';
import { errorMessage } from '../shared/error-message';
import { scrollToBottomOnChange } from '../shared/scroll-to-bottom';
import { logAsText } from './log-text';

type LevelFilter = 'all' | 'info' | 'warn';

/** The panel shows the newest lines only; the download has them all. */
const SHOWN_LINES = 300;

/** The host log with the deck's own lines merged in, ready to copy into a bug report. */
@Component({
	selector: 'sd-logs-panel',
	imports: [FormsModule],
	templateUrl: './logs-panel.html',
	styleUrl: './logs-panel.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsPanel {
	private readonly client = inject(HostClient);
	private readonly list = viewChild<ElementRef<HTMLElement>>('list');

	readonly verbose = input(false);
	readonly verboseChanged = output<boolean>();
	readonly notice = output<string>();

	/** The host's answer, or null when it could not be fetched. */
	readonly hostLog = signal<LogsResponse | null>(null);
	readonly failure = signal<string | null>(null);
	readonly levelFilter = signal<LevelFilter>('all');
	readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

	/** Host lines when the host answered, otherwise what this deck logged by itself. */
	readonly visibleEntries = computed<LogEntry[]>(() => {
		const all = this.hostLog()?.entries ?? this.client.logs();
		return all.filter((entry) => passesFilter(entry, this.levelFilter())).slice(-SHOWN_LINES);
	});

	readonly downloadUrl = computed(() => this.client.logsUrl());

	constructor() {
		void this.refresh();
		scrollToBottomOnChange(this.visibleEntries, this.list);
	}

	async refresh(): Promise<void> {
		try {
			this.hostLog.set(await this.client.fetchLogs());
			this.failure.set(null);
		} catch (cause) {
			this.failure.set(errorMessage(cause, 'Could not load the log from the host'));
		}
	}

	async copyLog(): Promise<void> {
		if (await copyToClipboard(this.logText())) {
			this.notice.emit('Copied the log');
		} else {
			this.notice.emit('Could not copy; use Download instead');
		}
	}

	async shareLog(): Promise<void> {
		try {
			await navigator.share({ title: 'Paneel log', text: this.logText() });
		} catch {
			// Cancelled by the user, or the browser refused; nothing to report.
		}
	}

	async clearLog(): Promise<void> {
		try {
			await this.client.clearLogs();
			await this.refresh();
			this.notice.emit('Log cleared');
		} catch (cause) {
			this.notice.emit(errorMessage(cause, 'Could not clear the log'));
		}
	}

	displayTime(entry: LogEntry): string {
		const date = new Date(entry.time);
		return Number.isNaN(date.getTime()) ? entry.time : date.toLocaleTimeString();
	}

	private logText(): string {
		return logAsText(this.hostLog()?.header ?? [], this.visibleEntries());
	}
}

function passesFilter(entry: LogEntry, filter: LevelFilter): boolean {
	switch (filter) {
		case 'warn':
			return entry.level === 'warn' || entry.level === 'error';
		case 'info':
			return entry.level !== 'debug';
		case 'all':
			return true;
	}
}
