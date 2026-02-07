import { test as base, expect, Page } from '@playwright/test';
import { createTestGM, createTestPlayer, type TestUser } from '../helpers/test-auth';
import { createTestGame, addPlayerToGame, type TestGame } from '../helpers/seed';

const TEST_AUTH_SECRET = 'test-secret-for-e2e';
const TEST_AUTH_HEADERS = { 'x-test-auth-secret': TEST_AUTH_SECRET };

/**
 * Custom Playwright fixtures for authenticated testing.
 *
 * These fixtures provide pre-authenticated users and pages
 * so tests can focus on the actual functionality being tested.
 */

type AuthFixtures = {
  /** A GM user (is_gm = true) */
  gmUser: TestUser;

  /** A player user (is_gm = false) */
  playerUser: TestUser;

  /** A page authenticated as the GM user */
  gmPage: Page;

  /** A page authenticated as the player user */
  playerPage: Page;

  /** A game owned by the GM with the player as a member */
  testGame: TestGame;
};

/**
 * Extended test with auth fixtures.
 * Import this instead of @playwright/test in your test files.
 */
export const test = base.extend<AuthFixtures>({
  gmUser: async ({ request }, use) => {
    const user = await createTestGM(request);
    await use(user);
    // Cleanup happens in global teardown
  },

  playerUser: async ({ request }, use) => {
    const user = await createTestPlayer(request);
    await use(user);
  },

  gmPage: async ({ browser, gmUser }, use) => {
    // Create a new context to isolate this authenticated session
    const context = await browser.newContext();

    // Sign in as GM by calling the test-auth endpoint
    const apiContext = await context.request;
    await apiContext.post('/api/test-auth', {
      data: {
        email: gmUser.email,
        name: gmUser.name,
        is_gm: true,
      },
      headers: TEST_AUTH_HEADERS,
    });

    const page = await context.newPage();
    await use(page);

    await context.close();
  },

  playerPage: async ({ browser, playerUser }, use) => {
    const context = await browser.newContext();

    const apiContext = await context.request;
    await apiContext.post('/api/test-auth', {
      data: {
        email: playerUser.email,
        name: playerUser.name,
        is_gm: false,
      },
      headers: TEST_AUTH_HEADERS,
    });

    const page = await context.newPage();
    await use(page);

    await context.close();
  },

  testGame: async ({ gmUser, playerUser }, use) => {
    // Create a game with the GM
    const game = await createTestGame({
      gm_id: gmUser.id,
      name: `Test Game ${Date.now()}`,
      play_days: [5, 6], // Friday, Saturday
    });

    // Add the player to the game
    await addPlayerToGame(game.id, playerUser.id);

    await use(game);
  },
});

export { expect };
