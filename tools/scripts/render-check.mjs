// Loads the deck client in headless Chromium the way a phone does (plain http on a LAN IP)
// and reports JavaScript errors, so blank screens can be diagnosed without a device.
// Usage: node tools/scripts/render-check.mjs "http://<lan-ip>:48220/?token=<token>"
import { chromium } from '@playwright/test';

const url = process.argv[2];
if (!url) {
	console.error('usage: render-check.mjs <pairing-url>');
	process.exit(2);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
const errors = [];
page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push('console: ' + message.text());
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log('isSecureContext:', await page.evaluate(() => window.isSecureContext));
console.log('crypto.randomUUID:', await page.evaluate(() => typeof crypto.randomUUID));
console.log('keys rendered:', await page.locator('sd-deck-key').count());
console.log(
	'status:',
	(
		await page
			.locator('.bar__status')
			.textContent()
			.catch(() => 'n/a')
	)?.trim(),
);
console.log(
	'body text:',
	(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160),
);
console.log('errors:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
await browser.close();
