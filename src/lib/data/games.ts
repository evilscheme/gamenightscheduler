import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { GameWithGM } from '@/types';

export async function fetchGameWithGM(supabase: SupabaseClient<Database>, gameId: string) {
  return supabase
    .from('games')
    .select('*, gm:users!games_gm_id_fkey(*)')
    .eq('id', gameId)
    .single<GameWithGM>();
}

export async function fetchUserGmGames(supabase: SupabaseClient<Database>, userId: string) {
  return supabase
    .from('games')
    .select('*, gm:users!games_gm_id_fkey(*), game_memberships(count)')
    .eq('gm_id', userId);
}

/**
 * Fetch a set of games (with GM profile and embedded membership count) by id.
 * Used for the dashboard's "member" games — the ones the user belongs to but
 * doesn't GM — resolved from the id list returned by fetchUserMemberships.
 */
export async function fetchGamesWithGMByIds(supabase: SupabaseClient<Database>, gameIds: string[]) {
  return supabase
    .from('games')
    .select('*, gm:users!games_gm_id_fkey(*), game_memberships(count)')
    .in('id', gameIds);
}

/** Minimal name lookup for page-title metadata (generateMetadata layouts). */
export async function fetchGameName(supabase: SupabaseClient<Database>, gameId: string) {
  return supabase.from('games').select('name').eq('id', gameId).single<{ name: string }>();
}

/** Invite-preview shape for the join page's OG/social metadata. */
export async function fetchGameInviteMetaByCode(supabase: SupabaseClient<Database>, code: string) {
  return supabase
    .from('games')
    .select('name, description, play_days, gm:users!games_gm_id_fkey(name)')
    .eq('invite_code', code)
    .single();
}

export async function fetchUserGameCount(supabase: SupabaseClient<Database>, userId: string) {
  return supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('gm_id', userId);
}

export async function createGame(
  supabase: SupabaseClient<Database>,
  params: {
    name: string;
    description: string | null;
    gm_id: string;
    play_days: number[];
    ad_hoc_only: boolean;
    invite_code: string;
    scheduling_window_months: number;
    campaign_start_date?: string | null;
    campaign_end_date?: string | null;
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
  supabase: SupabaseClient<Database>,
  gameId: string,
  params: {
    name: string;
    description: string | null;
    play_days: number[];
    scheduling_window_months: number;
    campaign_start_date?: string | null;
    campaign_end_date?: string | null;
    default_start_time: string;
    default_end_time: string;
    timezone: string | null;
    min_players_needed: number;
    ad_hoc_only: boolean;
  }
) {
  return supabase.from('games').update(params).eq('id', gameId);
}

export async function deleteGame(supabase: SupabaseClient<Database>, gameId: string) {
  return supabase.from('games').delete().eq('id', gameId);
}

export async function regenerateInviteCode(
  supabase: SupabaseClient<Database>,
  gameId: string,
  newCode: string
) {
  return supabase.from('games').update({ invite_code: newCode }).eq('id', gameId);
}
