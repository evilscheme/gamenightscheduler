import { test, expect, type Page } from '@playwright/test';
import { loginTestUser } from '../../helpers/test-auth';
import { createTestGame, getPlayDates, setAvailability } from '../../helpers/seed';
import { availabilityRowsInGame, availabilityStatusForDate } from '../../helpers/db-assertions';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * Click a weekday default status and wait for the auto-save to settle.
 *
 * The editor saves asynchronously on click; navigating or reloading before the
 * POST completes cancels the request and the default never persists. We assert
 * the optimistic UI update, then wait for the transient "Saving…" indicator to
 * clear, guaranteeing the row is written before the next step.
 */
async function setDefaultAndWait(page: Page, day: string, value: string) {
  const button = page.locator(`[data-testid="status-${day}-${value}"]:visible`);
  await button.click();
  await expect(button).toHaveAttribute('aria-checked', 'true', { timeout: TEST_TIMEOUTS.DEFAULT });
  // The save indicator reads "Saving…" while in flight; wait for it to clear.
  await expect(page.getByText(/saving…/i)).toHaveCount(0, { timeout: TEST_TIMEOUTS.DEFAULT });
}

test.describe('Default availability', () => {
  test('set defaults in settings, then apply them to a game', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `default-avail-${Date.now()}@e2e.local`,
      name: 'Default Avail User',
      is_gm: true,
    });

    const game = await createTestGame({ gm_id: user.id, name: 'Defaults Game', play_days: [3, 5] });

    // Configure defaults in the editor.
    await page.goto('/settings/default-availability');
    await expect(page.getByRole('heading', { name: /default availability/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await setDefaultAndWait(page, 'friday', 'available');
    await setDefaultAndWait(page, 'wednesday', 'unavailable');

    // Reload and confirm persistence.
    await page.reload();
    await expect(page.locator('[data-testid="status-friday-available"]:visible')).toHaveAttribute('aria-checked', 'true', { timeout: TEST_TIMEOUTS.DEFAULT });

    // Apply to the game.
    await page.goto(`/games/${game.id}`);
    // The game page renders tabs as plain buttons (not role="tab"); match the
    // tab by its exact accessible name so we don't also hit the "Apply my
    // default availability" button.
    await expect(page.getByRole('button', { name: /^availability$/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await page.getByRole('button', { name: /^availability$/i }).click();

    await page.getByRole('button', { name: /apply my default availability/i }).click();
    await expect(page.getByText(/filled in \d+ dates?/i)).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    expect(await availabilityRowsInGame(game.id, user.id)).toBeGreaterThan(0);

    // Re-applying fills nothing.
    await page.getByRole('button', { name: /apply my default availability/i }).click();
    await expect(page.getByText(/already applied/i)).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
  });

  test('apply is non-destructive — a pre-set date is not overwritten', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `default-nd-${Date.now()}@e2e.local`,
      name: 'Non Destructive User',
      is_gm: true,
    });
    const game = await createTestGame({ gm_id: user.id, name: 'Non Destructive Game', play_days: [5] });

    // Pre-set one Friday to 'maybe' via seed.
    const fridays = getPlayDates([5], 2);
    const manualDate = fridays[0];
    await setAvailability(user.id, game.id, [{ date: manualDate, status: 'maybe' }]);
    const rowsBefore = await availabilityRowsInGame(game.id, user.id);

    // Default: Friday = Available.
    await page.goto('/settings/default-availability');
    await expect(page.getByRole('heading', { name: /default availability/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await setDefaultAndWait(page, 'friday', 'available');

    // Apply.
    await page.goto(`/games/${game.id}`);
    await expect(page.getByRole('button', { name: /^availability$/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await page.getByRole('button', { name: /^availability$/i }).click();
    await page.getByRole('button', { name: /apply my default availability/i }).click();
    await expect(page.getByText(/filled in \d+ dates?/i)).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });

    // The pre-set date must survive unchanged (non-destructive): still 'maybe',
    // not overwritten by the Friday=Available default.
    expect(await availabilityStatusForDate(game.id, user.id, manualDate)).toBe('maybe');
    // And new future Fridays were filled, so the row count grew.
    expect(await availabilityRowsInGame(game.id, user.id)).toBeGreaterThan(rowsBefore);
  });
});
