import { test, expect, type Page } from '@playwright/test';
import { loginTestUser } from '../../helpers/test-auth';
import { createTestGame, getPlayDates, setAvailability } from '../../helpers/seed';
import { availabilityRowsInGame, availabilityStatusForDate } from '../../helpers/db-assertions';
import { TEST_TIMEOUTS } from '../../constants';

/** Select a weekday default status (local state only; persisted on Save). */
async function setDefault(page: Page, day: string, value: string) {
  const button = page.locator(`[data-testid="status-${day}-${value}"]:visible`);
  await button.click();
  await expect(button).toHaveAttribute('aria-checked', 'true', { timeout: TEST_TIMEOUTS.DEFAULT });
}

/** Click the editor's Save button and wait for the success confirmation. */
async function saveDefaults(page: Page) {
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Default availability saved!')).toBeVisible({
    timeout: TEST_TIMEOUTS.DEFAULT,
  });
}

test.describe('Default availability', () => {
  test('set defaults in settings, then apply them to a game', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `default-avail-${Date.now()}@e2e.local`,
      name: 'Default Avail User',
      is_gm: true,
    });

    const game = await createTestGame({ gm_id: user.id, name: 'Defaults Game', play_days: [3, 5] });

    // Configure defaults in the editor, then save.
    await page.goto('/settings/default-availability');
    await expect(page.getByRole('heading', { name: /default availability/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await setDefault(page, 'friday', 'available');
    await setDefault(page, 'wednesday', 'unavailable');
    await saveDefaults(page);

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

    // Default: Friday = Available, then save.
    await page.goto('/settings/default-availability');
    await expect(page.getByRole('heading', { name: /default availability/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await setDefault(page, 'friday', 'available');
    await saveDefaults(page);

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

  test('editor back link returns to the game when opened from a game', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `default-back-${Date.now()}@e2e.local`,
      name: 'Back Link User',
      is_gm: true,
    });
    const game = await createTestGame({ gm_id: user.id, name: 'Back Link Game', play_days: [5] });

    await page.goto(`/games/${game.id}`);
    await expect(page.getByRole('button', { name: /^availability$/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await page.getByRole('button', { name: /^availability$/i }).click();

    // Open the editor via the defaults link on the Availability tab. This is a
    // fresh game with no saved defaults yet, so the link reads "Set up defaults".
    await page.getByRole('link', { name: 'Set up defaults' }).click();
    await expect(page).toHaveURL(/\/settings\/default-availability\?returnTo=/, { timeout: TEST_TIMEOUTS.DEFAULT });

    // The back link returns to the game's Availability tab (not Settings, and
    // not the Overview tab).
    const backLink = page.getByRole('link', { name: /back to game/i });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', `/games/${game.id}?tab=availability`);
    await backLink.click();
    // Landing back on the Availability tab: the apply button only renders there.
    await expect(page.getByRole('button', { name: /apply my default availability/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });

  test('Apply button is disabled with a "Set up defaults" link until defaults are saved', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `default-none-${Date.now()}@e2e.local`,
      name: 'No Defaults User',
      is_gm: true,
    });
    const game = await createTestGame({ gm_id: user.id, name: 'No Defaults Game', play_days: [5] });

    await page.goto(`/games/${game.id}`);
    await expect(page.getByRole('button', { name: /^availability$/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await page.getByRole('button', { name: /^availability$/i }).click();

    await expect(page.getByRole('button', { name: /apply my default availability/i })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Set up defaults' })).toBeVisible();

    // Set defaults, then confirm the button flips to enabled with "Edit defaults".
    // Use the editor's "Back to game" link (not browser back) — it round-trips
    // through the `returnTo` query param to land back on the Availability tab
    // specifically; the tab switch itself doesn't change the URL, so a plain
    // back-navigation would land on the default tab instead.
    await page.getByRole('link', { name: 'Set up defaults' }).click();
    await expect(page.getByRole('heading', { name: /default availability/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await setDefault(page, 'friday', 'available');
    await saveDefaults(page);
    await page.getByRole('link', { name: /back to game/i }).click();

    await expect(page.getByRole('button', { name: /apply my default availability/i })).toBeEnabled({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await expect(page.getByRole('link', { name: 'Edit defaults' })).toBeVisible();
  });
});
