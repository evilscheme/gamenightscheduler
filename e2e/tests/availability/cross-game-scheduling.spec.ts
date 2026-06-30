// e2e/tests/availability/cross-game-scheduling.spec.ts
import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  createTestSession,
  setAvailability,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Cross-game scheduling awareness', () => {
  test('shows a badge on a date scheduled in another game', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `xgame-badge-${Date.now()}@e2e.local`,
      name: 'XGame Badge',
      is_gm: true,
    });

    const gameA = await createTestGame({
      gm_id: user.id, name: 'Game A Badge', play_days: [5], scheduling_window_months: 2,
    });
    const gameB = await createTestGame({
      gm_id: user.id, name: 'Game B Badge', play_days: [5], scheduling_window_months: 2,
    });

    const fridays = getPlayDates([5], 4);
    // Confirm a session in Game B on the first upcoming Friday.
    await createTestSession({
      game_id: gameB.id, date: fridays[0], confirmed_by: user.id,
      start_time: '19:00', end_time: '22:00',
    });

    await loginTestUser(page, { email: user.email, name: user.name, is_gm: true });
    await page.goto(`/games/${gameA.id}`);
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // The shared Friday in Game A carries the other-game badge.
    const conflictCell = page.locator(`button[data-date="${fridays[0]}"]`);
    await expect(conflictCell).toHaveAttribute('data-other-game', 'true', {
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    await expect(conflictCell.locator('[data-testid="other-game-indicator"]')).toBeVisible();

    // A non-scheduled Friday has no badge.
    const cleanCell = page.locator(`button[data-date="${fridays[1]}"]`);
    await expect(cleanCell).not.toHaveAttribute('data-other-game', 'true');
  });

  test('the date popover surfaces the other-game session (reachable on mobile)', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `xgame-popover-${Date.now()}@e2e.local`,
      name: 'XGame Popover',
      is_gm: true,
    });

    const gameA = await createTestGame({
      gm_id: user.id, name: 'Game A Popover', play_days: [5], scheduling_window_months: 2,
    });
    const gameB = await createTestGame({
      gm_id: user.id, name: 'Game B Popover', play_days: [5], scheduling_window_months: 2,
    });

    const fridays = getPlayDates([5], 4);
    await createTestSession({
      game_id: gameB.id, date: fridays[0], confirmed_by: user.id,
      start_time: '19:00', end_time: '22:00',
    });

    await loginTestUser(page, { email: user.email, name: user.name, is_gm: true });
    await page.goto(`/games/${gameA.id}`);
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Open the date's detail popover — the same one a mobile long-press opens.
    const conflictCell = page.locator(`button[data-date="${fridays[0]}"]`);
    await conflictCell.hover();
    await conflictCell.locator('[data-testid="edit-note-icon"]').click();

    // It names the game you're already scheduled with that night, with the time.
    const otherGame = page.locator('[data-testid="popover-other-game"]');
    await expect(otherGame).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await expect(otherGame).toContainText('Game B Popover');
    await expect(otherGame).toContainText('7pm–10pm');
  });

  test('copy prompts on conflicts and applies the chosen status', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `xgame-copy-${Date.now()}@e2e.local`,
      name: 'XGame Copy',
      is_gm: true,
    });

    const source = await createTestGame({
      gm_id: user.id, name: 'Source XG', play_days: [5], scheduling_window_months: 2,
    });
    const dest = await createTestGame({
      gm_id: user.id, name: 'Dest XG', play_days: [5], scheduling_window_months: 2,
    });

    const fridays = getPlayDates([5], 4);
    // In the source: marked available on two Fridays...
    await setAvailability(user.id, source.id, [
      { date: fridays[0], status: 'available' as const },
      { date: fridays[1], status: 'available' as const },
    ]);
    // ...and the source has a confirmed session on the first Friday (the conflict).
    await createTestSession({
      game_id: source.id, date: fridays[0], confirmed_by: user.id,
      start_time: '19:00', end_time: '22:00',
    });

    await loginTestUser(page, { email: user.email, name: user.name, is_gm: true });
    await page.goto(`/games/${dest.id}`);
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    await page.locator('[data-testid="copy-game-select"]').selectOption({ label: 'Source XG' });
    await page.locator('[data-testid="copy-game-button"]').click();

    // The conflict modal appears; default is Unavailable. Confirm.
    const modal = page.locator('[data-testid="copy-conflict-modal"]');
    await expect(modal).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await page.locator('[data-testid="copy-conflict-confirm"]').click();

    // The conflicting Friday is marked unavailable (override), not available.
    const conflictCell = page.locator(`button[data-date="${fridays[0]}"]`);
    await expect(conflictCell).toHaveAttribute('data-status', 'unavailable', {
      timeout: TEST_TIMEOUTS.DEFAULT,
    });
    // The non-conflict Friday copies through as available.
    const copiedCell = page.locator(`button[data-date="${fridays[1]}"]`);
    await expect(copiedCell).toHaveAttribute('data-status', 'available');
  });

  test('copy without conflicts does not show the modal', async ({ page, request }) => {
    const user = await createTestUser(request, {
      email: `xgame-noconflict-${Date.now()}@e2e.local`,
      name: 'XGame NoConflict',
      is_gm: true,
    });

    const source = await createTestGame({
      gm_id: user.id, name: 'Source NC', play_days: [5], scheduling_window_months: 2,
    });
    const dest = await createTestGame({
      gm_id: user.id, name: 'Dest NC', play_days: [5], scheduling_window_months: 2,
    });

    const fridays = getPlayDates([5], 4);
    await setAvailability(user.id, source.id, [
      { date: fridays[0], status: 'available' as const },
    ]);

    await loginTestUser(page, { email: user.email, name: user.name, is_gm: true });
    await page.goto(`/games/${dest.id}`);
    await page.getByRole('button', { name: /availability/i }).click();
    await expect(page.getByText(/mark your availability/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    await page.locator('[data-testid="copy-game-select"]').selectOption({ label: 'Source NC' });
    await page.locator('[data-testid="copy-game-button"]').click();

    // No modal — copy runs immediately.
    await expect(page.locator('[data-testid="copy-conflict-modal"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="copy-result-message"]')).toContainText(
      /copied \d+ date/i,
      { timeout: TEST_TIMEOUTS.DEFAULT },
    );
  });
});
