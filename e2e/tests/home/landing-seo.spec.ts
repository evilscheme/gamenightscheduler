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

    // Log the raw response size up front so it's visible on every run (including
    // failures). It was ~500KB+ when the ~142 decorative dice were server-rendered.
    const bytes = Buffer.byteLength(html);
    console.log(`[landing-seo] raw / response size: ${bytes} bytes`);

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

    // Discoverability copy must be server-rendered: these domain keywords let
    // search/AI engines understand what the app is for. Use terms that are new to
    // the page (not "calendar", which already appears via "Calendar Sync") and
    // free of HTML-escaping ambiguity (avoid "D&D" → "D&amp;D").
    expect(html).toContain('TTRPG');
    expect(html).toContain('board game');

    // Decorative dice are client-only (rendered after mount), so they must NOT
    // appear in the server response. `lucide-dice` is the rendered-SVG marker
    // (e.g. class "lucide lucide-dice-1") and is absent from globals.css, so it
    // won't false-positive on inlined CSS the way the `dice-filled` class would.
    expect(html).not.toContain('lucide-dice');

    // Size backstop against mass-element bloat (the dice were ~518KB of the old
    // ~598KB dev response). This runs against `next dev`, which is far heavier than
    // production (unminified + HMR + verbose RSC payload): post-fix dev is ~80KB
    // while production is ~31KB. The 150KB cap is a loose regression guard — it
    // passes comfortably now but trips immediately if the dice (or similar) return
    // to the server render. The precise dice guard is `not.toContain('lucide-dice')`
    // above.
    expect(bytes).toBeLessThan(150_000);
  });

  test('renders the decorative dice in the browser after hydration', async ({ page }) => {
    await page.goto('/');

    // Dice are client-only and fade in after mount. `.dice-filled` is the class
    // on each die's <svg>; its presence proves the client renders them post-mount.
    await expect(page.locator('.dice-filled').first()).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
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
