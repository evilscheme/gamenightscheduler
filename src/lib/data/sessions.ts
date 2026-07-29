import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { GameSession } from '@/types';
import { fetchAllPages } from './paginate';

export async function fetchGameSessions(supabase: SupabaseClient<Database>, gameId: string) {
  // Paginated: `sessions` has no date filter here (past + future), so a
  // long-lived campaign can exceed Supabase's 1000-row cap. `id` is the stable
  // tiebreaker since multiple sessions can share a date.
  return fetchAllPages<GameSession>((from, to) =>
    supabase
      .from('sessions')
      .select('*')
      .eq('game_id', gameId)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );
}

export async function confirmSession(
  supabase: SupabaseClient<Database>,
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
  supabase: SupabaseClient<Database>,
  gameId: string,
  date: string
) {
  return supabase.from('sessions').delete().eq('game_id', gameId).eq('date', date);
}

export async function fetchFutureSessions(
  supabase: SupabaseClient<Database>,
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
  supabase: SupabaseClient<Database>,
  gameIds: string[],
  fromDate: string
) {
  if (gameIds.length === 0) {
    return { data: [] as GameSession[], error: null };
  }
  // Paginated: up to (20 games/user × 100 future sessions/game) structurally
  // exceeds the 1000-row cap for a heavy user. `id` is the stable tiebreaker.
  return fetchAllPages<GameSession>((from, to) =>
    supabase
      .from('sessions')
      .select('*')
      .in('game_id', gameIds)
      .gte('date', fromDate)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );
}

export async function updateSession(
  supabase: SupabaseClient<Database>,
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
