import { test, expect, type Locator } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  createTestSession,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * Scheduled rows are collapsed by default; the per-row Cancel and
 * Add-to-calendar actions live inside the expanded section. Tests must
 * expand the row before reaching those actions.
 */
async function expandScheduledRow(row: Locator) {
  const toggle = row.locator('button[aria-expanded="false"]').first();
  if (await toggle.count()) {
    await toggle.click();
  }
}

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

    // Expand the row to reveal the row-level Cancel button
    const row = page.locator('[data-testid="scheduled-row"]').first();
    await expandScheduledRow(row);
    const cancelButton = row.getByRole('button', { name: /^cancel$/i });
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

    // Expand and cancel the session (two-step: row button → modal confirm)
    await expandScheduledRow(scheduledRow);
    const cancelButton = scheduledRow.getByRole('button', { name: /^cancel$/i });
    await cancelButton.click();

    await expect(page.locator('[data-testid="cancel-session-modal"]')).toBeVisible();
    await page.locator('[data-testid="cancel-session-submit"]').click();

    // After cancellation, the scheduled row should be gone and the date should now
    // appear as a ranked suggestion with a "Schedule game" button for GM
    await expect(page.getByRole('button', { name: /schedule game/i }).first()).toBeVisible({
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

    // Player should NOT see cancel button on scheduled rows even when expanded
    const row = page.locator('[data-testid="scheduled-row"]').first();
    await expandScheduledRow(row);
    const cancelButtons = row.getByRole('button', { name: /^cancel$/i });
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

    // Verify we have 2 scheduled rows
    await expect(page.getByText(/upcoming sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(page.locator('[data-testid="scheduled-row"]')).toHaveCount(2);

    // Expand and cancel the first row (two-step)
    const firstRow = page.locator('[data-testid="scheduled-row"]').first();
    await expandScheduledRow(firstRow);
    await firstRow.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.locator('[data-testid="cancel-session-modal"]')).toBeVisible();
    await page.locator('[data-testid="cancel-session-submit"]').click();

    // Now should only have 1 scheduled row
    await expect(page.locator('[data-testid="scheduled-row"]')).toHaveCount(1);

    // Expand and cancel the remaining row (two-step)
    const remainingRow = page.locator('[data-testid="scheduled-row"]').first();
    await expandScheduledRow(remainingRow);
    await remainingRow.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.locator('[data-testid="cancel-session-modal"]')).toBeVisible();
    await page.locator('[data-testid="cancel-session-submit"]').click();

    // Now upcoming sessions section should be gone
    await expect(page.getByText(/upcoming sessions/i)).not.toBeVisible();
  });
});
