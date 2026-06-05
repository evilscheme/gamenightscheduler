import { test, expect } from '../../fixtures/auth.fixture';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Landing page SEO', () => {
  test('serves server-rendered marketing HTML to logged-out visitors (no JS)', async ({
    request,
  }) => {
    // `request` is a cookie-less API context → simulates a crawler / logged-out visitor.
    const res = await request.get('/');
    expect(res.ok()).toBeTruthy();

    const html = await res.text();

    // Strings unique to the SplashPage body. Their presence in the RAW response
    // (no browser, no hydration) proves the marketing page was server-rendered,
    // not the loading spinner shell.
    // The `>...<` delimiters ensure we match rendered tag content (e.g.
    // `<h3>Invite your party</h3>`), not the same text embedded inside the RSC
    // flight `<script>` payload — so this still fails if SSR regresses to a
    // client-only render.
    expect(html).toContain('>Invite your party<');
    expect(html).toContain('>Mark availability<');
    expect(html).toContain('>Co-GM Support<');
  });

  test('renders the dashboard inline at / for an authenticated user', async ({ gmPage }) => {
    await gmPage.goto('/');

    // "Your Games" is rendered by DashboardContent and never by the splash.
    // Assert it first so the LONG timeout covers client-side auth resolution.
    await expect(gmPage.getByRole('heading', { name: /your games/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // URL stays at root — no redirect to /dashboard.
    await expect(gmPage).toHaveURL('/');
  });
});
