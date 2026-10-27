import { expect } from '@playwright/test';
import { When, Then } from './fixtures';
import { buttonNamed, exact, openMenuEntry, sheetCloseButton } from './helpers';

When('I open the menu entry {string}', async ({ page }, entry: string) => {
	await openMenuEntry(page, entry);
	// The drawer closes once the entry took effect; panels render right after.
	await expect(page.locator('sd-menu')).toHaveCount(0);
});

When('I close the sheet', async ({ page }) => {
	await sheetCloseButton(page).click();
	await expect(page.locator('sd-sheet')).toHaveCount(0);
});

When('I click {string}', async ({ page }, text: string) => {
	await buttonNamed(page, text).click();
});

Then('I should see the button {string}', async ({ page }, text: string) => {
	await expect(buttonNamed(page, text)).toBeVisible();
});

Then('I should see the toast {string}', async ({ page }, text: string) => {
	await expect(page.locator('.toast')).toContainText(text);
});

When('I click the toast action {string}', async ({ page }, label: string) => {
	await page.locator('.toast__action', { hasText: exact(label) }).click();
});
