import { test, expect } from '@playwright/test';

test('order placement flow', async ({ page }) => {
  // Go to login page and log in (update selectors/credentials as needed)
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email').fill('testuser@example.com');
  await page.getByLabel('Password').fill('testpassword');
  await page.getByRole('button', { name: /log in|sign in/i }).click();

  // Wait for dashboard/orders page
  await expect(page.getByText(/dashboard|orders|welcome/i)).toBeVisible();

  // Go to order page (update selector as needed)
  await page.goto('http://localhost:3000/order');

  // Fill in order form (update selectors/fields as needed)
  await page.getByLabel(/product|item/i).fill('Test Product');
  await page.getByLabel(/quantity/i).fill('2');
  await page.getByRole('button', { name: /add to order|submit|place order/i }).click();

  // Assert order confirmation (update selector/text as needed)
  await expect(page.getByText(/order placed|success|thank you/i)).toBeVisible();
});
