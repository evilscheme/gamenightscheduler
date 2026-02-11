import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, setAvailability, getPlayDates } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Copy Availability From Another Game', () => {
  test('copies availability from source game to destination game', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `gm-copy-avail-${Date.now()}@e2e.local`,
      name: 'Copy Avail GM',
      is_gm: true,
    });

    // Create two games with the same play days (Friday)
    const gameA = await createTestGame({
      gm_id: user.id,
      name: 'Source Campaign',
      play_days: [5], // Friday
      scheduling_window_months: 2,
    });

    const gameB = await createTestGame({
      gm_id: user.id,
      name: 'Destination Campaign',
      play_days: [5], // Friday
      scheduling_window_months: 2,
    });

    // Set availability in Game A for upcoming Fridays
    const fridays = getPlayDates([5], 4);
    await setAvailability(
      user.id,
      gameA.id,
      fridays.slice(0, 3).map((date) => ({ date, status: 'available' as const }))
    );

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    // Navigate to Game B availability tab
    await page.goto(`/games/${gameB.id}`);
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Verify "Copy from" dropdown is visible and lists Game A
    const copySelect = page.locator('[data-testid="copy-game-select"]');
    await expect(copySelect).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });

    // Select Game A from dropdown
    await copySelect.selectOption({ label: 'Source Campaign' });

    // Click Copy
    const copyButton = page.locator('[data-testid="copy-game-button"]');
    await copyButton.click();

    // Verify result message appears
    const resultMessage = page.locator('[data-testid="copy-result-message"]');
    await expect(resultMessage).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await expect(resultMessage).toContainText(/copied \d+ date/i);

    // Verify calendar shows copied statuses
    const firstFriday = page.locator(`button[data-date="${fridays[0]}"]`);
    await expect(firstFriday).toHaveAttribute('data-status', 'available', {
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });

  test('does not overwrite existing availability', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `gm-copy-nooverwrite-${Date.now()}@e2e.local`,
      name: 'Copy NoOverwrite GM',
      is_gm: true,
    });

    const gameA = await createTestGame({
      gm_id: user.id,
      name: 'Source Game NW',
      play_days: [5], // Friday
      scheduling_window_months: 2,
    });

    const gameB = await createTestGame({
      gm_id: user.id,
      name: 'Dest Game NW',
      play_days: [5], // Friday
      scheduling_window_months: 2,
    });

    const fridays = getPlayDates([5], 4);

    // Set availability in Game A: all available
    await setAvailability(
      user.id,
      gameA.id,
      fridays.slice(0, 2).map((date) => ({ date, status: 'available' as const }))
    );

    // Pre-set first Friday in Game B as unavailable
    await setAvailability(user.id, gameB.id, [
      { date: fridays[0], status: 'unavailable' as const },
    ]);

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    await page.goto(`/games/${gameB.id}`);
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Verify the pre-set date shows unavailable before copy
    const presetDate = page.locator(`button[data-date="${fridays[0]}"]`);
    await expect(presetDate).toHaveAttribute('data-status', 'unavailable', {
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Copy from Game A
    const copySelect = page.locator('[data-testid="copy-game-select"]');
    await expect(copySelect).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await copySelect.selectOption({ label: 'Source Game NW' });
    await page.locator('[data-testid="copy-game-button"]').click();

    // Wait for result message
    const resultMessage = page.locator('[data-testid="copy-result-message"]');
    await expect(resultMessage).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });

    // First Friday should STILL be unavailable (not overwritten)
    await expect(presetDate).toHaveAttribute('data-status', 'unavailable');

    // Second Friday should now be available (copied)
    if (fridays.length > 1) {
      const secondFriday = page.locator(`button[data-date="${fridays[1]}"]`);
      if (await secondFriday.count() > 0) {
        await expect(secondFriday).toHaveAttribute('data-status', 'available', {
          timeout: TEST_TIMEOUTS.DEFAULT,
        });
      }
    }
  });

  test('shows "No new dates" when nothing to copy', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `gm-copy-empty-${Date.now()}@e2e.local`,
      name: 'Copy Empty GM',
      is_gm: true,
    });

    // Source game with no availability set
    await createTestGame({
      gm_id: user.id,
      name: 'Empty Source',
      play_days: [5],
      scheduling_window_months: 2,
    });

    const gameB = await createTestGame({
      gm_id: user.id,
      name: 'Empty Dest',
      play_days: [5],
      scheduling_window_months: 2,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: true,
    });

    await page.goto(`/games/${gameB.id}`);
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    const copySelect = page.locator('[data-testid="copy-game-select"]');
    await expect(copySelect).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await copySelect.selectOption({ label: 'Empty Source' });
    await page.locator('[data-testid="copy-game-button"]').click();

    const resultMessage = page.locator('[data-testid="copy-result-message"]');
    await expect(resultMessage).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await expect(resultMessage).toContainText(/no new dates to copy/i);
  });

  test('copy dropdown hidden when user has only one game', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `gm-copy-single-${Date.now()}@e2e.local`,
      name: 'Single Game GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: user.id,
      name: 'Only Game',
      play_days: [5],
      scheduling_window_months: 2,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
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

    // The copy dropdown should not be visible
    const copySelect = page.locator('[data-testid="copy-game-select"]');
    await expect(copySelect).not.toBeVisible();
  });
});
