import { expect } from '@playwright/test';
import { When, Then } from './fixtures';
import { exact } from './helpers';

const MIN_BACKUP_BYTES = 100;

When('I choose the terminal {string}', async ({ page }, terminal: string) => {
	await page.locator('sd-settings-panel select[name="terminal"]').selectOption(terminal);
});

Then('the terminal should be {string}', async ({ page }, terminal: string) => {
	await expect(page.locator('sd-settings-panel select[name="terminal"]')).toHaveValue(terminal);
});

When('I choose the smart pages mode {string}', async ({ page }, mode: string) => {
	await page.locator('sd-settings-panel select[name="smartPages"]').selectOption(mode);
});

Then('the smart pages mode should be {string}', async ({ page }, mode: string) => {
	await expect(page.locator('sd-settings-panel select[name="smartPages"]')).toHaveValue(mode);
});

Then('the focused app should be known', async ({ page }) => {
	await expect(page.locator('sd-settings-panel .hint strong').first()).not.toHaveText(
		exact('unknown'),
	);
});

When('I download a backup', async ({ host, state }) => {
	state.backup = await host.downloadBackup();
	expect(state.backup.length).toBeGreaterThan(MIN_BACKUP_BYTES);
});

When('I restore the backup through the settings', async ({ page, state }) => {
	expect(state.backup).not.toBeNull();
	await page.locator('sd-settings-panel input[type="file"]').setInputFiles({
		name: 'backup.zip',
		mimeType: 'application/zip',
		buffer: state.backup ?? Buffer.alloc(0),
	});
});

Then('the backup link should point at the host', async ({ page }) => {
	await expect(page.locator('sd-settings-panel a[download]')).toHaveAttribute(
		'href',
		/\/api\/backup\?token=/,
	);
});
