import { test, expect } from '@playwright/test';

// This test assumes you have a test vendor and a way to login or use the API directly.
// It will add a customer via the UI, then check if it appears in the customer list.
// Adjust selectors and flow to match your app's UI.

test('Supabase DB is updated via app UI', async ({ page }) => {
  // 1. Go to the login page and log in (replace with your actual login flow)
  await page.goto('/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // 2. Go to the customers page
  await page.goto('/dashboard/customers');

  // 3. Add a new customer
  const testPhone = `+234000${Date.now()}`;
  await page.click('button[data-testid="add-customer"]');
  await page.fill('input[name="name"]', 'Test Automation');
  await page.fill('input[name="phone"]', testPhone);
  await page.fill('input[name="email"]', 'test-automation@example.com');
  await page.fill('input[name="address"]', 'Automation Lane');
  await page.click('button[type="submit"]');

  // 4. Check that the customer appears in the list
  await expect(page.locator(`text=${testPhone}`)).toBeVisible({ timeout: 10000 });

  // 5. (Optional) Clean up: delete the test customer if your UI supports it
  // await page.click(`button[data-testid="delete-customer-${testPhone}"]`);
});
