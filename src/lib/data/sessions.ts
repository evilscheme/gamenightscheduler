import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameSession } from '@/types';

export async function fetchGameSessions(supabase: SupabaseClient, gameId: string) {
  return supabase
    .from('sessions')
    .select('*')
    .eq('game_id', gameId)
    .order('date', { ascending: true });
}

export async function confirmSession(
  supabase: SupabaseClient,
  params: {
    game_id: string;
    date: string;
    start_time: string;
    end_time: string;
    confirmed_by: string;
  }
) {
  return supabase
    .from('sessions')
    .upsert(
      { ...params, status: 'confirmed' as const },
      { onConflict: 'game_id,date' }
    )
    .select()
    .single<GameSession>();
}

export async function cancelSession(
  supabase: SupabaseClient,
  gameId: string,
  date: string
) {
  return supabase.from('sessions').delete().eq('game_id', gameId).eq('date', date);
}

export async function fetchFutureSessions(
  supabase: SupabaseClient,
  gameId: string,
  fromDate: string
) {
  return supabase
    .from('sessions')
    .select('date')
    .eq('game_id', gameId)
    .gte('date', fromDate);
}
