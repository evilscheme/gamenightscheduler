import type { SupabaseClient } from '@supabase/supabase-js';
import type { AvailabilityStatus } from '@/types';

export async function fetchUserAvailability(
  supabase: SupabaseClient,
  gameId: string,
  userId: string
) {
  return supabase
    .from('availability')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', userId);
}

export async function fetchAllAvailability(supabase: SupabaseClient, gameId: string) {
  return supabase.from('availability').select('*').eq('game_id', gameId);
}

export async function upsertAvailability(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
