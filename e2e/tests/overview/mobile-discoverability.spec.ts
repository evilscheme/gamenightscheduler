import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Overview tab mobile discoverability', () => {
  test('game details + subscribe appear above the player list on mobile', async ({ page, request }) => {
    await page.setViewportSize({ width: 380, height: 800 });

    const gm = await createTestUser(request, {
      email: `gm-overview-mobile-${Date.now()}@e2e.local`,
      name: 'Overview Mobile GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Overview Mobile Campaign',
      play_days: [5, 6],
    });

    await loginTestUser(page, { email: gm.email, name: gm.name, is_gm: true });
    await page.goto(`/games/${game.id}`);

    await expect(page.locator('[data-testid="overview-tab-content"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Game details (with subscribe) is visible inline on mobile.
    const details = page.locator('[data-testid="game-details"]');
    await expect(details).toBeVisible();

    // Subscribe is a webcal:// link.
    const subscribe = details.locator('[data-testid="calendar-subscribe-link"]').first();
    await expect(subscribe).toBeVisible();
    await expect(subscribe).toHaveAttribute('href', /^webcal:\/\//);

    // Details sits ABOVE the (potentially long) player list.
    const detailsBox = await details.boundingBox();
    const partyBox = await page.locator('[data-testid="players-list"]').boundingBox();
    expect(detailsBox).not.toBeNull();
    expect(partyBox).not.toBeNull();
    expect(detailsBox!.y).toBeLessThan(partyBox!.y);
  });
});
