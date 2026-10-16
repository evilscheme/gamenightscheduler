import { test, expect, type Browser, type Page } from '@playwright/test';
import { getAdminClient } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

// One persona for the whole file, run serially: both tests sign it in and out.
const PERSONA_BUTTON = /Dev Player 2/;
const PERSONA_EMAIL = 'dev-player2@dev.local';

test.describe.configure({ mode: 'serial' });

async function devLogin(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/dev-login?callbackUrl=/dashboard');
  await page.getByRole('button', { name: PERSONA_BUTTON }).click();
  // Match the path: the dev-login URL itself contains "/dashboard" in ?callbackUrl=.
  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: TEST_TIMEOUTS.LONG });
  return page;
}

/** An endpoint that validates the session server-side (requireUser -> getUser). */
async function isSignedIn(page: Page): Promise<boolean> {
  const res = await page.request.get('/api/account/delete-preview');
  return res.status() === 200;
}

test.describe('Dev login', () => {
  test('logging in as a persona does not sign out its other sessions', async ({ browser }) => {
    const first = await devLogin(browser);
    expect(await isSignedIn(first)).toBe(true);

    // A second browser logging in as the same persona used to reset its password,
    // which revoked every existing session.
    const second = await devLogin(browser);
    expect(await isSignedIn(second)).toBe(true);
    expect(await isSignedIn(first)).toBe(true);
  });

  test('still signs in a persona whose password was changed elsewhere', async ({ browser }) => {
    await devLogin(browser); // make sure the account exists
    const admin = getAdminClient();
    // Look the id up by email (dev-login upserts the profile) rather than scanning
    // auth.admin.listUsers, which flaked under the full suite's parallel load.
    const { data: profile, error: lookupError } = await admin
      .from('users')
      .select('id')
      .eq('email', PERSONA_EMAIL)
      .single();
    expect(lookupError).toBeNull();
    const { error } = await admin.auth.admin.updateUserById(profile!.id, { password: 'something-else-entirely-1!' });
    expect(error).toBeNull();

    const page = await devLogin(browser);
    expect(await isSignedIn(page)).toBe(true);
  });
});
