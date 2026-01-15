import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Game Edit Page', () => {
  test('GM sees edit button on game detail page', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-edit-btn-${Date.now()}@e2e.local`,
      name: 'Edit Button GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Edit Button Campaign',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /edit button campaign/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Should see Edit button
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible();
  });

  test('player does not see edit button', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-no-edit-${Date.now()}@e2e.local`,
      name: 'No Edit GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-no-edit-${Date.now()}@e2e.local`,
      name: 'No Edit Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'No Edit Campaign',
      play_days: [5, 6],
    });

    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /no edit campaign/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Should NOT see Edit button
    await expect(page.getByRole('button', { name: /^edit$/i })).not.toBeVisible();
  });

  test('GM can navigate to edit page', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-nav-edit-${Date.now()}@e2e.local`,
      name: 'Nav Edit GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Nav Edit Campaign',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click Edit button
    await page.getByRole('button', { name: /^edit$/i }).click();

    // Should navigate to edit page
    await expect(page).toHaveURL(new RegExp(`/games/${game.id}/edit`));

    // Should see edit form
    await expect(page.getByRole('heading', { name: /edit game/i })).toBeVisible();
  });

  test('edit page is pre-populated with game data', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-prepop-${Date.now()}@e2e.local`,
      name: 'Prepop GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Prepopulated Campaign',
      description: 'Test description for prepop',
      play_days: [1, 3, 5], // Mon, Wed, Fri
      scheduling_window_months: 3,
      default_start_time: '19:00',
      default_end_time: '23:00',
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}/edit`);

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /edit game/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Check name is pre-populated
    const nameInput = page.getByPlaceholder(/curse of strahd/i);
    await expect(nameInput).toHaveValue('Prepopulated Campaign');

    // Check description is pre-populated
    const descInput = page.getByPlaceholder(/brief description/i);
    await expect(descInput).toHaveValue('Test description for prepop');

    // Check play days are selected (Mon, Wed, Fri should have active styling)
    await expect(page.getByRole('button', { name: 'Monday' })).toHaveClass(/bg-primary/);
    await expect(page.getByRole('button', { name: 'Wednesday' })).toHaveClass(/bg-primary/);
    await expect(page.getByRole('button', { name: 'Friday' })).toHaveClass(/bg-primary/);

    // Check scheduling window
    await expect(page.getByRole('combobox')).toHaveValue('3');

    // Check default times
    const startTimeInput = page.locator('input[type="time"]').first();
    const endTimeInput = page.locator('input[type="time"]').last();
    await expect(startTimeInput).toHaveValue('19:00');
    await expect(endTimeInput).toHaveValue('23:00');
  });

  test('GM can update game settings', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-update-${Date.now()}@e2e.local`,
      name: 'Update GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Original Campaign Name',
      play_days: [5],
      default_start_time: '18:00',
      default_end_time: '22:00',
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}/edit`);

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /edit game/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Update the name
    const nameInput = page.getByPlaceholder(/curse of strahd/i);
    await nameInput.clear();
    await nameInput.fill('Updated Campaign Name');

    // Update play days - add Saturday
    await page.getByRole('button', { name: 'Saturday' }).click();

    // Update default times
    const startTimeInput = page.locator('input[type="time"]').first();
    const endTimeInput = page.locator('input[type="time"]').last();
    await startTimeInput.fill('20:00');
    await endTimeInput.fill('00:00');

    // Save changes
    await page.getByRole('button', { name: /save changes/i }).click();

    // Should redirect back to game detail page
    await expect(page).toHaveURL(new RegExp(`/games/${game.id}$`));

    // Verify changes are reflected
    await expect(page.getByRole('heading', { name: /updated campaign name/i })).toBeVisible();
    await expect(page.getByText(/8:00 PM - 12:00 AM/)).toBeVisible();
  });

  test('non-GM is redirected from edit page', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-redirect-${Date.now()}@e2e.local`,
      name: 'Redirect GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-redirect-${Date.now()}@e2e.local`,
      name: 'Redirect Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Redirect Campaign',
      play_days: [5],
    });

    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    // Try to access edit page directly
    await page.goto(`/games/${game.id}/edit`);

    // Should be redirected to game detail page (not edit page)
    await expect(page).toHaveURL(new RegExp(`/games/${game.id}$`), { timeout: TEST_TIMEOUTS.LONG });

    // Should NOT see the edit form
    await expect(page.getByRole('heading', { name: /edit game/i })).not.toBeVisible();
  });

  test('cancel button returns to game detail', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cancel-${Date.now()}@e2e.local`,
      name: 'Cancel GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Cancel Campaign',
      play_days: [5],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}/edit`);

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /edit game/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click Cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Should return to game detail page
    await expect(page).toHaveURL(new RegExp(`/games/${game.id}$`));
  });

  test('shows validation error when play days deselected', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-validate-${Date.now()}@e2e.local`,
      name: 'Validate GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Validate Campaign',
      play_days: [5], // Only Friday
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}/edit`);

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /edit game/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Deselect Friday (the only play day)
    await page.getByRole('button', { name: 'Friday' }).click();

    // Try to save
    await page.getByRole('button', { name: /save changes/i }).click();

    // Should show validation error
    await expect(page.getByText(/please select at least one play day/i)).toBeVisible();
  });
});
