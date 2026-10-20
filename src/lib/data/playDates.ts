import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { GamePlayDate } from '@/types';
import { fetchAllPages } from './paginate';

/**
 * Every explicit play date (extra dates and per-date notes) for a game, past
 * included. Paginated: nothing caps or prunes these rows, so a long campaign
 * can pass the 1000-row cap, and any dropped extra date would stop counting as
 * a play date. `date` is unique per game, so it is a total order on its own.
 */
export async function fetchGamePlayDates(supabase: SupabaseClient<Database>, gameId: string) {
  return fetchAllPages<GamePlayDate>((from, to) =>
    supabase
      .from('game_play_dates')
      .select('*')
      .eq('game_id', gameId)
      .order('date', { ascending: true })
      .range(from, to)
  );
}

export async function addPlayDate(
  supabase: SupabaseClient<Database>,
  gameId: string,
  date: string
) {
  return supabase
    .from('game_play_dates')
    .insert({ game_id: gameId, date, note: null })
    .select()
    .single<GamePlayDate>();
}

export async function removePlayDate(
  supabase: SupabaseClient<Database>,
  gameId: string,
  date: string
) {
  return supabase
    .from('game_play_dates')
    .delete()
    .eq('game_id', gameId)
    .eq('date', date);
}

export async function updatePlayDateNote(
  supabase: SupabaseClient<Database>,
  gameId: string,
  date: string,
  note: string | null
) {
  return supabase
    .from('game_play_dates')
    .update({ note })
    .eq('game_id', gameId)
    .eq('date', date);
}

export async function upsertPlayDate(
  supabase: SupabaseClient<Database>,
  gameId: string,
  date: string,
  note: string | null
) {
  return supabase
    .from('game_play_dates')
    .upsert({ game_id: gameId, date, note }, { onConflict: 'game_id,date' })
    .select()
    .single<GamePlayDate>();
}
