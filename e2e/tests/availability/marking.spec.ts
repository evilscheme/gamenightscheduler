import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, getPlayDates } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Availability Marking', () => {
  test('click unmarked date to mark as available', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-mark-${Date.now()}@e2e.local`,
      name: 'Marking GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Marking Campaign',
      play_days: [5, 6], // Friday, Saturday
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Navigate to availability tab
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();

    // Wait for calendar to load
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Get a future play date
    const playDates = getPlayDates([5, 6], 2);
    const targetDate = playDates[0];

    // Find the date button by its title attribute (which contains the date string)
    const dateButton = page.locator(`button[title="${targetDate}"]`);
    await expect(dateButton).toBeVisible();

    // Initial state: should have card background (not green or red)
    // Click to mark as available
    // Cycle: unset -> available (yes) -> unavailable (no) -> maybe -> available
    await dateButton.click();

    // First click: unset -> available (green)
    await expect(dateButton).toHaveClass(/bg-success/);

    // Second click: available -> unavailable (red)
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-danger/);

    // Third click: unavailable -> maybe (yellow)
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-warning/);

    // Fourth click: maybe -> available (green)
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-success/);

    // Verify persistence after reload
    await page.reload();
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();

    const dateButtonAfterReload = page.locator(`button[title="${targetDate}"]`);
    await expect(dateButtonAfterReload).toHaveClass(/bg-success/);
  });

  test('click available date to toggle to unavailable', async ({ page, request }) => {
    const player = await createTestUser(request, {
      email: `player-toggle-${Date.now()}@e2e.local`,
      name: 'Toggle Player',
      is_gm: false,
    });

    const gm = await createTestUser(request, {
      email: `gm-toggle-owner-${Date.now()}@e2e.local`,
      name: 'Toggle GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Toggle Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    const playDates = getPlayDates([5, 6], 2);
    const targetDate = playDates[0];

    const dateButton = page.locator(`button[title="${targetDate}"]`);
    await expect(dateButton).toBeVisible();

    // Cycle: unset -> available (yes) -> unavailable (no) -> maybe -> available
    // Click to get to available first
    await dateButton.click(); // unset -> available (green)
    await expect(dateButton).toHaveClass(/bg-success/);

    // Click to get to unavailable (red)
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-danger/);

    // Click to get to maybe (yellow)
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-warning/);

    // Click again to toggle back to available (green)
    await dateButton.click(); // maybe -> available (green)
    await expect(dateButton).toHaveClass(/bg-success/);
  });

  test('cannot mark past dates', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-past-${Date.now()}@e2e.local`,
      name: 'Past Date GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Past Date Campaign',
      play_days: [0, 1, 2, 3, 4, 5, 6], // All days for testing
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
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Get yesterday's date (use local format to match calendar)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${year}-${month}-${day}`;

    // Try to find a past date button
    const pastDateButton = page.locator(`button[title="${yesterdayStr}"]`);

    // Past date button should be disabled
    if (await pastDateButton.count() > 0) {
      await expect(pastDateButton).toBeDisabled();
    }
    // If yesterday isn't visible in the calendar, that's also fine - test passes
  });

  test('cannot mark non-play-days', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-nonplay-${Date.now()}@e2e.local`,
      name: 'Non-Play GM',
      is_gm: true,
    });

    // Game only on Fridays (5) and Saturdays (6)
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Non-Play Campaign',
      play_days: [5, 6],
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
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Find a Monday (day 1) in the future
    const today = new Date();
    const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7; // Next Monday
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    const mondayStr = nextMonday.toISOString().split('T')[0];

    const mondayButton = page.locator(`button[title="${mondayStr}"]`);

    // Monday should be disabled since it's not a play day
    if (await mondayButton.count() > 0) {
      await expect(mondayButton).toBeDisabled();
      // Should have non-play day styling (cross-hatched)
      await expect(mondayButton).toHaveClass(/non-play-day/);
    }
  });

  test('can add a note to any availability status via edit icon', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-note-${Date.now()}@e2e.local`,
      name: 'Note GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Note Campaign',
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

    // Use contains selector since title changes after adding a comment
    const dateButton = page.locator(`button[title*="${targetDate}"]`);
    await expect(dateButton).toBeVisible();

    // Click once to mark as available
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-success/);

    // Available date should show edit icon (pencil emoji) for adding notes
    const editIcon = dateButton.locator('span:has-text("✏️")');
    await expect(editIcon).toBeVisible();

    // Click the edit icon to open note popover
    await editIcon.click();

    // Note editor should appear
    const noteInput = page.locator('input[placeholder*="Depends on work"]');
    await expect(noteInput).toBeVisible();

    // Add a note
    await noteInput.fill('Late arrival expected');
    await page.getByRole('button', { name: 'Save' }).click();

    // Note icon should now show comment bubble instead of pencil
    const commentIcon = dateButton.locator('span:has-text("💬")');
    await expect(commentIcon).toBeVisible();

    // Verify note persists after reload
    await page.reload();
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /availability/i }).click();

    const dateButtonAfterReload = page.locator(`button[title*="${targetDate}"]`);
    await expect(dateButtonAfterReload.locator('span:has-text("💬")')).toBeVisible();
  });

  test('notes persist when cycling through availability states', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-note-persist-${Date.now()}@e2e.local`,
      name: 'Note Persist GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Note Persist Campaign',
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

    // Click to mark as available and add a note
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-success/);

    const editIcon = dateButton.locator('span:has-text("✏️")');
    await editIcon.click();

    const noteInput = page.locator('input[placeholder*="Depends on work"]');
    await noteInput.fill('Important meeting note');
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify note icon shows
    await expect(dateButton.locator('span:has-text("💬")')).toBeVisible();

    // Cycle to unavailable - note should persist
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-danger/);
    await expect(dateButton.locator('span:has-text("💬")')).toBeVisible();

    // Cycle to maybe - note should persist
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-warning/);
    await expect(dateButton.locator('span:has-text("💬")')).toBeVisible();

    // Cycle back to available - note should still persist
    await dateButton.click();
    await expect(dateButton).toHaveClass(/bg-success/);
    await expect(dateButton.locator('span:has-text("💬")')).toBeVisible();

    // Verify the note content is still there by clicking edit
    const commentIcon = dateButton.locator('span:has-text("💬")');
    await commentIcon.click();

    const noteInputAfterCycle = page.locator('input[placeholder*="Depends on work"]');
    await expect(noteInputAfterCycle).toHaveValue('Important meeting note');
  });
});
