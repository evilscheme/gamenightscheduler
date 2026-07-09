import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchUpcomingSessionsForGames } from '@/lib/data';
import { queryKeys } from '@/lib/queryKeys';
import { getTodayLocalDate } from '@/lib/date';
import {
  buildOtherGameSessionMap,
  type OtherGameSessionInfo,
} from '@/lib/otherGameSessions';

const supabase = createClient();

const EMPTY_MAP = new Map<string, OtherGameSessionInfo[]>();

export interface UseOtherGameSessionsReturn {
  otherGameSessionsByDate: Map<string, OtherGameSessionInfo[]>;
}

/**
 * Fetch confirmed sessions for the user's OTHER games (RLS lets any participant
 * read a game's sessions) and index them by date, so the availability calendar
 * can flag nights the player is already scheduled elsewhere.
 *
 * The query key encodes the (sorted) game-id set, so the fetch only re-runs
 * when the set of other games actually changes.
 */
export function useOtherGameSessions(
  otherGames: { id: string; name: string }[],
  userId: string,
): UseOtherGameSessionsReturn {
  const gameIds = useMemo(() => otherGames.map((g) => g.id), [otherGames]);

  const sessionsQuery = useQuery({
    queryKey: queryKeys.otherGameSessions(gameIds),
    enabled: !!userId && gameIds.length > 0,
    queryFn: async () =>
      (await fetchUpcomingSessionsForGames(supabase, gameIds, getTodayLocalDate())).data ?? [],
  });

  const otherGameSessionsByDate = useMemo(() => {
    if (!sessionsQuery.data || otherGames.length === 0) return EMPTY_MAP;
    const nameById = new Map(otherGames.map((g) => [g.id, g.name]));
    return buildOtherGameSessionMap(sessionsQuery.data, nameById, getTodayLocalDate());
  }, [sessionsQuery.data, otherGames]);

  return { otherGameSessionsByDate };
}
