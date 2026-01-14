import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import { createTestGame, createTestSession, getPlayDates } from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Session Export', () => {
  test('export single session downloads .ics file', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-export-single-${Date.now()}@e2e.local`,
      name: 'Export Single GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Export Single Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '18:00',
      end_time: '22:00',
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.getByText(/confirmed sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download');

    // Click the individual export button (not "Export All")
    // The individual export button just says "Export"
    const exportButton = page.getByRole('button', { name: /^export$/i }).first();
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // Wait for and verify the download
    const download = await downloadPromise;

    // Filename should end with .ics
    expect(download.suggestedFilename()).toMatch(/\.ics$/);

    // Filename should contain the game name (slugified)
    expect(download.suggestedFilename().toLowerCase()).toContain('export-single-campaign');
  });

  test('export all sessions downloads .ics file', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-export-all-${Date.now()}@e2e.local`,
      name: 'Export All GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Export All Campaign',
      play_days: [5, 6],
    });

    // Create multiple confirmed sessions
    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
    });
    await createTestSession({
      game_id: game.id,
      date: playDates[1],
      confirmed_by: gm.id,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.getByText(/confirmed sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click "Export All (.ics)" button
    const exportAllButton = page.getByRole('button', { name: /export all/i });
    await expect(exportAllButton).toBeVisible();
    await exportAllButton.click();

    // Wait for and verify the download
    const download = await downloadPromise;

    // Filename should end with .ics and contain "sessions"
    expect(download.suggestedFilename()).toMatch(/\.ics$/);
    expect(download.suggestedFilename()).toContain('sessions');
  });

  test('.ics file content is valid iCalendar format', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-export-valid-${Date.now()}@e2e.local`,
      name: 'Export Valid GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Valid ICS Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '23:00',
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);

    // Wait for page to load before interacting
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.getByText(/confirmed sessions/i)).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /^export$/i }).first().click();

    const download = await downloadPromise;

    // Read the file content
    const content = await (await download.createReadStream()).toArray();
    const icsContent = Buffer.concat(content).toString('utf-8');

    // Verify iCalendar format structure
    expect(icsContent).toContain('BEGIN:VCALENDAR');
    expect(icsContent).toContain('END:VCALENDAR');
    expect(icsContent).toContain('BEGIN:VEVENT');
    expect(icsContent).toContain('END:VEVENT');

    // Should contain the game name as event title
    expect(icsContent).toContain('Valid ICS Campaign');

    // Should contain DTSTART and DTEND for timed events
    expect(icsContent).toMatch(/DTSTART/);
    expect(icsContent).toMatch(/DTEND/);
  });
});
