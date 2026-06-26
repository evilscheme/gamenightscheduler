import type { SupabaseClient } from '@supabase/supabase-js';
import type { AvailabilityStatus } from '@/types';

export async function fetchUserDefaults(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('user_availability_defaults')
    .select('*')
    .eq('user_id', userId);
}

export async function upsertUserDefault(
  supabase: SupabaseClient,
  params: {
    user_id: string;
    day_of_week: number;
    status: AvailabilityStatus;
    comment: string | null;
    available_after: string | null;
    available_until: string | null;
  }
) {
  return supabase
    .from('user_availability_defaults')
    .upsert(params, { onConflict: 'user_id,day_of_week' });
}

export async function deleteUserDefault(
  supabase: SupabaseClient,
  userId: string,
  dayOfWeek: number
) {
  return supabase
    .from('user_availability_defaults')
    .delete()
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek);
}
