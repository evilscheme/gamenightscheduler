import type { SupabaseClient } from '@supabase/supabase-js';
import type { GamePlayDate } from '@/types';

export async function fetchGamePlayDates(supabase: SupabaseClient, gameId: string) {
  return supabase.from('game_play_dates').select('*').eq('game_id', gameId);
}

export async function addPlayDate(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
