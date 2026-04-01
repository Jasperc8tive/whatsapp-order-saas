import { test, expect } from '@playwright/test';

test('team management flow', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email').fill('testuser@example.com');
  await page.getByLabel('Password').fill('testpassword');
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page.getByText(/dashboard|orders|welcome/i)).toBeVisible();

  // Go to team management page
  await page.goto('http://localhost:3000/dashboard/team');

  // Check for team list or invite button
  await expect(page.getByText(/team|invite|member|owner|staff/i)).toBeVisible();

  // (Optional) Invite a new member
  // await page.getByRole('button', { name: /invite|add member/i }).click();
  // await page.getByLabel(/email/i).fill('newmember@example.com');
  // await page.getByRole('button', { name: /send invite/i }).click();
  // await expect(page.getByText(/invited|success|pending/i)).toBeVisible();
});
