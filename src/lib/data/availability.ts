import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Availability, AvailabilityStatus } from '@/types';
import { fetchAllPages } from './paginate';

/**
 * One player's availability in a game between `fromDate` and `toDate`
 * (inclusive). Bounded and paginated: a game's whole history can exceed the
 * 1000-row cap, and older rows would crowd the in-window ones out of the first
 * page. `date` is unique per (user, game), so it is a total order on its own.
 */
export async function fetchUserAvailability(
  supabase: SupabaseClient<Database>,
  gameId: string,
  userId: string,
  fromDate: string,
  toDate: string
) {
  return fetchAllPages<Availability>((from, to) =>
    supabase
      .from('availability')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
      .range(from, to)
  );
}

/**
 * Every player's availability for a game. Paginated because a long-running
 * game accumulates far more than Supabase's 1000-row cap (one row per player
 * per date) — without paging, rows past the first 1000 silently vanish, and a
 * player's marks appear to "revert" on reload. `fromDate` scopes out stale
 * past dates (the calendar only ever shows the scheduling window); pass the
 * local "today" so the payload stays small on top of the paging.
 */
export async function fetchAllAvailability(
  supabase: SupabaseClient<Database>,
  gameId: string,
  fromDate?: string
) {
  return fetchAllPages<Availability>((from, to) => {
    let query = supabase
      .from('availability')
      .select('*')
      .eq('game_id', gameId)
      // Stable total order so pages don't skip/duplicate; (date, user_id) is
      // unique within a single game.
      .order('date', { ascending: true })
      .order('user_id', { ascending: true });
    if (fromDate) query = query.gte('date', fromDate);
    return query.range(from, to);
  });
}

export async function upsertAvailability(
  supabase: SupabaseClient<Database>,
  params: {
    user_id: string;
    game_id: string;
    date: string;
    status: AvailabilityStatus;
    comment: string | null;
    available_after: string | null;
    available_until: string | null;
  }
) {
  return supabase
    .from('availability')
    .upsert(params, { onConflict: 'user_id,game_id,date' });
}

export async function batchUpsertAvailability(
  supabase: SupabaseClient<Database>,
  rows: {
    user_id: string;
    game_id: string;
    date: string;
    status: AvailabilityStatus;
    comment: string | null;
    available_after: string | null;
    available_until: string | null;
  }[]
) {
  return supabase
    .from('availability')
    .upsert(rows, { onConflict: 'user_id,game_id,date' });
}
