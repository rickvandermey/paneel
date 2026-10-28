import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	signal,
	untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Shell } from '@sd/editor';
import { HostClient } from '@sd/host-client';
import { isNativeApp, keepScreenAwake, scanQrCode } from './device';
import {
	clearSavedPairingUrl,
	readSavedPairingUrl,
	savePairingUrl,
	takeTokenFromAddressBar,
} from './pairing-storage';

/** The host restarts on its new port shortly after a network change; following it earlier would fail. */
const FOLLOW_HOST_DELAY_MS = 1500;

/** The deck on the phone: the shell once paired, otherwise the pairing screen. */
@Component({
	selector: 'sd-root',
	imports: [Shell, FormsModule],
	templateUrl: './app.html',
	styleUrl: './app.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
	readonly client = inject(HostClient);
	/** What the pairing screen shows and edits; the client's own pairingUrl is the connected one. */
	readonly enteredPairingUrl = signal(takeTokenFromAddressBar() ?? readSavedPairingUrl());
	/** The Android app can scan the QR code itself; a browser tab opens the link from the camera app. */
	readonly canScan = isNativeApp();
	readonly scanError = signal('');

	private loadedDeckBuild: string | null = null;

	constructor() {
		const url = this.enteredPairingUrl();
		if (url) {
			this.client.connect(url);
		}
		effect(() => this.reloadWhenDeckBuildChanges());
		effect(() => this.keepScreenAwakeWhileConnected());
		effect(() => this.rememberNewPairingUrl());
	}

	connect(): void {
		const url = this.enteredPairingUrl().trim();
		if (!url) {
			return;
		}
		savePairingUrl(url);
		this.client.connect(url);
	}

	async scanAndConnect(): Promise<void> {
		this.scanError.set('');
		try {
			const scanned = await scanQrCode();
			if (!scanned) {
				return;
			}
			this.enteredPairingUrl.set(scanned);
			this.connect();
		} catch {
			this.scanError.set('Could not open the camera. Paste the pairing URL instead.');
		}
	}

	forgetComputer(): void {
		clearSavedPairingUrl();
		this.enteredPairingUrl.set('');
		this.client.disconnect();
	}

	/**
	 * The host serves this page; after a host upgrade the open tab would keep running old code.
	 * The Android app carries its own bundle, so there is nothing to reload there.
	 */
	private reloadWhenDeckBuildChanges(): void {
		const build = this.client.hostInfo()?.deckBuild;
		if (!build || isNativeApp()) {
			return;
		}
		if (this.loadedDeckBuild === null) {
			this.loadedDeckBuild = build;
		} else if (this.loadedDeckBuild !== build) {
			this.client.log('info', 'deck build changed, reloading', `build=${build}`);
			location.reload();
		}
	}

	private keepScreenAwakeWhileConnected(): void {
		if (this.client.status() === 'connected') {
			void keepScreenAwake();
		}
	}

	/**
	 * A port or token change from the editor yields a new pairing URL that must survive reloads.
	 * Only the client's URL is tracked: typing on the pairing screen must not be overwritten.
	 */
	private rememberNewPairingUrl(): void {
		const url = this.client.pairingUrl();
		if (!url || url === untracked(() => this.enteredPairingUrl())) {
			return;
		}
		this.enteredPairingUrl.set(url);
		savePairingUrl(url);
		// When the deck is served by the host itself, the page must follow the host to its new port.
		const newHostUrl = new URL(url);
		if (newHostUrl.hostname === location.hostname && newHostUrl.port !== location.port) {
			setTimeout(() => location.assign(url), FOLLOW_HOST_DELAY_MS);
		}
	}
}
