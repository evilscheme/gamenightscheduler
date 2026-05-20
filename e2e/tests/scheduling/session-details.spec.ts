import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  createTestSession,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Session Location & Notes', () => {
  test('GM can schedule a session with location and notes', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-sd-create-${Date.now()}@e2e.local`,
      name: 'Details GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Details Campaign',
      play_days: [5, 6],
    });
    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await page.getByRole('button', { name: /schedule/i }).click();
    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });

    await page.getByRole('button', { name: /schedule game/i }).first().click();
    await expect(page.locator('[data-testid="session-details-modal"]')).toBeVisible();

    await page.locator('[data-testid="session-details-location"]').fill("Tom's basement");
    await page.locator('[data-testid="session-details-notes"]').fill('Bring printed character sheets and dice.');
    await page.locator('[data-testid="session-details-submit"]').click();

    await expect(page.locator('[data-testid="session-details-modal"]')).not.toBeVisible();

    // Expand the scheduled row to see details
    const scheduledRow = page.locator('[data-testid="scheduled-row"]').first();
    await scheduledRow.getByRole('button', { name: /show session details/i }).click();

    await expect(scheduledRow).toContainText("Tom's basement");
    await expect(scheduledRow).toContainText('Bring printed character sheets and dice.');
  });

  test('GM can edit an existing session location and notes', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-sd-edit-${Date.now()}@e2e.local`,
      name: 'Edit GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Edit Campaign',
      play_days: [5, 6],
    });
    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '22:00',
      location: 'Old place',
      notes: 'old notes',
    });

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);
    await page.getByRole('button', { name: /schedule/i }).click();
    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });

    const scheduledRow = page.locator('[data-testid="scheduled-row"]').first();
    await scheduledRow.getByRole('button', { name: /show session details/i }).click();
    await page.locator('[data-testid="session-edit-details"]').click();
    await expect(page.locator('[data-testid="session-details-modal"]')).toBeVisible();

    const locationInput = page.locator('[data-testid="session-details-location"]');
    await locationInput.fill('New place, 999 Main St');
    await page.locator('[data-testid="session-details-submit"]').click();

    await expect(page.locator('[data-testid="session-details-modal"]')).not.toBeVisible();
    await expect(scheduledRow).toContainText('New place, 999 Main St');
  });

  test('Location and notes appear on the Overview tab UpcomingSessionsCard', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-sd-overview-${Date.now()}@e2e.local`,
      name: 'Overview GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Overview Campaign',
      play_days: [5, 6],
    });
    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '22:00',
      location: "Tom's basement",
      notes: 'Bring snacks',
    });

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);

    const upcomingCard = page.locator('text=/upcoming sessions/i').first();
    await expect(upcomingCard).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });

    const overviewRegion = page.locator('main');
    await expect(overviewRegion).toContainText("Tom's basement");
    await expect(overviewRegion).toContainText('Bring snacks');
  });

  test('Non-GM player sees details but not Edit button', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-sd-perm-${Date.now()}@e2e.local`,
      name: 'Perm GM',
      is_gm: true,
    });
    const player = await createTestUser(request, {
      email: `player-sd-perm-${Date.now()}@e2e.local`,
      name: 'Perm Player',
      is_gm: false,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Perm Campaign',
      play_days: [5, 6],
    });
    await addPlayerToGame(game.id, player.id);
    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '22:00',
      location: "Tom's basement",
      notes: 'Bring snacks',
    });

    await loginTestUser(page, { email: player.email, name: player.name, is_gm: false });
    await page.goto(`/games/${game.id}`);
    await page.getByRole('button', { name: /schedule/i }).click();
    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });

    const scheduledRow = page.locator('[data-testid="scheduled-row"]').first();
    await scheduledRow.getByRole('button', { name: /show session details/i }).click();

    await expect(scheduledRow).toContainText("Tom's basement");
    await expect(scheduledRow).toContainText('Bring snacks');
    await expect(page.locator('[data-testid="session-edit-details"]')).toHaveCount(0);
  });

  test('Char limit prevents oversized location and notes', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-sd-limits-${Date.now()}@e2e.local`,
      name: 'Limits GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Limits Campaign',
      play_days: [5, 6],
    });
    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);
    await page.getByRole('button', { name: /schedule/i }).click();
    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await page.getByRole('button', { name: /schedule game/i }).first().click();
    await expect(page.locator('[data-testid="session-details-modal"]')).toBeVisible();

    const tooLong = 'x'.repeat(250);
    await page.locator('[data-testid="session-details-location"]').fill(tooLong);
    const locValue = await page.locator('[data-testid="session-details-location"]').inputValue();
    expect(locValue.length).toBe(200);

    const tooLongNotes = 'y'.repeat(600);
    await page.locator('[data-testid="session-details-notes"]').fill(tooLongNotes);
    const notesValue = await page.locator('[data-testid="session-details-notes"]').inputValue();
    expect(notesValue.length).toBe(500);
  });

  test('Mobile: long notes clamp to 2 lines with Show more toggle', async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const gm = await createTestUser(request, {
      email: `gm-sd-mobile-${Date.now()}@e2e.local`,
      name: 'Mobile GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Mobile Campaign',
      play_days: [5, 6],
    });
    const playDates = getPlayDates([5, 6], 4);
    const longNote =
      'Bring printed character sheets and dice. We are picking up after the windmill fight ' +
      'from last session — Sarah is trying a new feat. Brendan said he will bring pizza. ' +
      'Carpool meets at the diner at 6:45 PM.';
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '22:00',
      notes: longNote,
    });

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);
    await page.getByRole('button', { name: /schedule/i }).click();
    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });

    const scheduledRow = page.locator('[data-testid="scheduled-row"]').first();
    await scheduledRow.getByRole('button', { name: /show session details/i }).click();

    const toggle = page.locator('[data-testid="session-notes-toggle"]').first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText(/show more/i);

    await toggle.click();
    await expect(toggle).toHaveText(/show less/i);
  });

  test('Calendar subscribe feed includes LOCATION and DESCRIPTION for sessions with details', async ({ request }) => {
    const gm = await createTestUser(request, {
      email: `gm-sd-feed-${Date.now()}@e2e.local`,
      name: 'Feed GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Feed Campaign',
      description: 'Curse of Strahd campaign',
      play_days: [5, 6],
    });
    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '22:00',
      location: "Tom's basement",
      notes: 'Bring dice',
    });

    const response = await request.get(`/api/games/calendar/${game.invite_code}`);
    expect(response.status()).toBe(200);
    const ics = await response.text();

    expect(ics).toContain("LOCATION:Tom's basement");
    // composeIcsDescription joins with \n\n; escapeICS replaces each \n → \\n, so \n\n → \\n\\n
    expect(ics).toContain('DESCRIPTION:Curse of Strahd campaign\\n\\nBring dice');
  });
});
