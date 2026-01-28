import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import * as path from 'path';

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

export function getAdminClient() {
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
  special_play_dates: string[];
  scheduling_window_months: number;
  default_start_time: string | null;
  default_end_time: string | null;
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
  special_play_dates?: string[];
  scheduling_window_months?: number;
  description?: string;
  default_start_time?: string;
  default_end_time?: string;
}): Promise<TestGame> {
  const admin = getAdminClient();

  const gameData = {
    name: options.name || `Test Game ${Date.now()}`,
    gm_id: options.gm_id,
    invite_code: options.invite_code || `test-${Date.now().toString(36)}`,
    play_days: options.play_days || [5, 6], // Friday, Saturday
    special_play_dates: options.special_play_dates || [],
    scheduling_window_months: options.scheduling_window_months || 2,
    description: options.description || null,
    default_start_time: options.default_start_time || '18:00',
    default_end_time: options.default_end_time || '22:00',
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
 * Set co-GM status for a player in a game.
 */
export async function setCoGmStatus(
  gameId: string,
  userId: string,
  isCoGm: boolean
): Promise<void> {
  const admin = getAdminClient();

  const { error } = await admin
    .from('game_memberships')
    .update({ is_co_gm: isCoGm })
    .eq('game_id', gameId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to set co-GM status: ${error.message}`);
  }
}

/**
 * Update special play dates for a game.
 */
export async function setSpecialPlayDates(
  gameId: string,
  specialPlayDates: string[]
): Promise<void> {
  const admin = getAdminClient();

  const { error } = await admin
    .from('games')
    .update({ special_play_dates: specialPlayDates })
    .eq('id', gameId);

  if (error) {
    throw new Error(`Failed to set special play dates: ${error.message}`);
  }
}

/**
 * Set availability for a user on specific dates.
 * Supports both old boolean format (is_available) and new status format.
 */
export async function setAvailability(
  userId: string,
  gameId: string,
  dates: { date: string; is_available?: boolean; status?: 'available' | 'unavailable' | 'maybe'; comment?: string; available_after?: string; available_until?: string }[]
): Promise<void> {
  const admin = getAdminClient();

  const availabilityData = dates.map((d) => ({
    user_id: userId,
    game_id: gameId,
    date: d.date,
    // Support both old is_available and new status format
    status: d.status ?? (d.is_available ? 'available' : 'unavailable'),
    comment: d.comment ?? null,
    available_after: d.available_after ?? null,
    available_until: d.available_until ?? null,
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
 *
 * IMPORTANT: Uses local date format (YYYY-MM-DD) to match the calendar UI,
 * not UTC/ISO format.
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
      // Use local date format (YYYY-MM-DD) to match the calendar's date-fns format
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
}

/**
 * Get dates from N weeks ago that fall on specified play days.
 * Useful for setting up past session test data.
 *
 * IMPORTANT: Uses local date format (YYYY-MM-DD) to match the calendar UI,
 * not UTC/ISO format.
 */
export function getPastPlayDates(
  playDays: number[],
  weeks: number = 4
): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 1; i <= weeks * 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dayOfWeek = date.getDay();

    if (playDays.includes(dayOfWeek)) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
}

// Docker container name for local Supabase
const SUPABASE_DB_CONTAINER = 'supabase_db_dndscheduler';

/**
 * Check if Supabase Docker container is running.
 */
export function isSupabaseRunning(): boolean {
  try {
    const result = execSync(`docker ps --filter "name=${SUPABASE_DB_CONTAINER}" --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim() === SUPABASE_DB_CONTAINER;
  } catch {
    return false;
  }
}

/**
 * Reset the database schema by dropping all tables and reapplying schema.sql.
 * This ensures tests always run against a fresh, known-good schema.
 */
export function resetDatabaseSchema(): void {
  const schemaPath = path.resolve(__dirname, '../../supabase/schema.sql');

  // SQL to drop all app tables and types (in dependency order)
  const dropSql = `
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS availability CASCADE;
    DROP TABLE IF EXISTS game_memberships CASCADE;
    DROP TABLE IF EXISTS games CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TYPE IF EXISTS session_status CASCADE;
    DROP TYPE IF EXISTS availability_status CASCADE;
  `;

  try {
    // Drop existing tables
    execSync(
      `docker exec -i ${SUPABASE_DB_CONTAINER} psql -U postgres -d postgres -c "${dropSql.replace(/\n/g, ' ')}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Apply fresh schema
    execSync(
      `docker exec -i ${SUPABASE_DB_CONTAINER} psql -U postgres -d postgres < "${schemaPath}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to reset database schema: ${message}`);
  }
}
