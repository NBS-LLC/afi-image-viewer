import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('./'); // Use relative path, baseURL will be prepended

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Apache Index Image Viewer/);
});
