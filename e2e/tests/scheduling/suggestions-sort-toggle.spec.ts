import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  setAvailability,
  getPlayDates,
  addPlayerToGame,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Suggested dates sort toggle', () => {
  test('toggling to Date reorders chronologically and persists across reload', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-sort-toggle-${Date.now()}@e2e.local`,
      name: 'Sort Toggle GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-sort-toggle-${Date.now()}@e2e.local`,
      name: 'Sort Toggle Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Sort Toggle Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    // Mark the GM available on all 4 play dates.
    // Mark the second player available on only the LATER half.
    // This makes availability-mode ordering differ from chronological ordering:
    //   - Availability order: [date2, date3, date0, date1] (2 votes before 1 vote)
    //   - Chronological order: [date0, date1, date2, date3] (ascending)
    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(
      gm.id,
      game.id,
      playDates.slice(0, 4).map((date) => ({ date, is_available: true }))
    );
    await setAvailability(
      player.id,
      game.id,
      playDates.slice(2, 4).map((date) => ({ date, is_available: true }))
    );

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
    await expect(page.locator('[data-testid="ranked-list"]')).toBeVisible();

    // Capture availability-mode order before toggling — must differ from chronological.
    const availabilityOrder = await page.locator('[data-testid="ranked-row"]').evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('data-date'))
    );

    // Toggle should be visible and default to availability.
    const toggle = page.locator('[data-testid="suggestions-sort-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(page.locator('[data-testid="sort-by-availability"]')).toHaveAttribute('aria-checked', 'true');

    // Switch to Date sort.
    await page.locator('[data-testid="sort-by-date"]').click();
    await expect(page.locator('[data-testid="sort-by-date"]')).toHaveAttribute('aria-checked', 'true');

    // Rows should be in ascending date order.
    const dates = await page.locator('[data-testid="ranked-row"]').evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('data-date'))
    );
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);

    // Sanity: chronological order differs from availability order. If these
    // were equal, the toggle could be silently broken and other assertions would still pass.
    expect(dates).not.toEqual(availabilityOrder);

    // Reload — selection persists.
    await page.reload();
    await page.getByRole('button', { name: /schedule/i }).click();
    await expect(page.locator('[data-testid="ranked-list"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await expect(page.locator('[data-testid="sort-by-date"]')).toHaveAttribute('aria-checked', 'true');

    // Switching back to Availability works.
    await page.locator('[data-testid="sort-by-availability"]').click();
    await expect(page.locator('[data-testid="sort-by-availability"]')).toHaveAttribute('aria-checked', 'true');

    // Confirm rows reverted to availability ordering.
    const revertedOrder = await page.locator('[data-testid="ranked-row"]').evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('data-date'))
    );
    expect(revertedOrder).toEqual(availabilityOrder);
  });
});
