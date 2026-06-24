import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  addPlayerToGame,
  setAvailability,
  getPlayDates,
} from '../../helpers/seed';

test.describe('Availability onboarding nudge', () => {
  test('shows for a member with no availability and resolves after marking', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-nudge-${Date.now()}@e2e.local`,
      name: 'Nudge GM',
      is_gm: true,
    });
    const player = await createTestUser(request, {
      email: `player-nudge-${Date.now()}@e2e.local`,
      name: 'Nudge Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Nudge Campaign',
      play_days: [5, 6],
    });
    await addPlayerToGame(game.id, player.id);

    // Player has no availability yet -> banner and pulsing dot should show.
    await loginTestUser(page, player);
    await page.goto(`/games/${game.id}`);

    const cta = page.getByRole('button', { name: /add availability/i });
    await expect(cta).toBeVisible();

    // Pulsing dot on the Availability tab button is visible while nudge is active.
    await expect(page.getByTestId('availability-nudge-dot')).toBeVisible();

    // Clicking the CTA switches to the Availability tab.
    await cta.click();

    // Positive assertion: the Availability tab content container is now visible.
    await expect(page.getByTestId('availability-tab-content')).toBeVisible();

    // Banner is gone once the Availability tab is active.
    await expect(cta).toBeHidden();

    // After the player has availability, the banner stays gone on reload (overview tab).
    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(player.id, game.id, [{ date: playDates[0], is_available: true }]);
    await page.goto(`/games/${game.id}`);
    await expect(page.getByRole('button', { name: /add availability/i })).toBeHidden();

    // Pulsing dot is also gone after availability is marked.
    await expect(page.getByTestId('availability-nudge-dot')).toBeHidden();
  });

  test('shows for the GM when they have no availability', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-nudge-gm-${Date.now()}@e2e.local`,
      name: 'Nudge GM Self',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Nudge GM Campaign',
      play_days: [5, 6],
    });

    // GM has no availability yet -> banner should show for them too.
    await loginTestUser(page, gm);
    await page.goto(`/games/${game.id}`);

    const cta = page.getByRole('button', { name: /add availability/i });
    await expect(cta).toBeVisible();
  });
});
