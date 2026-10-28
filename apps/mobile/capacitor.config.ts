import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app wraps the same deck bundle the host serves, so one build feeds both. The
 * host speaks plain http and ws on the LAN while the app's own origin is https://localhost;
 * allowMixedContent lets the WebView talk to it without TLS on the host.
 */
const config: CapacitorConfig = {
	appId: 'app.paneel.deck',
	appName: 'Paneel',
	webDir: '../host/static/deck',
	android: {
		allowMixedContent: true,
	},
};

export default config;
