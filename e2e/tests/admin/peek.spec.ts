import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  createTestSession,
  setAvailability,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Admin Game Peek', () => {
  test('admin can view a game they are not a member of, read-only', async ({ page, request }) => {
    const ts = Date.now();
    const gm = await createTestUser(request, {
      email: `peek-gm-${ts}@e2e.local`,
      name: 'Peek GM',
      is_gm: true,
      is_admin: false,
    });
    const player = await createTestUser(request, {
      email: `peek-player-${ts}@e2e.local`,
      name: 'Peek Player',
      is_gm: false,
      is_admin: false,
    });
    const admin = await createTestUser(request, {
      email: `peek-admin-${ts}@e2e.local`,
      name: 'Peek Admin',
      is_gm: false,
      is_admin: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Peek Test Campaign',
      play_days: [5, 6],
    });
    await addPlayerToGame(game.id, player.id);

    const dates = getPlayDates([5, 6], 2);
    await setAvailability(
      player.id,
      game.id,
      dates.map((date) => ({ date, status: 'available' as const }))
    );
    await createTestSession({
      game_id: game.id,
      date: dates[0],
      confirmed_by: gm.id,
    });

    // The admin is NOT a member of this game — only the peek view can show it
    await loginTestUser(page, {
      email: admin.email,
      name: admin.name,
      is_gm: false,
      is_admin: true,
    });
    await page.goto(`/admin/games/${game.id}`);

    // Read-only banner and game header
    await expect(page.getByTestId('admin-peek-banner')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await expect(page.getByRole('heading', { name: 'Peek Test Campaign' })).toBeVisible();

    // Overview shows the party but no management controls
    await expect(page.getByTestId('overview-tab-content')).toBeVisible();
    await expect(page.getByText('Peek Player').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^edit$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /copy invite link/i })).toHaveCount(0);

    // Availability tab: read-only calendar without bulk actions, per-player view
    await page.getByRole('button', { name: /^availability$/i }).click();
    await expect(page.getByTestId('availability-tab-content')).toBeVisible();
    await expect(page.getByText(/mark all/i)).toHaveCount(0);
    await page.getByTestId('peek-view-as-select').selectOption(player.id);
    await expect(page.getByTestId('availability-tab-content')).toBeVisible();

    // Schedule tab renders with no scheduling actions
    await page.getByRole('button', { name: /^schedule$/i }).click();
    await expect(page.getByTestId('schedule-tab-content')).toBeVisible();
    await expect(page.getByRole('button', { name: /schedule game/i })).toHaveCount(0);
  });

  test('non-admin cannot access the peek page or snapshot API', async ({ page, request }) => {
    const ts = Date.now();
    const gm = await createTestUser(request, {
      email: `peek-noadm-gm-${ts}@e2e.local`,
      name: 'Peek NoAdmin GM',
      is_gm: true,
      is_admin: false,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Peek Forbidden Game',
      play_days: [5, 6],
    });
    const user = await createTestUser(request, {
      email: `peek-noadm-user-${ts}@e2e.local`,
      name: 'Peek NoAdmin User',
      is_gm: false,
      is_admin: false,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: false,
      is_admin: false,
    });

    // Snapshot API rejects non-admins
    const res = await page.request.get(`/api/admin/games/${game.id}`);
    expect(res.status()).toBe(403);

    // Peek page redirects non-admins away
    await page.goto(`/admin/games/${game.id}`);
    await expect(page).toHaveURL('/dashboard', { timeout: TEST_TIMEOUTS.LONG });
  });

  test('admin sees not-found state for a missing game', async ({ page, request }) => {
    const admin = await createTestUser(request, {
      email: `peek-404-admin-${Date.now()}@e2e.local`,
      name: 'Peek 404 Admin',
      is_gm: false,
      is_admin: true,
    });

    await loginTestUser(page, {
      email: admin.email,
      name: admin.name,
      is_gm: false,
      is_admin: true,
    });

    await page.goto('/admin/games/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText(/game not found/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });
});
