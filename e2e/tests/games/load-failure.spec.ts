import { test, expect } from '../../fixtures/auth.fixture';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * A failed game load must not be mistaken for a missing game.
 *
 * In production this happens when a tab wakes after the access token has
 * expired: the refetch races the token refresh, PostgREST runs the request as
 * `anon`, and every participant-gated query returns 42501. The page used to
 * treat that as "game not found" and redirect to the dashboard — whose queries
 * failed the same way, so it rendered an empty game list. To the player their
 * games had vanished, with no error shown anywhere (the 401 is below the
 * outage banner's 5xx threshold).
 *
 * Route interception reproduces the exact response PostgREST sends.
 */

// Serial: these tests manipulate route interception, which can interfere
// across tests sharing the same server setup phase.
test.describe.configure({ mode: 'serial' });

const RLS_DENIAL = {
  status: 401,
  contentType: 'application/json',
  body: JSON.stringify({
    code: '42501',
    details: null,
    hint: null,
    message: 'permission denied for function is_game_participant',
  }),
};

// Matches /rest/v1/games only — game_memberships is a different path segment.
const GAMES_ROUTE = '**/rest/v1/games**';

test.describe('Game page load failure', () => {
  test('keeps the player on the game page instead of redirecting to the dashboard', async ({
    gmPage,
    testGame,
  }) => {
    await gmPage.route(GAMES_ROUTE, (route) => route.fulfill(RLS_DENIAL));

    await gmPage.goto(`/games/${testGame.id}`);

    await expect(gmPage.getByRole('button', { name: /try again/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    // The regression this guards: the player used to be bounced to /dashboard.
    expect(gmPage.url()).toContain(`/games/${testGame.id}`);
  });

  test('loads the game when the retry succeeds', async ({ gmPage, testGame }) => {
    await gmPage.route(GAMES_ROUTE, (route) => route.fulfill(RLS_DENIAL));

    await gmPage.goto(`/games/${testGame.id}`);
    const retry = gmPage.getByRole('button', { name: /try again/i });
    await expect(retry).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });

    // "Recover" — the token refresh has landed, requests succeed again.
    await gmPage.unroute(GAMES_ROUTE);
    await retry.click();

    await expect(gmPage.getByText(testGame.name).first()).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await expect(retry).not.toBeVisible();
  });
});
