import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	signal,
	untracked,
} from '@angular/core';
import { Shell } from '@sd/editor';
import { buildPairingUrl, HostClient, parsePairingUrl } from '@sd/host-client';
import { AssistantKeyForm } from './assistant-key-form/assistant-key-form';
import { HostStatusStore } from './host-status';

/** The desktop window: pairing details and the API key form beside the deck itself. */
@Component({
	selector: 'sd-root',
	imports: [Shell, AssistantKeyForm],
	templateUrl: './app.html',
	styleUrl: './app.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
	readonly hostStatus = inject(HostStatusStore);
	readonly client = inject(HostClient);
	readonly sidebarOpen = signal(true);

	constructor() {
		this.hostStatus.start();
		effect(() => this.connectToEmbeddedHost());
	}

	/** The desktop UI is its own deck client, talking to the embedded host over loopback. */
	private connectToEmbeddedHost(): void {
		const status = this.hostStatus.status();
		const firstPairingUrl = status?.pairingUrls?.[0];
		if (!status || !firstPairingUrl) {
			return;
		}
		const { token } = parsePairingUrl(firstPairingUrl);
		const loopbackUrl = buildPairingUrl(`http://127.0.0.1:${status.port}`, token);
		const connectedUrl = untracked(() => this.client.pairingUrl());
		if (connectedUrl !== loopbackUrl) {
			this.client.connect(loopbackUrl);
		}
	}
}
