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

    // Select Fridays from the day dropdown, status is already "available" by default
    const dayDropdown = page.locator('select').first();
    await dayDropdown.selectOption('5'); // Friday = 5

    // Click Apply button
    const applyButton = page.getByRole('button', { name: /apply/i });
    await applyButton.click();

    // Get upcoming Fridays to verify
    const fridays = getPlayDates([5], 4); // Next 4 weeks of Fridays

    // Wait for the first Friday to turn green (async operations need time)
    const firstFriday = page.locator(`button[title="${fridays[0]}"]`);
    await expect(firstFriday).toHaveClass(/bg-cal-available-bg/, { timeout: TEST_TIMEOUTS.DEFAULT });

    // Verify another Friday is also green
    if (fridays.length > 1) {
      const secondFriday = page.locator(`button[title="${fridays[1]}"]`);
      if (await secondFriday.count() > 0) {
        await expect(secondFriday).toHaveClass(/bg-cal-available-bg/);
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

    // Select Saturdays from the day dropdown
    const dayDropdown = page.locator('select').first();
    await dayDropdown.selectOption('6'); // Saturday = 6

    // Select "unavailable" from the status dropdown
    const statusDropdown = page.locator('select').nth(1);
    await statusDropdown.selectOption('unavailable');

    // Click Apply button
    const applyButton = page.getByRole('button', { name: /apply/i });
    await applyButton.click();

    // Get upcoming Saturdays to verify
    const saturdays = getPlayDates([6], 4); // Next 4 weeks of Saturdays

    // Wait for the first Saturday to turn red (async operations need time)
    const firstSaturday = page.locator(`button[title="${saturdays[0]}"]`);
    await expect(firstSaturday).toHaveClass(/bg-cal-unavailable-bg/, { timeout: TEST_TIMEOUTS.DEFAULT });

    // Verify another Saturday is also red
    if (saturdays.length > 1) {
      const secondSaturday = page.locator(`button[title="${saturdays[1]}"]`);
      if (await secondSaturday.count() > 0) {
        await expect(secondSaturday).toHaveClass(/bg-cal-unavailable-bg/);
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
    const dayDropdown = page.locator('select').first();
    await dayDropdown.selectOption('5'); // Friday = 5
    // Status is already "available" by default
    const applyButton = page.getByRole('button', { name: /apply/i });
    await applyButton.click();

    // Get first Friday to check
    const fridays = getPlayDates([5], 4);
    const firstFriday = fridays[0];

    // Verify it's green before reload (wait for async operation)
    const dateButton = page.locator(`button[title="${firstFriday}"]`);
    await expect(dateButton).toHaveClass(/bg-cal-available-bg/, { timeout: TEST_TIMEOUTS.DEFAULT });

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
    await expect(dateButtonAfterReload).toHaveClass(/bg-cal-available-bg/);
  });

  test('bulk mark remaining days only affects unset dates', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-bulk-remaining-${Date.now()}@e2e.local`,
      name: 'Bulk Remaining GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Bulk Remaining Campaign',
      play_days: [5, 6], // Friday, Saturday
      scheduling_window_months: 2,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // First, manually mark the first Friday as unavailable by clicking it
    const fridays = getPlayDates([5], 4);
    const firstFriday = page.locator(`button[title="${fridays[0]}"]`);
    await firstFriday.click(); // available
    await firstFriday.click(); // unavailable
    await expect(firstFriday).toHaveClass(/bg-cal-unavailable-bg/, { timeout: TEST_TIMEOUTS.DEFAULT });

    // Now use "remaining days" to mark all unset dates as available
    const dayDropdown = page.locator('select').first();
    await dayDropdown.selectOption('remaining');
    // Status is already "available" by default
    const applyButton = page.getByRole('button', { name: /apply/i });
    await applyButton.click();

    // The first Friday should still be red (unavailable) - not overwritten
    await expect(firstFriday).toHaveClass(/bg-cal-unavailable-bg/);

    // But other Fridays should be green (available)
    if (fridays.length > 1) {
      const secondFriday = page.locator(`button[title="${fridays[1]}"]`);
      if (await secondFriday.count() > 0) {
        await expect(secondFriday).toHaveClass(/bg-cal-available-bg/, { timeout: TEST_TIMEOUTS.DEFAULT });
      }
    }

    // Saturdays should also be green
    const saturdays = getPlayDates([6], 4);
    const firstSaturday = page.locator(`button[title="${saturdays[0]}"]`);
    if (await firstSaturday.count() > 0) {
      await expect(firstSaturday).toHaveClass(/bg-cal-available-bg/);
    }
  });

  test('bulk mark as maybe', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-bulk-maybe-${Date.now()}@e2e.local`,
      name: 'Bulk Maybe GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Bulk Maybe Campaign',
      play_days: [5], // Friday only
      scheduling_window_months: 2,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Select Fridays and set status to "maybe"
    const dayDropdown = page.locator('select').first();
    await dayDropdown.selectOption('5'); // Friday = 5

    const statusDropdown = page.locator('select').nth(1);
    await statusDropdown.selectOption('maybe');

    const applyButton = page.getByRole('button', { name: /apply/i });
    await applyButton.click();

    // Verify Fridays are yellow/warning (maybe)
    const fridays = getPlayDates([5], 4);
    const firstFriday = page.locator(`button[title="${fridays[0]}"]`);
    await expect(firstFriday).toHaveClass(/bg-cal-maybe-bg/, { timeout: TEST_TIMEOUTS.DEFAULT });
  });
});
