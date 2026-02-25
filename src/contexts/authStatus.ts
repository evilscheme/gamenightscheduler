import type { Session } from '@supabase/supabase-js';
import type { User } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function deriveAuthStatus(
  isLoading: boolean,
  session: Session | null,
  profile: User | null,
  backendError: boolean,
): AuthStatus {
  if (isLoading || (session && !profile && !backendError)) return 'loading';
  if (profile) return 'authenticated';
  return 'unauthenticated';
}
