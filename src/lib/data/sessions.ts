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
    location?: string | null;
    notes?: string | null;
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

export async function fetchUpcomingSessionsForGames(
  supabase: SupabaseClient,
  gameIds: string[],
  fromDate: string
) {
  if (gameIds.length === 0) {
    return { data: [] as GameSession[], error: null };
  }
  return supabase
    .from('sessions')
    .select('*')
    .in('game_id', gameIds)
    .gte('date', fromDate)
    .order('date', { ascending: true });
}

export async function updateSession(
  supabase: SupabaseClient,
  sessionId: string,
  patch: {
    start_time?: string;
    end_time?: string;
    location?: string | null;
    notes?: string | null;
  }
) {
  return supabase
    .from('sessions')
    .update(patch)
    .eq('id', sessionId)
    .select()
    .single<GameSession>();
}
