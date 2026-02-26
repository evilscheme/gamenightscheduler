import type { SupabaseClient } from '@supabase/supabase-js';

export async function updateUserProfile(
  supabase: SupabaseClient,
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
