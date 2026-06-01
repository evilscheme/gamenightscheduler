import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  createTestSession,
  getPlayDates,
  getPastPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

function localDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test.describe('Dashboard upcoming sessions', () => {
  test('lists future sessions across games, capped with show more, excluding past', async ({
    page,
    request,
  }) => {
    const user = await createTestUser(request, {
      email: `upcoming-${Date.now()}@e2e.local`,
      name: 'Upcoming User',
      is_gm: true,
    });

    const gameA = await createTestGame({
      gm_id: user.id,
      name: 'Alpha Quest',
      play_days: [0, 1, 2, 3, 4, 5, 6],
    });
    const otherGm = await createTestUser(request, {
      email: `gmB-${Date.now()}@e2e.local`,
      name: 'GM B',
      is_gm: true,
    });
    const gameB = await createTestGame({
      gm_id: otherGm.id,
      name: 'Beta Saga',
      play_days: [0, 1, 2, 3, 4, 5, 6],
    });
    await addPlayerToGame(gameB.id, user.id);

    // 7 future sessions split across the two games (every day for the next week).
    const future = getPlayDates([0, 1, 2, 3, 4, 5, 6], 2).slice(0, 7);
    for (let i = 0; i < future.length; i++) {
      await createTestSession({
        game_id: i % 2 === 0 ? gameA.id : gameB.id,
        date: future[i],
        confirmed_by: user.id,
      });
    }
    // One past session in game A — must NOT appear.
    const past = getPastPlayDates([0, 1, 2, 3, 4, 5, 6], 1)[0];
    await createTestSession({ game_id: gameA.id, date: past, confirmed_by: user.id });

    await loginTestUser(page, { email: user.email, name: user.name, is_gm: true });
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    const panel = page.getByTestId('upcoming-sessions-panel');
    await expect(panel.getByRole('heading', { name: /upcoming sessions/i })).toBeVisible();

    // Soft cap: 5 visible initially, 7 after Show more.
    await expect(panel.getByTestId('upcoming-session')).toHaveCount(5);
    await panel.getByRole('button', { name: /show more/i }).click();
    await expect(panel.getByTestId('upcoming-session')).toHaveCount(7);

    // Show less collapses back to 5.
    await panel.getByRole('button', { name: /show less/i }).click();
    await expect(panel.getByTestId('upcoming-session')).toHaveCount(5);
  });

  test("highlights today's session and navigates to the game on click", async ({
    page,
    request,
  }) => {
    const user = await createTestUser(request, {
      email: `today-${Date.now()}@e2e.local`,
      name: 'Today User',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: user.id,
      name: 'Today Campaign',
      play_days: [0, 1, 2, 3, 4, 5, 6],
    });
    await createTestSession({ game_id: game.id, date: localDateString(0), confirmed_by: user.id });

    await loginTestUser(page, { email: user.email, name: user.name, is_gm: true });
    await page.goto('/dashboard');

    const panel = page.getByTestId('upcoming-sessions-panel');
    await expect(panel.getByText('Today', { exact: true })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    await panel.getByTestId('upcoming-session').first().click();
    await expect(page).toHaveURL(`/games/${game.id}`);
  });

  test('shows the empty message when there are no upcoming sessions', async ({
    page,
    request,
  }) => {
    const user = await createTestUser(request, {
      email: `noupcoming-${Date.now()}@e2e.local`,
      name: 'No Upcoming User',
      is_gm: true,
    });
    // A game with only a past session.
    const game = await createTestGame({
      gm_id: user.id,
      name: 'Quiet Campaign',
      play_days: [0, 1, 2, 3, 4, 5, 6],
    });
    const past = getPastPlayDates([0, 1, 2, 3, 4, 5, 6], 1)[0];
    await createTestSession({ game_id: game.id, date: past, confirmed_by: user.id });

    await loginTestUser(page, { email: user.email, name: user.name, is_gm: true });
    await page.goto('/dashboard');

    const panel = page.getByTestId('upcoming-sessions-panel');
    await expect(panel.getByText(/no upcoming sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });
});
