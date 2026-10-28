import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import {
	CapacitorBarcodeScanner,
	CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';

/**
 * The one place that knows whether the deck runs as the Android app or as a web page served by
 * the host. Everything else asks these functions, so the same bundle works both ways.
 */

export function isNativeApp(): boolean {
	return Capacitor.isNativePlatform();
}

/** Keeps the screen on while the deck is in use; the web page uses the Screen Wake Lock API. */
export async function keepScreenAwake(): Promise<void> {
	try {
		if (isNativeApp()) {
			await KeepAwake.keepAwake();
		} else {
			await navigator.wakeLock?.request('screen');
		}
	} catch {
		// Not supported, or the page is not visible; the screen then dims as usual.
	}
}

/** Opens the camera and returns the text of the first QR code it sees, or null when cancelled. */
export async function scanQrCode(): Promise<string | null> {
	const result = await CapacitorBarcodeScanner.scanBarcode({
		hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
		scanInstructions: 'Point the camera at the QR code in the Paneel app on your computer',
	});
	return result.ScanResult || null;
}
