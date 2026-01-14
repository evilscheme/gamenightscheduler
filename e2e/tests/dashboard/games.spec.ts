import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Dashboard Games', () => {
  test('shows empty state when user has no games', async ({ page, request }) => {
    // Create a fresh user with no games
    const user = await createTestUser(request, {
      email: `user-empty-${Date.now()}@e2e.local`,
      name: 'Empty Dashboard User',
      is_gm: false,
    });

    await loginTestUser(page, {
      email: user.email,
      name: user.name,
      is_gm: false,
    });

    await page.goto('/dashboard');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Should show empty state
    await expect(page.getByText(/no games yet/i)).toBeVisible();

    // Non-GM should see message about joining via invite or enabling GM mode
    await expect(page.getByText(/join a game using an invite link/i)).toBeVisible();

    // Should have button to go to settings (within the empty state action)
    await expect(page.getByRole('button', { name: /go to settings/i })).toBeVisible();
  });

  test('game cards display correct information', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cards-${Date.now()}@e2e.local`,
      name: 'Card Test GM',
      is_gm: true,
    });

    const player1 = await createTestUser(request, {
      email: `player1-cards-${Date.now()}@e2e.local`,
      name: 'Card Player One',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Card Test Campaign',
      description: 'A test campaign for card display',
      play_days: [5, 6], // Friday, Saturday
    });

    await addPlayerToGame(game.id, player1.id);

    // Login as GM
    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Find the game card
    const gameCard = page.locator('a').filter({ hasText: 'Card Test Campaign' });
    await expect(gameCard).toBeVisible();

    // Should show game name
    await expect(gameCard.getByText('Card Test Campaign')).toBeVisible();

    // Should show GM name with (You) indicator
    await expect(gameCard.getByText(/GM:.*Card Test GM.*\(You\)/)).toBeVisible();

    // Should show GM badge
    await expect(gameCard.getByText('GM', { exact: true })).toBeVisible();

    // Should show player count (2 players - GM + 1 player)
    await expect(gameCard.getByText(/2 players/)).toBeVisible();

    // Should show play days
    await expect(gameCard.getByText(/Fri, Sat/)).toBeVisible();

    // Should show description
    await expect(gameCard.getByText('A test campaign for card display')).toBeVisible();
  });

  test('clicking game card navigates to game detail', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-nav-${Date.now()}@e2e.local`,
      name: 'Nav Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Navigation Campaign',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click on the game card
    const gameCard = page.locator('a').filter({ hasText: 'Navigation Campaign' });
    await expect(gameCard).toBeVisible();
    await gameCard.click();

    // Should navigate to game detail page
    await expect(page).toHaveURL(`/games/${game.id}`);

    // Game name should be visible on detail page
    await expect(page.getByRole('heading', { name: /navigation campaign/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });
});
