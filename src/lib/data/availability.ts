import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { AvailabilityStatus } from '@/types';

export async function fetchUserAvailability(
  supabase: SupabaseClient<Database>,
  gameId: string,
  userId: string
) {
  return supabase
    .from('availability')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', userId);
}

export async function fetchAllAvailability(supabase: SupabaseClient<Database>, gameId: string) {
  return supabase.from('availability').select('*').eq('game_id', gameId);
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
