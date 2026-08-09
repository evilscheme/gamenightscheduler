import { test, expect } from '@playwright/test';
import { format, parseISO } from 'date-fns';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  getPlayDates,
  createTestSession,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Schedule Tab Redesign', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // Test 1: GM can expand a row and lock in a session
  // ────────────────────────────────────────────────────────────────────────────
  test('GM can expand a ranked row and lock in a session', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-redesign-lock-${Date.now()}@e2e.local`,
      name: 'Redesign Lock GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Redesign Lock Campaign',
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

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // The ranked list should be visible
    await expect(page.locator('[data-testid="ranked-list"]')).toBeVisible();

    // Rank #1 row auto-expands and shows the Schedule game button
    const scheduleButton = page.getByRole('button', { name: /schedule game/i }).first();
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();

    // Confirm the session via the modal
    await expect(page.locator('[data-testid="session-details-modal"]')).toBeVisible();
    await page.locator('[data-testid="session-details-submit"]').click();

    // Toast should appear
    await expect(page.getByRole('status')).toContainText(/scheduled/i, {
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Upcoming sessions list should be visible after confirming
    await expect(page.locator('[data-testid="upcoming-sessions-list"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // The confirmed session's date should appear in the list. The row uses the
    // abbreviated 'EEE, MMM d' format (year omitted when same as current year).
    const sessionDate = parseISO(playDates[0]);
    const sameYear = sessionDate.getFullYear() === new Date().getFullYear();
    const expectedDateText = sameYear
      ? format(sessionDate, 'EEE, MMM d')
      : format(sessionDate, 'EEE, MMM d, yyyy');
    await expect(page.locator('[data-testid="upcoming-sessions-list"]')).toContainText(expectedDateText);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 2: Hovering a calendar cell highlights the matching ranked row
  // ────────────────────────────────────────────────────────────────────────────
  test('hovering a calendar cell highlights the matching ranked row', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-redesign-hover-${Date.now()}@e2e.local`,
      name: 'Redesign Hover GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Redesign Hover Campaign',
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

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Get the first ranked row's data-date attribute
    const firstRow = page.locator('[data-testid="ranked-row"]').first();
    await expect(firstRow).toBeVisible();
    const rowDate = await firstRow.getAttribute('data-date');
    expect(rowDate).toBeTruthy();

    // Find the matching calendar cell by data-date. The sidebar renders once,
    // so this resolves to a single cell; filter({ visible: true }) is kept as
    // belt-and-braces.
    const matchingCell = page
      .locator(`[data-testid="calendar-cell"][data-date="${rowDate}"]`)
      .filter({ visible: true });
    await expect(matchingCell).toBeVisible();

    // Before hovering: the hover-specific ring should not be present yet
    await expect(firstRow).not.toHaveClass(/ring-primary\/30/);

    // Hover the calendar cell — this should trigger HoverSyncContext
    await matchingCell.hover();

    // The ranked row should now have the hover-specific ring-primary/30 highlight class
    await expect(firstRow).toHaveClass(/ring-primary\/30/, {
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 3: GM can download per-session .ics
  // ────────────────────────────────────────────────────────────────────────────
  test('GM can download a per-session .ics file', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-redesign-ics-${Date.now()}@e2e.local`,
      name: 'Redesign ICS GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Redesign ICS Campaign',
      play_days: [5, 6],
    });

    // Seed a future confirmed session directly (no need to go through UI)
    const playDates = getPlayDates([5, 6], 4);
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

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // The upcoming sessions list should show the seeded session
    await expect(page.locator('[data-testid="upcoming-sessions-list"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Expand the scheduled row to reveal the per-session export button
    await page
      .locator('[data-testid="scheduled-row"]')
      .first()
      .locator('[aria-expanded="false"]')
      .first()
      .click();

    // Click the per-session .ics download button and capture the download event
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="ics-download-single"]').first().click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.ics$/);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 4: Mobile viewport shows calendar + subscribe inline, above ranked list
  // ────────────────────────────────────────────────────────────────────────────
  test('mobile viewport shows the calendar + subscribe inline, above the ranked list', async ({ page, request }) => {
    await page.setViewportSize({ width: 380, height: 800 });

    const gm = await createTestUser(request, {
      email: `gm-redesign-mobile-${Date.now()}@e2e.local`,
      name: 'Redesign Mobile GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Redesign Mobile Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Calendar + response panels are visible inline — no tap-to-expand gate.
    const panels = page.locator('[data-testid="sidebar-panels"]');
    await expect(panels).toBeVisible();

    // Subscribe is a discoverable webcal:// link, no expansion needed.
    const subscribe = panels.locator('[data-testid="calendar-subscribe-link"]').first();
    await expect(subscribe).toBeVisible();
    await expect(subscribe).toHaveAttribute('href', /^webcal:\/\//);

    // The panels sit ABOVE the long ranked list.
    const panelsBox = await panels.boundingBox();
    const rankedBox = await page.locator('[data-testid="ranked-list"]').first().boundingBox();
    expect(panelsBox).not.toBeNull();
    expect(rankedBox).not.toBeNull();
    expect(panelsBox!.y).toBeLessThan(rankedBox!.y);

    // The old collapsible is gone.
    await expect(page.locator('[data-testid="mobile-calendar-collapsible"]')).toHaveCount(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 5: calendar cells expose the resolved availability state
  // ────────────────────────────────────────────────────────────────────────────
  test('calendar cells expose the resolved availability state', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-redesign-everyone-${Date.now()}@e2e.local`,
      name: 'Redesign Everyone GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Redesign Everyone Campaign',
      play_days: [5, 6],
    });

    // GM + 2 members = 3 total players. With no explicit min_players_needed,
    // effectiveThreshold(0, 3) = min(3, max(3, ceil(0.6*3))) = 3, so "enough"
    // and "everyone" coincide at 3-for-3.
    const player1 = await createTestUser(request, {
      email: `player1-redesign-everyone-${Date.now()}@e2e.local`,
      name: 'Redesign Everyone Player 1',
      is_gm: false,
    });
    const player2 = await createTestUser(request, {
      email: `player2-redesign-everyone-${Date.now()}@e2e.local`,
      name: 'Redesign Everyone Player 2',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player1.id);
    await addPlayerToGame(game.id, player2.id);

    const playDates = getPlayDates([5, 6], 4);
    const playDate = playDates[0];
    await setAvailability(gm.id, game.id, [{ date: playDate, status: 'available' }]);
    await setAvailability(player1.id, game.id, [{ date: playDate, status: 'available' }]);
    await setAvailability(player2.id, game.id, [{ date: playDate, status: 'available' }]);

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    const scheduleTab = page.locator('[data-testid="schedule-tab-content"]');
    await expect(scheduleTab).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });

    const cell = scheduleTab
      .locator(`[data-testid="calendar-cell"][data-date="${playDate}"]`)
      .filter({ visible: true });
    await expect(cell).toHaveAttribute('data-state', 'everyone');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 6: an unanswered date reads as unknown, not as unavailable
  // ────────────────────────────────────────────────────────────────────────────
  test('a date nobody has answered reads as unknown, not as unavailable', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-redesign-unknown-${Date.now()}@e2e.local`,
      name: 'Redesign Unknown GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Redesign Unknown Campaign',
      play_days: [5, 6],
    });

    const player1 = await createTestUser(request, {
      email: `player1-redesign-unknown-${Date.now()}@e2e.local`,
      name: 'Redesign Unknown Player 1',
      is_gm: false,
    });
    const player2 = await createTestUser(request, {
      email: `player2-redesign-unknown-${Date.now()}@e2e.local`,
      name: 'Redesign Unknown Player 2',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player1.id);
    await addPlayerToGame(game.id, player2.id);

    // No availability rows at all for this date: floor 0, respondedCeiling
    // 0 < threshold (3) -> 'unknown', not 'not-enough'.
    const playDates = getPlayDates([5, 6], 4);
    const playDate = playDates[0];

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    const scheduleTab = page.locator('[data-testid="schedule-tab-content"]');
    await expect(scheduleTab).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });

    const cell = scheduleTab
      .locator(`[data-testid="calendar-cell"][data-date="${playDate}"]`)
      .filter({ visible: true });
    await expect(cell).toHaveAttribute('data-state', 'unknown');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 7: long scheduling windows page three months at a time
  // ────────────────────────────────────────────────────────────────────────────
  test('long scheduling windows page the calendar three months at a time', async ({
    page,
    request,
  }) => {
    const gm = await createTestUser(request, {
      email: `gm-redesign-pager-${Date.now()}@e2e.local`,
      name: 'Redesign Pager GM',
      is_gm: true,
    });

    // 12 months is the longest window the app offers; it spans 13 calendar
    // months, which is what used to overflow the sticky sidebar.
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Redesign Pager Campaign',
      play_days: [5, 6],
      scheduling_window_months: 12,
    });

    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(gm.id, game.id, [{ date: playDates[0], is_available: true }]);

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // The sidebar renders once, so a 13-month window shows exactly one page.
    const months = page.locator('[data-testid="calendar-month"]');
    await expect(months).toHaveCount(3);

    const firstPage = await months.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-month'))
    );

    await page.getByRole('button', { name: 'Show later months' }).click();

    await expect(months).toHaveCount(3);
    const secondPage = await months.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-month'))
    );

    // A full-page step: no month carries over from the previous page.
    expect(secondPage.filter((m) => firstPage.includes(m))).toEqual([]);

    // And stepping back returns to exactly where we started.
    await page.getByRole('button', { name: 'Show earlier months' }).click();
    const backAgain = await months.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-month'))
    );
    expect(backAgain).toEqual(firstPage);
  });
});
