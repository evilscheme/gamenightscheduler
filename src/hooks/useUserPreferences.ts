import { useAuth } from '@/contexts/AuthContext';

/**
 * Single source of truth for user internationalization preferences.
 * All components should read preferences through this hook.
 */
export function useUserPreferences() {
  const { profile } = useAuth();

  return {
    /** User's IANA timezone, or null if not set */
    timezone: profile?.timezone || null,
    /** 0 = Sunday, 1 = Monday */
    weekStartDay: (profile?.week_start_day ?? 0) as 0 | 1,
    /** Whether user prefers 24-hour time format */
    use24h: profile?.time_format === '24h',
  };
}
