import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, createGamePlayDate, setAvailability } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

/**
 * Get a future date string (YYYY-MM-DD) for the next occurrence of a given day-of-week.
 * dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
 */
function getNextDayOfWeek(dayOfWeek: number): string {
  const today = new Date();
  const daysUntil = (dayOfWeek - today.getDay() + 7) % 7 || 7;
  const target = new Date(today);
  target.setDate(today.getDate() + daysUntil);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get a future date N days from today.
 */
function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test.describe('Play Date Notes', () => {
  test.describe('GM Note Display on Calendar', () => {
    test('date with a note shows FileText icon on calendar', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-note-icon-${Date.now()}@e2e.local`,
        name: 'Note Icon GM',
        is_gm: true,
      });

      const futureDate = getFutureDate(5);

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Note Icon Game',
        play_days: [],
        ad_hoc_only: true,
      });

      // Add a play date with a note
      await createGamePlayDate(game.id, futureDate, 'Different location today');

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // The date cell should have a tooltip containing the GM note
      const dayButton = page.locator(`button[data-date="${futureDate}"]`);
      await expect(dayButton).toHaveAttribute('title', /GM note: Different location today/);
    });

    test('player can see note in tooltip on calendar', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-note-player-${Date.now()}@e2e.local`,
        name: 'Note Player GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-note-${Date.now()}@e2e.local`,
        name: 'Note Player',
        is_gm: false,
      });

      const futureDate = getFutureDate(6);

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Note Player Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await createGamePlayDate(game.id, futureDate, 'Only after 2pm');
      await addPlayerToGame(game.id, player.id);

      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // Player should see the GM note in the tooltip
      const dayButton = page.locator(`button[data-date="${futureDate}"]`);
      await expect(dayButton).toHaveAttribute('title', /GM note: Only after 2pm/);
    });
  });

  test.describe('GM Note Editing via Popover', () => {
    test('GM can add a note to a play date via the popover', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-note-add-${Date.now()}@e2e.local`,
        name: 'Add Note GM',
        is_gm: true,
      });

      // Use a regular game with a known play day
      const futurePlayDate = getNextDayOfWeek(5); // Next Friday

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Add Note Game',
        play_days: [5], // Friday
      });

      // Need to create a game_play_date entry for the note to attach to
      await createGamePlayDate(game.id, futurePlayDate);

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // First mark as available so the pencil icon shows
      const dayButton = page.locator(`button[data-date="${futurePlayDate}"]`);
      await dayButton.click();
      await expect(dayButton).toHaveAttribute('data-status', 'available');

      // Hover to reveal the pencil icon, then click it
      await dayButton.hover();
      const pencilIcon = dayButton.locator('span').filter({ has: page.locator('svg') }).last();
      await pencilIcon.click();

      // Popover should appear with "Date note" label
      await expect(page.getByText(/date note.*visible to all players/i)).toBeVisible();

      // Type a GM note
      const noteInput = page.locator('input[placeholder*="Only after 2pm"]');
      await noteInput.fill('Bring snacks!');

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // The tooltip on the date cell should now show the note
      await expect(dayButton).toHaveAttribute('title', /GM note: Bring snacks!/);
    });

    test('non-GM player sees existing note as read-only in popover', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-note-readonly-${Date.now()}@e2e.local`,
        name: 'Readonly Note GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-note-readonly-${Date.now()}@e2e.local`,
        name: 'Readonly Player',
        is_gm: false,
      });

      const futurePlayDate = getNextDayOfWeek(5); // Next Friday

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Readonly Note Game',
        play_days: [5], // Friday
      });

      // Add a note via seed
      await createGamePlayDate(game.id, futurePlayDate, 'Meet at Johns house');
      await addPlayerToGame(game.id, player.id);

      // Set player availability so they can open the popover
      await setAvailability(player.id, game.id, [
        { date: futurePlayDate, status: 'available' },
      ]);

      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // Open the note popover via pencil icon
      const dayButton = page.locator(`button[data-date="${futurePlayDate}"]`);
      await dayButton.hover();
      const pencilIcon = dayButton.locator('span').filter({ has: page.locator('svg') }).last();
      await pencilIcon.click();

      // Should see the GM note displayed (read-only, not editable)
      await expect(page.getByText('Meet at Johns house')).toBeVisible();

      // The GM note input should NOT exist (player sees text, not input)
      const noteInput = page.locator('input[placeholder*="Only after 2pm"]');
      await expect(noteInput).not.toBeVisible();
    });
  });

  test.describe('Notes in Scheduling Suggestions', () => {
    test('play date note appears in scheduling suggestions', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-note-sug-${Date.now()}@e2e.local`,
        name: 'Suggestions Note GM',
        is_gm: true,
      });

      const futureDate = getFutureDate(8);

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Suggestions Note Game',
        play_days: [],
        ad_hoc_only: true,
      });

      // Create play date with a note
      await createGamePlayDate(game.id, futureDate, 'Afternoon session only');

      // Set availability so the date appears in suggestions
      await setAvailability(gm.id, game.id, [
        { date: futureDate, status: 'available' },
      ]);

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /schedule/i }).click();

      // Wait for suggestions to load
      await expect(page.getByText(/date suggestions/i)).toBeVisible({
        timeout: TEST_TIMEOUTS.DEFAULT,
      });

      // The note text should appear in the suggestions (rendered as italic text)
      await expect(page.getByText('Afternoon session only')).toBeVisible();
    });
  });

  test.describe('Notes on Regular Game Play Dates', () => {
    test('GM can add notes to special play dates on regular games', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-note-special-${Date.now()}@e2e.local`,
        name: 'Special Note GM',
        is_gm: true,
      });

      // Get a Thursday (non-play day for a Friday game)
      const today = new Date();
      const daysUntilThursday = (4 - today.getDay() + 7) % 7 || 7;
      const thursday = new Date(today);
      thursday.setDate(today.getDate() + daysUntilThursday);
      const thursdayStr = `${thursday.getFullYear()}-${String(thursday.getMonth() + 1).padStart(2, '0')}-${String(thursday.getDate()).padStart(2, '0')}`;

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Special Note Game',
        play_days: [5], // Friday only
      });

      // Add a special play date with a note via seed
      await createGamePlayDate(game.id, thursdayStr, 'Extra session this week');

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // The special date should have the note in its tooltip
      const dayButton = page.locator(`button[data-date="${thursdayStr}"]`);
      await expect(dayButton).toHaveAttribute('data-special', 'true');
      await expect(dayButton).toHaveAttribute('title', /GM note: Extra session this week/);
    });
  });
});
