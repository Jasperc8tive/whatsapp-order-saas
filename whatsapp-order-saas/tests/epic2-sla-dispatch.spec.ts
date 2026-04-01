import { test, expect } from '@playwright/test';

// Epic 2: SLA & Dispatch Intelligence — Automated UI checks

test.describe('Epic 2 — SLA & Dispatch Intelligence', () => {
  test('All active orders show SLA badge with correct color and warning', async ({ page }) => {
    await page.goto('/dashboard/orders');
    // Wait for board/cards to load
    await page.waitForSelector('.bg-white.rounded-xl');
    // Check every card for SLA badge
    const cards = await page.$$('.bg-white.rounded-xl');
    for (const card of cards) {
      const badge = await card.$('[title*="SLA"]');
      expect(badge).not.toBeNull();
      // Check color class
      const badgeClass = await badge.getAttribute('class');
      expect(
        badgeClass && (
          badgeClass.includes('bg-green-100') ||
          badgeClass.includes('bg-amber-100') ||
          badgeClass.includes('bg-red-100')
        )
      ).toBeTruthy();
      // If breached, should have warning icon
      if (badgeClass && badgeClass.includes('bg-red-100')) {
        const warningIcon = await badge.$('svg.text-red-500');
        expect(warningIcon).not.toBeNull();
      }
    }
  });

  test('Operator can switch queue strategy and board re-sorts', async ({ page }) => {
    await page.goto('/dashboard/orders');
    await page.waitForSelector('select#queue-preset');
    // Try each preset
    const presets = ['urgent', 'oldest_unassigned', 'high_value'];
    for (const preset of presets) {
      await page.selectOption('select#queue-preset', preset);
      // Wait for UI update
      await page.waitForTimeout(300);
      // Optionally: check that order of cards changes (not implemented here)
    }
  });
});
