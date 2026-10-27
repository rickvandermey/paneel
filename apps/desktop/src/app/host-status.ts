import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HostService, HostStatus } from '../bindings/github.com/paneel-nx/paneel/host';
import { Status as AssistantStatus } from '../bindings/github.com/paneel-nx/paneel/host/internal/assistant';

const POLL_INTERVAL_MS = 2000;

/** Polls the Go host through the Wails bindings; degrades to "unreachable" when opened in a plain browser. */
@Injectable({ providedIn: 'root' })
export class HostStatusStore {
	readonly status = signal<HostStatus | null>(null);
	readonly hostReachable = signal(true);
	readonly assistantStatus = signal<AssistantStatus | null>(null);

	private readonly destroyRef = inject(DestroyRef);

	start(): void {
		void this.refresh();
		const timer = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
		this.destroyRef.onDestroy(() => clearInterval(timer));
	}

	/** Keys stay on this computer: the window hands them to the host through the binding only. */
	async setAssistantKey(provider: string, key: string): Promise<void> {
		await HostService.SetAssistantKey(provider, key);
		await this.refresh();
	}

	private async refresh(): Promise<void> {
		try {
			this.status.set(await HostService.Status());
			this.assistantStatus.set(await HostService.AssistantStatus());
			this.hostReachable.set(true);
		} catch {
			this.hostReachable.set(false);
		}
	}
}
