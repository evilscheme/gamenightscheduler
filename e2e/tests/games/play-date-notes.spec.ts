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
      const pencilIcon = dayButton.locator('[data-testid="edit-note-icon"]');
      await pencilIcon.click();

      // Popover should appear with "GM Note" section
      await expect(page.getByText(/gm note/i)).toBeVisible();

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
      const pencilIcon = dayButton.locator('[data-testid="edit-note-icon"]');
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
    test('GM can add notes to extra dates on regular games', async ({ page, request }) => {
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
      await expect(dayButton).toHaveAttribute('data-extra', 'true');
      await expect(dayButton).toHaveAttribute('title', /GM note: Extra session this week/);
    });
  });

  test.describe('Popover Edge Cases', () => {
    test('GM can open popover and add GM note without setting availability first', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-note-noavail-${Date.now()}@e2e.local`,
        name: 'No Avail GM',
        is_gm: true,
      });

      const futureDate = getFutureDate(4);

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'No Avail Note Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await createGamePlayDate(game.id, futureDate);

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // GM hovers and clicks pencil icon without having set availability
      const dayButton = page.locator(`button[data-date="${futureDate}"]`);
      await dayButton.hover();
      const pencilIcon = dayButton.locator('[data-testid="edit-note-icon"]');
      await pencilIcon.click();

      // Should see GM Note section
      await expect(page.getByText(/gm note/i)).toBeVisible();

      // Should NOT see Your Availability section (no availability set)
      await expect(page.getByText('Your Availability', { exact: true })).not.toBeVisible();

      // Should still have Cancel/Save (GM can edit the note)
      await expect(page.getByRole('button', { name: /save/i })).toBeVisible();

      // Add a GM note and save
      const noteInput = page.locator('input[placeholder*="Only after 2pm"]');
      await noteInput.fill('Game at park');
      await page.getByRole('button', { name: /save/i }).click();

      // The GM note should appear in the tooltip
      await expect(dayButton).toHaveAttribute('title', /GM note: Game at park/);

      // Availability should NOT have been set (no data-status change)
      await expect(dayButton).not.toHaveAttribute('data-status', 'available');
    });

    test('non-GM without availability sees read-only GM note with OK button', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-note-ok-${Date.now()}@e2e.local`,
        name: 'OK Button GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-note-ok-${Date.now()}@e2e.local`,
        name: 'OK Button Player',
        is_gm: false,
      });

      const futureDate = getFutureDate(5);

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'OK Button Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await createGamePlayDate(game.id, futureDate, 'Bring board games');
      await addPlayerToGame(game.id, player.id);

      // Player has availability set — click the GM note icon to open popover
      await setAvailability(player.id, game.id, [
        { date: futureDate, status: 'available' },
      ]);

      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // Click the bottom-left GM note icon
      const dayButton = page.locator(`button[data-date="${futureDate}"]`);
      const noteIcon = dayButton.locator('[data-testid="note-icons"]');
      await noteIcon.click();

      // Should see the GM note text (read-only)
      await expect(page.getByText('Bring board games')).toBeVisible();

      // Player has availability, so should see both sections and Cancel/Save
      await expect(page.getByText('Your Availability', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    });

    test('non-GM without availability sees only OK button to dismiss', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-note-dismiss-${Date.now()}@e2e.local`,
        name: 'Dismiss GM',
        is_gm: true,
      });

      const player = await createTestUser(request, {
        email: `player-note-dismiss-${Date.now()}@e2e.local`,
        name: 'Dismiss Player',
        is_gm: false,
      });

      const futurePlayDate = getNextDayOfWeek(5); // Next Friday

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Dismiss Game',
        play_days: [5], // Friday
      });

      await createGamePlayDate(game.id, futurePlayDate, 'Meet at the cafe');
      await addPlayerToGame(game.id, player.id);
      // Intentionally NOT setting availability for the player

      await loginTestUser(page, {
        email: player.email,
        name: player.name,
        is_gm: false,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // Click the bottom-left GM note icon (visible because there's a note)
      const dayButton = page.locator(`button[data-date="${futurePlayDate}"]`);
      const noteIcon = dayButton.locator('[data-testid="note-icons"]');
      await noteIcon.click();

      // Should see the GM note
      await expect(page.getByText('Meet at the cafe')).toBeVisible();

      // Should NOT see Your Availability section
      await expect(page.getByText('Your Availability', { exact: true })).not.toBeVisible();

      // Should see OK button, NOT Cancel/Save
      await expect(page.getByRole('button', { name: /^ok$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /save/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /cancel/i })).not.toBeVisible();

      // Clicking OK dismisses the popover
      await page.getByRole('button', { name: /^ok$/i }).click();
      await expect(page.getByText('Meet at the cafe')).not.toBeVisible();
    });

    test('date with both time constraint and GM note shows both icons', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-both-icons-${Date.now()}@e2e.local`,
        name: 'Both Icons GM',
        is_gm: true,
      });

      const futureDate = getFutureDate(6);

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Both Icons Game',
        play_days: [],
        ad_hoc_only: true,
      });

      // Create play date with a GM note
      await createGamePlayDate(game.id, futureDate, 'Afternoon only');

      // Set availability with a time constraint
      await setAvailability(gm.id, game.id, [
        { date: futureDate, status: 'available', available_after: '14:00' },
      ]);

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // The date should have both icons visible
      const dayButton = page.locator(`button[data-date="${futureDate}"]`);

      // Tooltip should contain both the time constraint and the GM note
      await expect(dayButton).toHaveAttribute('title', /After/);
      await expect(dayButton).toHaveAttribute('title', /GM note: Afternoon only/);

      // Both icons should be in the bottom-left area
      const bottomLeftIcons = dayButton.locator('[data-testid="note-icons"] > span');
      await expect(bottomLeftIcons).toHaveCount(2);
    });

    test('clicking bottom-left icons opens the editor popover', async ({ page, request }) => {
      const gm = await createTestUser(request, {
        email: `gm-icon-click-${Date.now()}@e2e.local`,
        name: 'Icon Click GM',
        is_gm: true,
      });

      const futureDate = getFutureDate(7);

      const game = await createTestGame({
        gm_id: gm.id,
        name: 'Icon Click Game',
        play_days: [],
        ad_hoc_only: true,
      });

      await createGamePlayDate(game.id, futureDate, 'Special location');
      await setAvailability(gm.id, game.id, [
        { date: futureDate, status: 'available' },
      ]);

      await loginTestUser(page, {
        email: gm.email,
        name: gm.name,
        is_gm: true,
      });

      await page.goto(`/games/${game.id}`);
      await page.getByRole('button', { name: /availability/i }).click();
      await expect(page.getByText(/mark your availability/i)).toBeVisible();

      // Click the bottom-left GM note icon (not the pencil)
      const dayButton = page.locator(`button[data-date="${futureDate}"]`);
      const bottomLeftIcon = dayButton.locator('[data-testid="note-indicator"]');
      await bottomLeftIcon.click();

      // The popover should open with both sections
      await expect(page.getByText(/gm note/i)).toBeVisible();
      await expect(page.getByText('Your Availability', { exact: true })).toBeVisible();

      // Should show the existing GM note text
      const noteInput = page.locator('input[placeholder*="Only after 2pm"]');
      await expect(noteInput).toHaveValue('Special location');
    });
  });
});
