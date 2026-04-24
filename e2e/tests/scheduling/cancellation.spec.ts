import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  createTestSession,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * Session Cancellation Tests
 *
 * These tests verify the complete session cancellation flow,
 * including UI interaction and database state changes.
 */

test.describe('Session Cancellation', () => {
  test('GM can cancel an upcoming session', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cancel-${Date.now()}@e2e.local`,
      name: 'Cancel GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Cancel Campaign',
      play_days: [5, 6],
    });

    // Create a confirmed session
    const playDates = getPlayDates([5, 6], 4);
    expect(playDates.length).toBeGreaterThan(0);

    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '18:00',
      end_time: '22:00',
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    // Verify session is in upcoming sessions
    await expect(page.getByText(/upcoming sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Find and click the Cancel button for the session (row-level cancel)
    const cancelButton = page.locator('[data-testid="scheduled-row"]').getByRole('button', { name: /^cancel$/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Confirm in the cancel modal
    await expect(page.locator('[data-testid="cancel-session-modal"]')).toBeVisible();
    await page.locator('[data-testid="cancel-session-submit"]').click();

    // Verify the session is removed - the "Upcoming Sessions" section should disappear
    // or at least the specific session should no longer be visible
    await expect(page.getByText(/upcoming sessions/i)).not.toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });

  test('cancelled session no longer appears in suggestions as confirmed', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cancel-badge-${Date.now()}@e2e.local`,
      name: 'Badge Cancel GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Badge Cancel Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 4);
    expect(playDates.length).toBeGreaterThan(0);

    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    // Verify schedule tab rendered
    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // There should be a scheduled row visible
    const scheduledRow = page.locator('[data-testid="scheduled-row"]').first();
    await expect(scheduledRow).toBeVisible();

    // Cancel the session (two-step: row button → modal confirm)
    const cancelButton = scheduledRow.getByRole('button', { name: /^cancel$/i });
    await cancelButton.click();

    await expect(page.locator('[data-testid="cancel-session-modal"]')).toBeVisible();
    await page.locator('[data-testid="cancel-session-submit"]').click();

    // After cancellation, the scheduled row should be gone and the date should now
    // appear as a ranked suggestion with a "Lock in this night" button for GM
    await expect(page.getByRole('button', { name: /lock in this night/i }).first()).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });

  test('player cannot cancel sessions', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-player-cancel-${Date.now()}@e2e.local`,
      name: 'Player Cancel GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-cancel-${Date.now()}@e2e.local`,
      name: 'Cancel Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Player Cancel Campaign',
      play_days: [5, 6],
    });

    // Add player to game using the centralized admin client
    const { getAdminClient } = await import('../../helpers/seed');
    const admin = getAdminClient();
    await admin.from('game_memberships').insert({
      game_id: game.id,
      user_id: player.id,
    });

    const playDates = getPlayDates([5, 6], 4);
    expect(playDates.length).toBeGreaterThan(0);

    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
    });

    // Login as player (not GM)
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    // Wait for sessions to load
    await expect(page.getByText(/upcoming sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Player should NOT see cancel button on scheduled rows
    const cancelButtons = page.locator('[data-testid="scheduled-row"]').getByRole('button', { name: /^cancel$/i });
    await expect(cancelButtons).toHaveCount(0);
  });

  test('multiple sessions can be cancelled individually', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-multi-cancel-${Date.now()}@e2e.local`,
      name: 'Multi Cancel GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Multi Cancel Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 8);
    expect(playDates.length).toBeGreaterThanOrEqual(2);

    // Create two sessions
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
    });
    await createTestSession({
      game_id: game.id,
      date: playDates[1],
      confirmed_by: gm.id,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Switch to schedule tab
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    // Verify we have 2 sessions (2 Cancel buttons on scheduled rows)
    await expect(page.getByText(/upcoming sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    const cancelButtons = page.locator('[data-testid="scheduled-row"]').getByRole('button', { name: /^cancel$/i });
    await expect(cancelButtons).toHaveCount(2);

    // Cancel the first one (two-step)
    await cancelButtons.first().click();
    await expect(page.locator('[data-testid="cancel-session-modal"]')).toBeVisible();
    await page.locator('[data-testid="cancel-session-submit"]').click();

    // Now should only have 1 session
    await expect(page.locator('[data-testid="scheduled-row"]').getByRole('button', { name: /^cancel$/i })).toHaveCount(1);

    // Cancel the second one (two-step)
    await page.locator('[data-testid="scheduled-row"]').getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.locator('[data-testid="cancel-session-modal"]')).toBeVisible();
    await page.locator('[data-testid="cancel-session-submit"]').click();

    // Now upcoming sessions section should be gone
    await expect(page.getByText(/upcoming sessions/i)).not.toBeVisible();
  });
});
