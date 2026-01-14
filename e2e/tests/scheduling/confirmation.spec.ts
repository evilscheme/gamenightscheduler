import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Session Confirmation', () => {
  test('GM can open confirmation modal', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-modal-${Date.now()}@e2e.local`,
      name: 'Modal GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Modal Campaign',
      play_days: [5, 6],
    });

    // Set availability so there's a suggestion to confirm
    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    // Wait for suggestions to load
    await expect(page.getByText(/date suggestions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click the first confirm button
    const confirmButton = page.getByRole('button', { name: /^confirm$/i }).first();
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Modal should appear with "Schedule Session" heading
    await expect(page.getByRole('heading', { name: /schedule session/i })).toBeVisible();

    // Should have start and end time inputs (use text to find the parent, then get the input)
    await expect(page.getByText('Start Time').locator('..').locator('input')).toBeVisible();
    await expect(page.getByText('End Time').locator('..').locator('input')).toBeVisible();

    // Should have confirm and cancel buttons in modal
    await expect(page.getByRole('button', { name: /confirm session/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('GM can set custom times and confirm session', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-times-${Date.now()}@e2e.local`,
      name: 'Times GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Times Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.getByText(/date suggestions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click confirm on first suggestion
    await page.getByRole('button', { name: /^confirm$/i }).first().click();

    // Wait for modal
    await expect(page.getByRole('heading', { name: /schedule session/i })).toBeVisible();

    // Set custom times: 7 PM to 11 PM
    const startTimeInput = page.getByText('Start Time').locator('..').locator('input');
    const endTimeInput = page.getByText('End Time').locator('..').locator('input');

    await startTimeInput.clear();
    await startTimeInput.fill('19:00');
    await endTimeInput.clear();
    await endTimeInput.fill('23:00');

    // Submit the confirmation
    await page.getByRole('button', { name: /confirm session/i }).click();

    // Modal should close
    await expect(page.getByRole('heading', { name: /schedule session/i })).not.toBeVisible();

    // Session should appear in confirmed sessions section
    await expect(page.getByText(/confirmed sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Verify the times are displayed (7:00 PM - 11:00 PM)
    await expect(page.getByText(/7:00 PM/)).toBeVisible();
    await expect(page.getByText(/11:00 PM/)).toBeVisible();
  });

  test('session appears in confirmed list after creation', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-list-${Date.now()}@e2e.local`,
      name: 'List GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'List Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.getByText(/date suggestions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Initially no confirmed sessions section (or empty)
    const confirmedSectionBefore = page.getByText(/confirmed sessions/i);
    const hasConfirmedBefore = await confirmedSectionBefore.count() > 0;

    // Confirm a session
    await page.getByRole('button', { name: /^confirm$/i }).first().click();
    await expect(page.getByRole('heading', { name: /schedule session/i })).toBeVisible();
    await page.getByRole('button', { name: /confirm session/i }).click();

    // Now confirmed sessions should be visible
    await expect(page.getByText(/confirmed sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Should show the dice emoji for confirmed sessions
    await expect(page.locator('text=🎲').first()).toBeVisible();

    // Should have export button
    await expect(page.getByRole('button', { name: /export/i }).first()).toBeVisible();
  });

  test('player cannot access confirm action', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-noaccess-${Date.now()}@e2e.local`,
      name: 'No Access GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-noaccess-${Date.now()}@e2e.local`,
      name: 'No Access Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'No Access Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);
    await setAvailability(player.id, game.id, [{ date: playDates[0], is_available: true }]);

    // Login as player (not GM)
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.getByText(/date suggestions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Player should see suggestions but no confirm buttons
    // The component shows "Ask your GM to confirm dates." for non-GM
    await expect(page.getByText(/ask your gm/i)).toBeVisible();

    // Confirm button should not be present for player
    const confirmButtons = page.getByRole('button', { name: /^confirm$/i });
    await expect(confirmButtons).toHaveCount(0);
  });
});
