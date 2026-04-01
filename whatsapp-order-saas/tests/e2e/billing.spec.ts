import { test, expect } from '@playwright/test';

test('billing flow', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email').fill('testuser@example.com');
  await page.getByLabel('Password').fill('testpassword');
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page.getByText(/dashboard|orders|welcome/i)).toBeVisible();

  // Go to billing page
  await page.goto('http://localhost:3000/dashboard/billing');

  // Check for billing summary or plan info
  await expect(page.getByText(/plan|billing|subscription|upgrade/i)).toBeVisible();

  // (Optional) Try to upgrade/downgrade plan
  // await page.getByRole('button', { name: /upgrade|downgrade|change plan/i }).click();
  // await expect(page.getByText(/success|updated|thank you/i)).toBeVisible();
});
