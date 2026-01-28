import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Time Availability Constraints', () => {
  test('can set available-after time via note popup', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-time-after-${Date.now()}@e2e.local`,
      name: 'Time After GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Time After Campaign',
      play_days: [5, 6],
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
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    const playDates = getPlayDates([5, 6], 2);
    const targetDate = playDates[0];

    const dateButton = page.locator(`button[title*="${targetDate}"]`);
    await expect(dateButton).toBeVisible();

    // Click to mark as available
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-cal-available-bg/);

    // Open note editor via pencil icon
    const editIcon = dateButton.locator('span:has-text("✏️")');
    await expect(editIcon).toBeVisible();
    await editIcon.click();

    // Time fields should be visible for "available" status
    await expect(page.getByText('Available after')).toBeVisible();
    await expect(page.getByText('Available until')).toBeVisible();

    // Set "available after" time
    const afterInput = page.getByText('Available after').locator('..').locator('select');
    await afterInput.selectOption('19:00');

    // Save
    await page.getByRole('button', { name: 'Save' }).click();

    // Clock icon should appear on the date cell
    await expect(dateButton.locator('span:has-text("🕐")')).toBeVisible();

    // Verify persistence after reload
    await page.reload();
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();

    const dateButtonAfterReload = page.locator(`button[title*="${targetDate}"]`);
    await expect(dateButtonAfterReload.locator('span:has-text("🕐")')).toBeVisible();

    // Open note editor again and verify the time is still there
    const editIconAfterReload = dateButtonAfterReload.locator('span:has-text("✏️"), span:has-text("💬")');
    await editIconAfterReload.first().click();

    const afterInputAfterReload = page.getByText('Available after').locator('..').locator('select');
    await expect(afterInputAfterReload).toHaveValue('19:00');
  });

  test('time fields are hidden for unavailable status', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-time-hidden-${Date.now()}@e2e.local`,
      name: 'Time Hidden GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Time Hidden Campaign',
      play_days: [5, 6],
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
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    const playDates = getPlayDates([5, 6], 2);
    const targetDate = playDates[0];

    const dateButton = page.locator(`button[title*="${targetDate}"]`);
    await expect(dateButton).toBeVisible();

    // Click twice: unset -> available -> unavailable
    await dateButton.click();
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-cal-unavailable-bg/);

    // Open note editor
    const editIcon = dateButton.locator('span:has-text("✏️")');
    await expect(editIcon).toBeVisible();
    await editIcon.click();

    // Time fields should NOT be visible for "unavailable" status
    await expect(page.getByText('Available after')).not.toBeVisible();
    await expect(page.getByText('Available until')).not.toBeVisible();

    // Note field should still be visible
    await expect(page.locator('input[placeholder*="Depends on work"]')).toBeVisible();
  });

  test('time constraints show in schedule suggestions', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-time-sched-${Date.now()}@e2e.local`,
      name: 'Time Schedule GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-time-sched-${Date.now()}@e2e.local`,
      name: 'Time Schedule Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Time Schedule Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    const playDates = getPlayDates([5, 6], 4);

    // Set availability with time constraints
    await setAvailability(gm.id, game.id, [
      { date: playDates[0], status: 'available', available_after: '19:00' },
    ]);
    await setAvailability(player.id, game.id, [
      { date: playDates[0], status: 'available', available_until: '22:00' },
    ]);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.getByText(/date suggestions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Should show time constraint information
    await expect(page.getByText(/earliest start/i).first()).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.getByText(/latest end/i).first()).toBeVisible();

    // Should show player time annotations
    await expect(page.getByText(/after 7pm/i).first()).toBeVisible();
    await expect(page.getByText(/until 10pm/i).first()).toBeVisible();
  });

  test('confirm modal pre-fills with constrained times', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-time-prefill-${Date.now()}@e2e.local`,
      name: 'Time Prefill GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Time Prefill Campaign',
      play_days: [5, 6],
      default_start_time: '18:00',
      default_end_time: '23:00',
    });

    const playDates = getPlayDates([5, 6], 4);

    // GM available after 19:00 (later than default 18:00)
    await setAvailability(gm.id, game.id, [
      { date: playDates[0], status: 'available', available_after: '19:00' },
    ]);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.getByText(/date suggestions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click confirm on the first suggestion
    await page.getByRole('button', { name: /^confirm$/i }).first().click();
    await expect(page.getByRole('heading', { name: /schedule session/i })).toBeVisible();

    // Start time should be pre-filled with 19:00 (later of default 18:00 and constraint 19:00)
    const startTimeInput = page.getByText('Start Time').locator('..').locator('input');
    await expect(startTimeInput).toHaveValue('19:00');

    // End time should stay at default 23:00 (no end constraint)
    const endTimeInput = page.getByText('End Time').locator('..').locator('input');
    await expect(endTimeInput).toHaveValue('23:00');
  });

  test('time constraints persist when cycling availability states', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-time-persist-${Date.now()}@e2e.local`,
      name: 'Time Persist GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Time Persist Campaign',
      play_days: [5, 6],
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
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    const playDates = getPlayDates([5, 6], 2);
    const targetDate = playDates[0];

    const dateButton = page.locator(`button[title*="${targetDate}"]`);
    await expect(dateButton).toBeVisible();

    // Mark as available and set time constraint
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-cal-available-bg/);

    const editIcon = dateButton.locator('span:has-text("✏️")');
    await editIcon.click();

    const afterInput = page.getByText('Available after').locator('..').locator('select');
    await afterInput.selectOption('20:00');
    await page.getByRole('button', { name: 'Save' }).click();

    // Clock icon visible
    await expect(dateButton.locator('span:has-text("🕐")')).toBeVisible();

    // Cycle to unavailable
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-cal-unavailable-bg/);

    // Cycle to maybe
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-cal-maybe-bg/);

    // Clock icon should still be visible on maybe
    await expect(dateButton.locator('span:has-text("🕐")')).toBeVisible();

    // Cycle back to available
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-cal-available-bg/);

    // Clock icon should persist
    await expect(dateButton.locator('span:has-text("🕐")')).toBeVisible();

    // Open note editor and verify time is still set
    const commentIcon = dateButton.locator('span:has-text("✏️"), span:has-text("💬")');
    await commentIcon.first().click();

    const afterInputCheck = page.getByText('Available after').locator('..').locator('select');
    await expect(afterInputCheck).toHaveValue('20:00');
  });
});
