import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameWithGM } from '@/types';

export async function fetchGameWithGM(supabase: SupabaseClient, gameId: string) {
  return supabase
    .from('games')
    .select('*, gm:users!games_gm_id_fkey(*)')
    .eq('id', gameId)
    .single<GameWithGM>();
}

export async function fetchUserGmGames(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('games')
    .select('*, gm:users!games_gm_id_fkey(*)')
    .eq('gm_id', userId);
}

export async function fetchUserGameCount(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('gm_id', userId);
}

export async function createGame(
  supabase: SupabaseClient,
  params: {
    name: string;
    description: string | null;
    gm_id: string;
    play_days: number[];
    ad_hoc_only: boolean;
    invite_code: string;
    scheduling_window_months: number;
    default_start_time: string;
    default_end_time: string;
    timezone: string | null;
  }
) {
  const { error: insertError } = await supabase.from('games').insert(params);

  if (insertError) {
    return { data: null, error: insertError };
  }

  // Fetch the created game by invite code (can't use .select() on insert due to RLS timing)
  const { data, error } = await supabase
    .from('games')
    .select('id')
    .eq('invite_code', params.invite_code)
    .single();

  return { data, error };
}

export async function updateGame(
  supabase: SupabaseClient,
  gameId: string,
  params: {
    name: string;
    description: string | null;
    play_days: number[];
    scheduling_window_months: number;
    default_start_time: string;
    default_end_time: string;
    timezone: string | null;
    min_players_needed: number;
    ad_hoc_only: boolean;
  }
) {
  return supabase.from('games').update(params).eq('id', gameId);
}

export async function deleteGame(supabase: SupabaseClient, gameId: string) {
  return supabase.from('games').delete().eq('id', gameId);
}

export async function regenerateInviteCode(
  supabase: SupabaseClient,
  gameId: string,
  newCode: string
) {
  return supabase.from('games').update({ invite_code: newCode }).eq('id', gameId);
}
