import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, addPlayerToGame, getAdminClient } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Game Detail Page', () => {
  test('shows game overview with tabs', async ({ page, request }) => {
    // Create a GM and a game
    const gm = await createTestUser(request, {
      email: `gm-detail-${Date.now()}@e2e.local`,
      name: 'Detail Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Detail Test Campaign',
      description: 'A campaign for testing details',
      play_days: [5, 6],
    });

    // Login as GM
    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    // Navigate to game detail page
    await page.goto(`/games/${game.id}`);
    
    // Should see game name (wait for profile + data to load)
    await expect(page.getByRole('heading', { name: /detail test campaign/i })).toBeVisible();

    // Should see tabs
    await expect(page.getByRole('button', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
  });

  test('shows invite link for GM', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-invite-${Date.now()}@e2e.local`,
      name: 'Invite Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Invite Test Campaign',
      invite_code: `invite-test-${Date.now()}`,
      play_days: [5],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);
    
    // Should see copy invite link button (wait for page to load)
    await expect(page.getByRole('button', { name: /copy invite link/i })).toBeVisible();
  });

  test('player can view game they are member of', async ({ page, request }) => {
    // Create GM and game
    const gm = await createTestUser(request, {
      email: `gm-player-view-${Date.now()}@e2e.local`,
      name: 'Player View GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Player View Campaign',
      play_days: [5, 6],
    });

    // Create player and add to game
    const player = await createTestUser(request, {
      email: `player-view-${Date.now()}@e2e.local`,
      name: 'Viewing Player',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    // Login as player
    await loginTestUser(page, {
      email: player.email,
      name: player.name,
      is_gm: false,
    });

    await page.goto(`/games/${game.id}`);
    
    // Should see game name (wait for page to load)
    await expect(page.getByRole('heading', { name: /player view campaign/i })).toBeVisible();
  });

  test('switching tabs works', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-tabs-${Date.now()}@e2e.local`,
      name: 'Tabs Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Tabs Test Campaign',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);
    
    // Wait for page to load first
    await expect(page.getByRole('button', { name: /availability/i })).toBeVisible();

    // Click Availability tab
    await page.getByRole('button', { name: /availability/i }).click();

    // Should see availability content
    await expect(page.getByText(/mark your availability/i)).toBeVisible();

    // Click Schedule tab
    await page.getByRole('button', { name: /schedule/i }).click();

    // Should see scheduling content
    await expect(page.getByText(/date suggestions/i)).toBeVisible();
  });

  test('shows member list', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-members-${Date.now()}@e2e.local`,
      name: 'Members Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Members Test Campaign',
      play_days: [5],
    });

    // Add a player
    const player = await createTestUser(request, {
      email: `player-member-${Date.now()}@e2e.local`,
      name: 'Test Player Member',
      is_gm: false,
    });
    await addPlayerToGame(game.id, player.id);

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Should show both GM and player in members list (wait for page to load)
    // Use the member list section specifically to avoid matching navbar
    await expect(page.getByRole('list').getByText(/members test gm/i)).toBeVisible();
    await expect(page.getByRole('list').getByText(/test player member/i)).toBeVisible();
  });

  test('shows calendar subscription button', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-calendar-${Date.now()}@e2e.local`,
      name: 'Calendar Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Calendar Test Campaign',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Should see calendar subscription section in Game Details
    await expect(page.getByText(/calendar subscription/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /copy calendar url/i })).toBeVisible();
  });
});

test.describe('Regenerate Invite Code', () => {
  test('GM sees Regenerate Invite button', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-regen-view-${Date.now()}@e2e.local`,
      name: 'Regen View GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Regen View Game',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    await expect(page.getByRole('button', { name: /regenerate invite/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
  });

  test('player does not see Regenerate Invite button', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-regen-hidden-${Date.now()}@e2e.local`,
      name: 'Regen Hidden GM',
      is_gm: true,
    });

    const player = await createTestUser(request, {
      email: `player-regen-hidden-${Date.now()}@e2e.local`,
      name: 'Regen Hidden Player',
      is_gm: false,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Regen Hidden Game',
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
    await expect(page.getByRole('heading', { name: /regen hidden game/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Player should NOT see Regenerate Invite button
    await expect(page.getByRole('button', { name: /regenerate invite/i })).not.toBeVisible();
  });

  test('GM can regenerate invite code via confirmation modal', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-regen-${Date.now()}@e2e.local`,
      name: 'Regen GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Regen Test Game',
      play_days: [5, 6],
    });

    const originalInviteCode = game.invite_code;

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load
    await expect(page.getByRole('button', { name: /regenerate invite/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click Regenerate Invite button
    await page.getByRole('button', { name: /regenerate invite/i }).click();

    // Confirmation modal should appear
    await expect(page.getByText(/regenerate invite code\?/i)).toBeVisible();
    await expect(page.getByText(/invalidate the current invite link/i)).toBeVisible();

    // Click Regenerate confirm button
    await page.getByRole('button', { name: /^regenerate$/i }).click();

    // Modal should close
    await expect(page.getByText(/regenerate invite code\?/i)).not.toBeVisible();

    // Verify the invite code changed in the database
    const admin = getAdminClient();
    const { data: updatedGame } = await admin
      .from('games')
      .select('invite_code')
      .eq('id', game.id)
      .single();

    expect(updatedGame?.invite_code).not.toBe(originalInviteCode);
    expect(updatedGame?.invite_code).toBeTruthy();
  });

  test('GM can cancel invite code regeneration', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-regen-cancel-${Date.now()}@e2e.local`,
      name: 'Regen Cancel GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Regen Cancel Game',
      play_days: [5, 6],
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load
    await expect(page.getByRole('button', { name: /regenerate invite/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Click Regenerate Invite button
    await page.getByRole('button', { name: /regenerate invite/i }).click();

    // Modal should appear
    await expect(page.getByText(/regenerate invite code\?/i)).toBeVisible();

    // Click Cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Modal should close
    await expect(page.getByText(/regenerate invite code\?/i)).not.toBeVisible();

    // Still on game page
    await expect(page.getByText('Regen Cancel Game')).toBeVisible();
  });
});
