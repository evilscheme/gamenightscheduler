import { test, expect } from '@playwright/test';
import { format, parseISO } from 'date-fns';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
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

    // Rank #1 row auto-expands and shows the Lock In button
    const lockInButton = page.getByRole('button', { name: /lock in this night/i }).first();
    await expect(lockInButton).toBeVisible();
    await lockInButton.click();

    // Confirm the session via the modal
    await expect(page.locator('[data-testid="schedule-session-modal"]')).toBeVisible();
    await page.locator('[data-testid="confirm-session-submit"]').click();

    // Toast should appear
    await expect(page.getByRole('status')).toContainText(/locked in/i, {
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // Upcoming sessions list should be visible after confirming
    await expect(page.locator('[data-testid="upcoming-sessions-list"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.DEFAULT,
    });

    // The confirmed session's date should appear in the list
    const expectedDateText = format(parseISO(playDates[0]), 'EEEE, MMMM d, yyyy');
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

    // Find the matching calendar cell by data-date
    const matchingCell = page.locator(`[data-testid="calendar-cell"][data-date="${rowDate}"]`);
    await expect(matchingCell).toBeVisible();

    // Hover the calendar cell — this should trigger HoverSyncContext
    await matchingCell.hover();

    // The ranked row should now have the ring-primary highlight class
    await expect(firstRow).toHaveClass(/ring-primary/, {
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

    // Click the per-session .ics download button and capture the download event
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="ics-download-single"]').first().click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.ics$/);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test 4: Mobile viewport collapses sidebar into <details> cards
  // ────────────────────────────────────────────────────────────────────────────
  test('mobile viewport shows collapsible calendar and response-status cards', async ({ page, request }) => {
    // Set mobile viewport BEFORE navigating
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

    // Seed one date so the schedule tab has content to render
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

    // Mobile: sidebar elements are collapsed into <details> cards
    await expect(page.locator('[data-testid="mobile-calendar-collapsible"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-response-collapsible"]')).toBeVisible();
  });
});
