import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export async function fetchUserProfile(supabase: SupabaseClient<Database>, userId: string) {
  return supabase.from('users').select('*').eq('id', userId).single();
}

export async function updateUserProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: {
    name: string;
    timezone: string | null;
    week_start_day: number;
    time_format: string;
  }
) {
  return supabase.from('users').update(params).eq('id', userId);
}
