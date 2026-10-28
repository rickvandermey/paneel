import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app wraps the same deck bundle the host serves, so one build feeds both. The app
 * runs on the http scheme because the host on the LAN speaks plain http and ws: on the https
 * scheme the WebView treats the host's images as mixed content and blocks them, whatever the
 * mixed-content setting says. Secure-context APIs are not needed; the plugins cover them.
 */
const config: CapacitorConfig = {
	appId: 'app.paneel.deck',
	appName: 'Paneel',
	webDir: '../host/static/deck',
	server: {
		androidScheme: 'http',
	},
};

export default config;
