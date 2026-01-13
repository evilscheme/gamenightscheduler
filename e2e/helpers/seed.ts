import { createClient } from '@supabase/supabase-js';

/**
 * Database seeding helpers for E2E tests.
 *
 * These functions use the Supabase admin client (service role key)
 * to directly manipulate the database, bypassing RLS policies.
 *
 * Use these for setting up test data fixtures.
 */

// Local Supabase CLI credentials (from `supabase status`)
// Note: Use localhost instead of 127.0.0.1 to avoid CORS issues in browser
const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export interface TestGame {
  id: string;
  name: string;
  gm_id: string;
  invite_code: string;
  play_days: number[];
  scheduling_window_months: number;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  is_gm: boolean;
}

/**
 * Create a game directly in the database (bypasses UI).
 * Use this for setting up test fixtures.
 */
export async function createTestGame(options: {
  gm_id: string;
  name?: string;
  invite_code?: string;
  play_days?: number[];
  scheduling_window_months?: number;
  description?: string;
}): Promise<TestGame> {
  const admin = getAdminClient();

  const gameData = {
    name: options.name || `Test Game ${Date.now()}`,
    gm_id: options.gm_id,
    invite_code: options.invite_code || `test-${Date.now().toString(36)}`,
    play_days: options.play_days || [5, 6], // Friday, Saturday
    scheduling_window_months: options.scheduling_window_months || 2,
    description: options.description || null,
  };

  const { data, error } = await admin.from('games').insert(gameData).select().single();

  if (error) {
    throw new Error(`Failed to create test game: ${error.message}`);
  }

  return data as TestGame;
}

/**
 * Add a player to a game (create membership).
 */
export async function addPlayerToGame(
  gameId: string,
  userId: string
): Promise<void> {
  const admin = getAdminClient();

  const { error } = await admin
    .from('game_memberships')
    .insert({ game_id: gameId, user_id: userId });

  if (error && !error.message.includes('duplicate')) {
    throw new Error(`Failed to add player to game: ${error.message}`);
  }
}

/**
 * Set availability for a user on specific dates.
 */
export async function setAvailability(
  userId: string,
  gameId: string,
  dates: { date: string; is_available: boolean }[]
): Promise<void> {
  const admin = getAdminClient();

  const availabilityData = dates.map((d) => ({
    user_id: userId,
    game_id: gameId,
    date: d.date,
    is_available: d.is_available,
  }));

  const { error } = await admin
    .from('availability')
    .upsert(availabilityData, { onConflict: 'user_id,game_id,date' });

  if (error) {
    throw new Error(`Failed to set availability: ${error.message}`);
  }
}

/**
 * Create a confirmed session for a game.
 */
export async function createTestSession(options: {
  game_id: string;
  date: string;
  confirmed_by: string;
  start_time?: string;
  end_time?: string;
}): Promise<{ id: string }> {
  const admin = getAdminClient();

  const sessionData = {
    game_id: options.game_id,
    date: options.date,
    status: 'confirmed' as const,
    confirmed_by: options.confirmed_by,
    start_time: options.start_time || '18:00',
    end_time: options.end_time || '22:00',
  };

  const { data, error } = await admin
    .from('sessions')
    .insert(sessionData)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create test session: ${error.message}`);
  }

  return data;
}

/**
 * Get a game by invite code.
 */
export async function getGameByInviteCode(
  inviteCode: string
): Promise<TestGame | null> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('games')
    .select('*')
    .eq('invite_code', inviteCode)
    .single();

  if (error) {
    return null;
  }

  return data as TestGame;
}

/**
 * Delete all data from the database (for cleanup between tests).
 * Deletes in reverse dependency order.
 */
export async function cleanDatabase(): Promise<void> {
  const admin = getAdminClient();

  // Delete in dependency order (reverse of creation)
  const tables = [
    'sessions',
    'availability',
    'game_memberships',
    'games',
    // Note: Don't delete users here - they're managed by auth
  ];

  for (const table of tables) {
    const { error } = await admin.from(table).delete().neq('id', '');
    if (error) {
      console.warn(`Warning: Failed to clean ${table}: ${error.message}`);
    }
  }
}

/**
 * Delete all test auth users (emails containing 'test').
 * Call this in global teardown.
 */
export async function cleanTestUsers(): Promise<void> {
  const admin = getAdminClient();

  const { data: users } = await admin.auth.admin.listUsers();

  if (!users?.users) return;

  const testUsers = users.users.filter(
    (u) => u.email?.includes('test') || u.email?.includes('@e2e.')
  );

  for (const user of testUsers) {
    await admin.auth.admin.deleteUser(user.id);
  }
}

/**
 * Check if Supabase is running and accessible.
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const admin = getAdminClient();
    const { error } = await admin.from('users').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get dates for the next N weeks that fall on specified play days.
 * Useful for setting up availability test data.
 */
export function getPlayDates(
  playDays: number[],
  weeks: number = 4
): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfWeek = date.getDay();

    if (playDays.includes(dayOfWeek)) {
      dates.push(date.toISOString().split('T')[0]);
    }
  }

  return dates;
}
