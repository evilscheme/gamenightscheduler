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

/** Open a game and switch to its Availability tab. */
async function openAvailabilityTab(page: Page, gameId: string) {
  await page.goto(`/games/${gameId}`);
  // The game page renders tabs as plain buttons (not role="tab"); match the
  // tab by its exact accessible name so we don't also hit the "Apply my
  // default availability" button.
  await expect(page.getByRole('button', { name: /^availability$/i })).toBeVisible({
    timeout: TEST_TIMEOUTS.LONG,
  });
  await page.getByRole('button', { name: /^availability$/i }).click();
}

const applyButton = (page: Page) =>
  page.getByRole('button', { name: /apply my default availability/i });

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
    await openAvailabilityTab(page, game.id);

    await applyButton(page).click();
    await expect(page.getByText(/filled in \d+ dates?/i)).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    expect(await availabilityRowsInGame(game.id, user.id)).toBeGreaterThan(0);

    // Re-applying with UNCHANGED defaults has genuinely nothing to do: every
    // date now matches, so there's no conflict prompt either.
    await applyButton(page).click();
    await expect(page.getByText(/already applied/i)).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await expect(page.getByTestId('replace-defaults-modal')).toBeHidden();
  });

  test('apply never overwrites a pre-set date without asking first', async ({ page }) => {
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

    // Apply. The hand-set 'maybe' disagrees with Friday=Available, so the
    // apply stops and asks rather than silently overwriting it.
    await openAvailabilityTab(page, game.id);
    await applyButton(page).click();

    const modal = page.getByTestId('replace-defaults-modal');
    await expect(modal).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await expect(modal).toContainText(/1 date doesn't match your defaults/i);
    // Nothing is overwritten while the question is still open.
    expect(await availabilityStatusForDate(game.id, user.id, manualDate)).toBe('maybe');

    // Declining leaves the hand-set date exactly as it was...
    await page.getByRole('button', { name: 'Keep them' }).click();
    await expect(modal).toBeHidden({ timeout: TEST_TIMEOUTS.DEFAULT });
    expect(await availabilityStatusForDate(game.id, user.id, manualDate)).toBe('maybe');
    // ...while the blank Fridays from the same pass were still filled.
    await expect(page.getByText(/filled in \d+ dates?/i)).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    expect(await availabilityRowsInGame(game.id, user.id)).toBeGreaterThan(rowsBefore);
  });

  test('editing defaults and re-applying replaces the dates the old defaults wrote', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `default-edit-${Date.now()}@e2e.local`,
      name: 'Edit Defaults User',
      is_gm: true,
    });
    const game = await createTestGame({ gm_id: user.id, name: 'Edit Defaults Game', play_days: [5] });
    const firstFriday = getPlayDates([5], 2)[0];

    // Friday = Available, applied to the game.
    await page.goto('/settings/default-availability');
    await expect(page.getByRole('heading', { name: /default availability/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await setDefault(page, 'friday', 'available');
    await saveDefaults(page);

    await openAvailabilityTab(page, game.id);
    await applyButton(page).click();
    await expect(page.getByText(/filled in \d+ dates?/i)).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    expect(await availabilityStatusForDate(game.id, user.id, firstFriday)).toBe('available');

    // Change your mind: Fridays are now Unavailable.
    await page.goto('/settings/default-availability');
    await expect(page.getByRole('heading', { name: /default availability/i })).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
    await setDefault(page, 'friday', 'unavailable');
    await saveDefaults(page);

    // Re-applying offers to replace the dates the OLD default wrote — this is
    // the case that used to dead-end on "already applied".
    await openAvailabilityTab(page, game.id);
    await applyButton(page).click();

    const modal = page.getByTestId('replace-defaults-modal');
    await expect(modal).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await expect(page.getByText(/already applied/i)).toBeHidden();

    await page.getByTestId('replace-defaults-confirm').click();
    await expect(page.getByText(/replaced \d+ dates?/i)).toBeVisible({ timeout: TEST_TIMEOUTS.DEFAULT });
    await expect(modal).toBeHidden();

    // The edited default actually reached the calendar.
    await expect
      .poll(() => availabilityStatusForDate(game.id, user.id, firstFriday), {
        timeout: TEST_TIMEOUTS.DEFAULT,
      })
      .toBe('unavailable');
  });

  test('editor back link returns to the game when opened from a game', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `default-back-${Date.now()}@e2e.local`,
      name: 'Back Link User',
      is_gm: true,
    });
    const game = await createTestGame({ gm_id: user.id, name: 'Back Link Game', play_days: [5] });

    await openAvailabilityTab(page, game.id);

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
    await expect(applyButton(page)).toBeVisible({ timeout: TEST_TIMEOUTS.LONG });
  });

  test('Apply button is disabled with a "Set up defaults" link until defaults are saved', async ({ page }) => {
    const user = await loginTestUser(page, {
      email: `default-none-${Date.now()}@e2e.local`,
      name: 'No Defaults User',
      is_gm: true,
    });
    const game = await createTestGame({ gm_id: user.id, name: 'No Defaults Game', play_days: [5] });

    await openAvailabilityTab(page, game.id);

    await expect(applyButton(page)).toBeDisabled();
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

    await expect(applyButton(page)).toBeEnabled({ timeout: TEST_TIMEOUTS.LONG });
    await expect(page.getByRole('link', { name: 'Edit defaults' })).toBeVisible();
  });
});
