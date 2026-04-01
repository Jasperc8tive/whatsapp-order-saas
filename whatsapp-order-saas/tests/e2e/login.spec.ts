import { test, expect } from '@playwright/test';

// Update selectors and credentials as needed for your app

test('login flow', async ({ page }) => {
  await page.goto('http://localhost:3000/login');

  // Fill in login form (update selectors as needed)
  await page.getByLabel('Email').fill('testuser@example.com');
  await page.getByLabel('Password').fill('testpassword');
  await page.getByRole('button', { name: /log in|sign in/i }).click();

  // Assert successful login (update selector/text as needed)
  await expect(page.getByText(/dashboard|orders|welcome/i)).toBeVisible();
});
