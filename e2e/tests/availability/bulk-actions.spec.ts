import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, getPlayDates } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Bulk Availability Actions', () => {
  test('bulk mark all Fridays as available', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-bulk-fri-${Date.now()}@e2e.local`,
      name: 'Bulk Friday GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Bulk Friday Campaign',
      play_days: [5, 6], // Friday, Saturday
      scheduling_window_months: 2,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click "All Fridays ✓" button
    const allFridaysButton = page.getByRole('button', { name: /all fridays/i });
    await expect(allFridaysButton).toBeVisible();
    await allFridaysButton.click();

    // Get upcoming Fridays to verify
    const fridays = getPlayDates([5], 4); // Next 4 weeks of Fridays

    // Wait for the first Friday to turn green (async operations need time)
    const firstFriday = page.locator(`button[title="${fridays[0]}"]`);
    await expect(firstFriday).toHaveClass(/bg-green/, { timeout: TEST_TIMEOUTS.DEFAULT });

    // Verify another Friday is also green
    if (fridays.length > 1) {
      const secondFriday = page.locator(`button[title="${fridays[1]}"]`);
      if (await secondFriday.count() > 0) {
        await expect(secondFriday).toHaveClass(/bg-green/);
      }
    }
  });

  test('bulk mark all Saturdays as unavailable', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-bulk-sat-${Date.now()}@e2e.local`,
      name: 'Bulk Saturday GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Bulk Saturday Campaign',
      play_days: [5, 6], // Friday, Saturday
      scheduling_window_months: 2,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click the ✗ button next to "All Saturdays ✓"
    // The button is adjacent to the "All Saturdays ✓" button
    // Find the Saturday button first, then click the next sibling ✗ button
    const allSaturdaysButton = page.getByRole('button', { name: /all saturdays/i });
    await expect(allSaturdaysButton).toBeVisible();

    // The ✗ button is the sibling immediately after the "All Saturdays ✓" button
    // Click on the parent div's second button
    const saturdayButtonParent = allSaturdaysButton.locator('..');
    const unavailableButton = saturdayButtonParent.getByRole('button', { name: '✗' });
    await unavailableButton.click();

    // Get upcoming Saturdays to verify
    const saturdays = getPlayDates([6], 4); // Next 4 weeks of Saturdays

    // Wait for the first Saturday to turn red (async operations need time)
    const firstSaturday = page.locator(`button[title="${saturdays[0]}"]`);
    await expect(firstSaturday).toHaveClass(/bg-red/, { timeout: TEST_TIMEOUTS.DEFAULT });

    // Verify another Saturday is also red
    if (saturdays.length > 1) {
      const secondSaturday = page.locator(`button[title="${saturdays[1]}"]`);
      if (await secondSaturday.count() > 0) {
        await expect(secondSaturday).toHaveClass(/bg-red/);
      }
    }
  });

  test('bulk action persists after page reload', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-bulk-persist-${Date.now()}@e2e.local`,
      name: 'Bulk Persist GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Bulk Persist Campaign',
      play_days: [5, 6],
      scheduling_window_months: 2,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Mark all Fridays as available
    const allFridaysButton = page.getByRole('button', { name: /all fridays/i });
    await allFridaysButton.click();

    // Get first Friday to check
    const fridays = getPlayDates([5], 4);
    const firstFriday = fridays[0];

    // Verify it's green before reload (wait for async operation)
    const dateButton = page.locator(`button[title="${firstFriday}"]`);
    await expect(dateButton).toHaveClass(/bg-green/, { timeout: TEST_TIMEOUTS.DEFAULT });

    // Reload the page
    await page.reload();

    // Navigate back to availability tab
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Verify the Friday is still green after reload
    const dateButtonAfterReload = page.locator(`button[title="${firstFriday}"]`);
    await expect(dateButtonAfterReload).toHaveClass(/bg-green/);
  });
});
