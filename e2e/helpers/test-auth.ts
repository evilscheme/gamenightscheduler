import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Helper functions for test authentication.
 *
 * These wrap calls to the /api/test-auth endpoint for easy use in tests.
 */

export interface TestUser {
  id: string;
  email: string;
  name: string;
  is_gm: boolean;
}

/**
 * Create and sign in a test user via the test-auth API.
 * This sets session cookies on the request context.
 *
 * IMPORTANT: Use `page.request` instead of the standalone `request` fixture
 * to ensure cookies are shared with the browser page.
 */
export async function createTestUser(
  request: APIRequestContext,
  options: {
    email?: string;
    name?: string;
    is_gm?: boolean;
  } = {}
): Promise<TestUser> {
  const timestamp = Date.now();
  const email = options.email || `test-${timestamp}@e2e.local`;
  const name = options.name || `Test User ${timestamp}`;
  const is_gm = options.is_gm ?? false;

  const response = await request.post('http://localhost:3001/api/test-auth', {
    data: { email, name, is_gm },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create test user: ${response.status()} ${text}`);
  }

  return response.json();
}

/**
 * Create and sign in a test user using page.request (shares cookies with page).
 * Use this when you need the page to be authenticated after the call.
 *
 * @param page The Playwright page
 * @param options User options (email, name, is_gm)
 * @param navigateAndReload If true, navigates to / and reloads to ensure auth is fully established
 */
export async function loginTestUser(
  page: Page,
  options: {
    email?: string;
    name?: string;
    is_gm?: boolean;
  } = {},
  navigateAndReload = true
): Promise<TestUser> {
  const timestamp = Date.now();
  const email = options.email || `test-${timestamp}@e2e.local`;
  const name = options.name || `Test User ${timestamp}`;
  const is_gm = options.is_gm ?? false;

  const response = await page.request.post('http://localhost:3001/api/test-auth', {
    data: { email, name, is_gm },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to login test user: ${response.status()} ${text}`);
  }

  const user = await response.json();

  // Navigate to establish auth cookies in the browser context
  // Don't wait for full page load - the subsequent test steps will wait for their own elements
  if (navigateAndReload) {
    await page.goto('/dashboard');
    // Brief wait for cookies to be processed and initial auth state change to fire
    await page.waitForTimeout(100);
  }

  return user;
}

/**
 * Create a GM user for testing.
 */
export async function createTestGM(
  request: APIRequestContext,
  name?: string
): Promise<TestUser> {
  return createTestUser(request, {
    email: `gm-${Date.now()}@e2e.local`,
    name: name || `Test GM ${Date.now()}`,
    is_gm: true,
  });
}

/**
 * Create a player (non-GM) user for testing.
 */
export async function createTestPlayer(
  request: APIRequestContext,
  name?: string
): Promise<TestUser> {
  return createTestUser(request, {
    email: `player-${Date.now()}@e2e.local`,
    name: name || `Test Player ${Date.now()}`,
    is_gm: false,
  });
}

