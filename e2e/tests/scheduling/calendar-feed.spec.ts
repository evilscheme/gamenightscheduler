import { test, expect } from '@playwright/test';
import { createTestUser } from '../../helpers/test-auth';
import { createTestGame, createTestSession, getPlayDates } from '../../helpers/seed';

test.describe('Calendar Subscription Feed', () => {
  test('returns valid ICS for game with confirmed sessions', async ({ request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cal-feed-${Date.now()}@e2e.local`,
      name: 'Calendar Feed GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Calendar Feed Campaign',
      play_days: [5, 6],
      default_start_time: '18:00',
      default_end_time: '22:00',
    });

    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '23:00',
    });

    // Fetch the calendar feed directly
    const response = await request.get(`/api/games/calendar/${game.invite_code}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');

    const icsContent = await response.text();

    // Verify iCalendar structure
    expect(icsContent).toContain('BEGIN:VCALENDAR');
    expect(icsContent).toContain('END:VCALENDAR');
    expect(icsContent).toContain('VERSION:2.0');
    expect(icsContent).toContain('BEGIN:VEVENT');
    expect(icsContent).toContain('END:VEVENT');

    // Verify event details
    expect(icsContent).toContain('Calendar Feed Campaign');
    expect(icsContent).toMatch(/DTSTART/);
    expect(icsContent).toMatch(/DTEND/);
  });

  test('returns empty calendar for game with no confirmed sessions', async ({ request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cal-empty-${Date.now()}@e2e.local`,
      name: 'Calendar Empty GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Empty Calendar Campaign',
      play_days: [5, 6],
    });

    const response = await request.get(`/api/games/calendar/${game.invite_code}`);

    expect(response.status()).toBe(200);

    const icsContent = await response.text();

    // Should be valid but empty calendar
    expect(icsContent).toContain('BEGIN:VCALENDAR');
    expect(icsContent).toContain('END:VCALENDAR');
    expect(icsContent).not.toContain('BEGIN:VEVENT');
  });

  test('returns 404 for invalid invite code', async ({ request }) => {
    const response = await request.get('/api/games/calendar/invalid-code-123');

    expect(response.status()).toBe(404);
  });

  test('includes multiple sessions in feed', async ({ request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cal-multi-${Date.now()}@e2e.local`,
      name: 'Calendar Multi GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Multi Session Campaign',
      play_days: [5, 6],
    });

    const playDates = getPlayDates([5, 6], 4);

    // Create multiple sessions
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
    await createTestSession({
      game_id: game.id,
      date: playDates[2],
      confirmed_by: gm.id,
    });

    const response = await request.get(`/api/games/calendar/${game.invite_code}`);

    expect(response.status()).toBe(200);

    const icsContent = await response.text();

    // Count VEVENT occurrences (should be 3)
    const eventCount = (icsContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(3);
  });

  test('uses default times when session has no times', async ({ request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cal-default-${Date.now()}@e2e.local`,
      name: 'Calendar Default GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Default Times Campaign',
      play_days: [5, 6],
      default_start_time: '20:00',
      default_end_time: '00:00',
    });

    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '20:00',
      end_time: '00:00',
    });

    const response = await request.get(`/api/games/calendar/${game.invite_code}`);

    expect(response.status()).toBe(200);

    const icsContent = await response.text();

    // Should contain timed event with default times (200000 = 20:00:00)
    expect(icsContent).toMatch(/DTSTART.*T200000/);
  });

  test('has correct content-disposition header', async ({ request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cal-header-${Date.now()}@e2e.local`,
      name: 'Calendar Header GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Test Game!@#$',
      play_days: [5, 6],
    });

    const response = await request.get(`/api/games/calendar/${game.invite_code}`);

    expect(response.status()).toBe(200);

    const contentDisposition = response.headers()['content-disposition'];
    expect(contentDisposition).toContain('attachment');
    expect(contentDisposition).toContain('.ics');
    // Should sanitize special characters in filename
    expect(contentDisposition).toMatch(/Test_Game/);
  });

  test('includes timezone TZID when game has timezone set', async ({ request }) => {
    const gm = await createTestUser(request, {
      email: `gm-cal-tz-${Date.now()}@e2e.local`,
      name: 'Calendar Timezone GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Timezone Campaign',
      play_days: [5, 6],
      default_start_time: '18:00',
      default_end_time: '22:00',
      timezone: 'Europe/London',
    });

    const playDates = getPlayDates([5, 6], 4);
    await createTestSession({
      game_id: game.id,
      date: playDates[0],
      confirmed_by: gm.id,
      start_time: '19:00',
      end_time: '23:00',
    });

    const response = await request.get(`/api/games/calendar/${game.invite_code}`);

    expect(response.status()).toBe(200);

    const icsContent = await response.text();

    // Should include TZID parameter
    expect(icsContent).toContain('TZID=Europe/London');
    expect(icsContent).toMatch(/DTSTART;TZID=Europe\/London:/);
    expect(icsContent).toMatch(/DTEND;TZID=Europe\/London:/);
  });
});
