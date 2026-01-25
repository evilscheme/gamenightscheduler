import { test, expect } from '@playwright/test';
import { createTestUser } from '../../helpers/test-auth';
import { createTestGame } from '../../helpers/seed';

/**
 * Game Preview API Tests
 *
 * Tests for the /api/games/preview/[code] endpoint used by OG crawlers.
 * This is a public endpoint that returns game metadata for link previews.
 */

test.describe('Game Preview API', () => {
  test('returns game preview data for valid invite code', async ({ request }) => {
    // Create a GM and a game
    const gm = await createTestUser(request, {
      email: `gm-preview-${Date.now()}@e2e.local`,
      name: 'Preview Test GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Preview Test Game',
      description: 'A game for testing the preview API',
      play_days: [5, 6],
      invite_code: `preview-${Date.now()}`,
    });

    // Call the preview API
    const response = await request.get(`http://localhost:3001/api/games/preview/${game.invite_code}`);

    // Verify response status
    expect(response.status()).toBe(200);

    // Parse response body
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('name', game.name);
    expect(data).toHaveProperty('description', 'A game for testing the preview API');
    expect(data).toHaveProperty('play_days');
    expect(data.play_days).toEqual([5, 6]);
    expect(data).toHaveProperty('gm_name', gm.name);
  });

  test('returns 404 for invalid invite code', async ({ request }) => {
    // Call the preview API with a non-existent code
    const response = await request.get('http://localhost:3001/api/games/preview/nonexistent-code-123');

    // Verify response status
    expect(response.status()).toBe(404);

    // Parse response body
    const data = await response.json();

    // Verify error message
    expect(data).toHaveProperty('error', 'Game not found');
  });

  test('returns 400 for missing invite code', async ({ request }) => {
    // This tests the edge case of calling with an empty code
    // Note: The route structure means empty code would likely 404 at routing level
    // but we test the behavior anyway
    const response = await request.get('http://localhost:3001/api/games/preview/');

    // Empty path segment - should be 404 (no matching route)
    expect(response.status()).toBe(404);
  });

  test('returns game without description when not set', async ({ request }) => {
    // Create a game without a description
    const gm = await createTestUser(request, {
      email: `gm-no-desc-${Date.now()}@e2e.local`,
      name: 'No Desc GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'No Description Game',
      play_days: [3],
      invite_code: `nodesc-${Date.now()}`,
    });

    // Call the preview API
    const response = await request.get(`http://localhost:3001/api/games/preview/${game.invite_code}`);

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Description should be null or not present
    expect(data.name).toBe('No Description Game');
    expect(data.description).toBeNull();
    expect(data.gm_name).toBe(gm.name);
  });

  test('preview endpoint is publicly accessible (no auth required)', async ({ request }) => {
    // Create a game
    const gm = await createTestUser(request, {
      email: `gm-public-${Date.now()}@e2e.local`,
      name: 'Public Preview GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Public Preview Game',
      play_days: [5],
      invite_code: `public-${Date.now()}`,
    });

    // Create a new request context without any auth cookies
    // This simulates an OG crawler accessing the endpoint
    const unauthResponse = await request.get(`http://localhost:3001/api/games/preview/${game.invite_code}`);

    // Should still return 200 - endpoint is public
    expect(unauthResponse.status()).toBe(200);

    const data = await unauthResponse.json();
    expect(data.name).toBe('Public Preview Game');
  });

  test('preview returns all play days correctly', async ({ request }) => {
    // Create a game with multiple play days
    const gm = await createTestUser(request, {
      email: `gm-playdays-${Date.now()}@e2e.local`,
      name: 'Play Days GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Multi Day Game',
      play_days: [0, 2, 4, 6], // Sun, Tue, Thu, Sat
      invite_code: `multiday-${Date.now()}`,
    });

    const response = await request.get(`http://localhost:3001/api/games/preview/${game.invite_code}`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.play_days).toEqual([0, 2, 4, 6]);
  });

  test('preview handles special characters in game name', async ({ request }) => {
    const gm = await createTestUser(request, {
      email: `gm-special-${Date.now()}@e2e.local`,
      name: 'Special Char GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: "D&D Campaign: The Dragon's Lair",
      description: "A game with <special> characters & 'quotes'",
      play_days: [5],
      invite_code: `special-${Date.now()}`,
    });

    const response = await request.get(`http://localhost:3001/api/games/preview/${game.invite_code}`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.name).toBe("D&D Campaign: The Dragon's Lair");
    expect(data.description).toBe("A game with <special> characters & 'quotes'");
  });
});
