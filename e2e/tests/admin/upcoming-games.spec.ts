import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, createTestSession } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * The "Upcoming Games" admin tab surfaces confirmed sessions across ALL games
 * in the system (not just games the admin belongs to), so it can never be
 * fully isolated from other tests' seeded data in this parallel, shared-DB
 * test suite. To stay robust:
 *  - The empty-state test mocks the API response (page.route) rather than
 *    relying on zero sessions system-wide, which no other test can guarantee.
 *  - The pagination test seeds real data and reads `total`/`totalPages` back
 *    from the rendered page rather than hardcoding exact numbers, so it still
 *    passes if another concurrently-run spec has added upcoming sessions.
 *  - Ordering is checked via uniquely-tagged rows (by `location`) and their
 *    relative order, not by absolute row index. Critically, this check walks
 *    ALL pages (not just page 1): other specs (e.g.
 *    dashboard/upcoming-sessions.spec.ts) concurrently seed sessions dated
 *    today/tomorrow that sort ahead of this test's markers system-wide, which
 *    can push even the soonest marker past page 1 if enough of them land at
 *    once. Concatenating every page's rows before asserting order removes
 *    that page-1 assumption entirely.
 *
 * Run serially — the empty-state test's route interception can interfere
 * with the second test's real network requests if run concurrently.
 */
test.describe.configure({ mode: 'serial' });

/** Local YYYY-MM-DD date `daysFromNow` days out (matches the app's local-date storage format). */
function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test.describe('Admin Upcoming Games tab', () => {
  test('shows an empty state when there are no upcoming sessions', async ({ page, request }) => {
    const admin = await createTestUser(request, {
      email: `admin-upcoming-empty-${Date.now()}@e2e.local`,
      name: 'Admin Upcoming Empty',
      is_gm: false,
      is_admin: true,
    });

    await loginTestUser(page, {
      email: admin.email,
      name: admin.name,
      is_gm: false,
      is_admin: true,
    });

    // Mock a zero-session response — this route is system-wide, so genuinely
    // zero upcoming sessions can't be guaranteed while other specs run.
    await page.route('**/api/admin/upcoming-sessions**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
      })
    );

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Upcoming Games', exact: true }).click();

    await expect(page.getByText(/no upcoming sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });

  test('shows sessions from multiple games ordered soonest-first, paginated', async ({ page, request }) => {
    const ts = Date.now();
    const admin = await createTestUser(request, {
      email: `admin-upcoming-${ts}@e2e.local`,
      name: 'Admin Upcoming User',
      is_gm: false,
      is_admin: true,
    });
    const gmAlpha = await createTestUser(request, {
      email: `upcoming-gm-alpha-${ts}@e2e.local`,
      name: 'Upcoming GM Alpha',
      is_gm: true,
      is_admin: false,
    });
    const gmBeta = await createTestUser(request, {
      email: `upcoming-gm-beta-${ts}@e2e.local`,
      name: 'Upcoming GM Beta',
      is_gm: true,
      is_admin: false,
    });

    const gameAlpha = await createTestGame({
      gm_id: gmAlpha.id,
      name: `Upcoming Games Alpha Campaign ${ts}`,
      play_days: [5, 6],
      timezone: 'America/Los_Angeles',
    });
    const gameBeta = await createTestGame({
      gm_id: gmBeta.id,
      name: `Upcoming Games Beta Campaign ${ts}`,
      play_days: [5, 6],
      timezone: 'America/Los_Angeles',
    });

    // 25 sessions across 2 games spread over distinct future dates (more than
    // one page's worth). Even offsets -> Alpha, odd -> Beta. The four earliest
    // sessions get a unique `location` tag so we can find their exact rows and
    // check *relative* soonest-first order, regardless of any other upcoming
    // sessions concurrently seeded elsewhere in the system.
    const markers: Record<number, string> = {
      2: `Marker-${ts}-A`, // Alpha, soonest
      3: `Marker-${ts}-B`, // Beta
      4: `Marker-${ts}-C`, // Alpha
      5: `Marker-${ts}-D`, // Beta
    };
    const offsets = Array.from({ length: 25 }, (_, i) => i + 2); // 2..26
    for (const offset of offsets) {
      const isAlpha = offset % 2 === 0;
      await createTestSession({
        game_id: isAlpha ? gameAlpha.id : gameBeta.id,
        date: futureDate(offset),
        confirmed_by: isAlpha ? gmAlpha.id : gmBeta.id,
        start_time: '18:00',
        end_time: '21:00',
        location: markers[offset] ?? null,
      });
    }

    await loginTestUser(page, {
      email: admin.email,
      name: admin.name,
      is_gm: false,
      is_admin: true,
    });

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Upcoming Games', exact: true }).click();

    const rows = page.locator('table tbody tr');
    // Page size is 20 and we alone seeded 25 upcoming sessions, so page 1 is
    // always a full page regardless of any other upcoming sessions elsewhere.
    await expect(rows).toHaveCount(20, { timeout: TEST_TIMEOUTS.LONG });

    // Read total/totalPages back from the pager rather than hardcoding them,
    // so this stays correct even if other specs add upcoming sessions too.
    const pagerText = await page.getByText(/page \d+ of \d+/i).innerText();
    const pageMatch = pagerText.match(/page (\d+) of (\d+)/i);
    const totalMatch = pagerText.match(/(\d+)\s+total session/i);
    expect(pageMatch).not.toBeNull();
    expect(totalMatch).not.toBeNull();
    const totalPages = Number(pageMatch![2]);
    const total = Number(totalMatch![1]);
    expect(total).toBeGreaterThanOrEqual(25);
    expect(totalPages).toBeGreaterThanOrEqual(2);

    const previousButton = page.getByRole('button', { name: 'Previous page of upcoming sessions' });
    const nextButton = page.getByRole('button', { name: 'Next page of upcoming sessions' });
    await expect(previousButton).toBeDisabled();
    await expect(nextButton).toBeEnabled();

    // Walk every page and concatenate row text in DOM order. This route is
    // system-wide, so our four markers can't be assumed to land on page 1 --
    // other concurrently-run specs may seed sessions dated sooner (e.g.
    // today/tomorrow) that push our markers onto later pages.
    const allRowTexts: string[] = await rows.allTextContents();
    for (let p = 2; p <= totalPages; p++) {
      await nextButton.click();
      // The table and pager re-render together only once the new page's data
      // has loaded (the component shows a spinner in place of both while
      // loading), so waiting for the new page number confirms rows are fresh.
      await expect(page.getByText(new RegExp(`page ${p} of`, 'i'))).toBeVisible();
      const expectedCount = p < totalPages ? 20 : total - 20 * (totalPages - 1);
      await expect(rows).toHaveCount(expectedCount);
      allRowTexts.push(...(await rows.allTextContents()));
    }
    expect(allRowTexts.length).toBe(total);
    await expect(nextButton).toBeDisabled();

    // Soonest-first, interleaved across both games: A (Alpha) < B (Beta) < C (Alpha) < D (Beta).
    // Each marker must appear exactly once across all pages combined.
    const findIndices = (marker: string) =>
      allRowTexts.reduce<number[]>((acc, text, i) => (text.includes(marker) ? [...acc, i] : acc), []);
    const indicesA = findIndices(markers[2]);
    const indicesB = findIndices(markers[3]);
    const indicesC = findIndices(markers[4]);
    const indicesD = findIndices(markers[5]);
    expect(indicesA).toHaveLength(1);
    expect(indicesB).toHaveLength(1);
    expect(indicesC).toHaveLength(1);
    expect(indicesD).toHaveLength(1);
    const [idxA] = indicesA;
    const [idxB] = indicesB;
    const [idxC] = indicesC;
    const [idxD] = indicesD;
    expect(idxB).toBeGreaterThan(idxA);
    expect(idxC).toBeGreaterThan(idxB);
    expect(idxD).toBeGreaterThan(idxC);

    // The soonest two markers' rows link to the right game and show the
    // right GM, checked via the captured row text since the row locator
    // itself may be on whatever page it happened to land on.
    expect(allRowTexts[idxA]).toContain(`Upcoming Games Alpha Campaign ${ts}`);
    expect(allRowTexts[idxA]).toContain('Upcoming GM Alpha');
    expect(allRowTexts[idxB]).toContain(`Upcoming Games Beta Campaign ${ts}`);
    expect(allRowTexts[idxB]).toContain('Upcoming GM Beta');

    // Previous walks all the way back down to a full first page.
    for (let p = totalPages - 1; p >= 1; p--) {
      await previousButton.click();
      await expect(page.getByText(new RegExp(`page ${p} of`, 'i'))).toBeVisible();
    }
    await expect(rows).toHaveCount(20);
    await expect(previousButton).toBeDisabled();
  });
});
