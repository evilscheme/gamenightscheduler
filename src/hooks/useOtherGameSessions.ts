import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchUpcomingSessionsForGames } from '@/lib/data';
import { getTodayLocalDate } from '@/lib/upcomingSessions';
import {
  buildOtherGameSessionMap,
  type OtherGameSessionInfo,
} from '@/lib/otherGameSessions';

const supabase = createClient();

export interface UseOtherGameSessionsReturn {
  otherGameSessionsByDate: Map<string, OtherGameSessionInfo[]>;
}

/**
 * Fetch confirmed sessions for the user's OTHER games (RLS lets any participant
 * read a game's sessions) and index them by date, so the availability calendar
 * can flag nights the player is already scheduled elsewhere.
 *
 * The serialized key of `otherGames` is the effect dependency, so the fetch only
 * re-runs when the set of other games actually changes (not on every render).
 */
export function useOtherGameSessions(
  otherGames: { id: string; name: string }[],
  userId: string,
): UseOtherGameSessionsReturn {
  const [otherGameSessionsByDate, setOtherGameSessionsByDate] = useState<
    Map<string, OtherGameSessionInfo[]>
  >(new Map());

  const gamesKey = otherGames.map((g) => `${g.id}:${g.name}`).join('|');

  useEffect(() => {
    if (!userId || otherGames.length === 0) {
      setOtherGameSessionsByDate(new Map());
      return;
    }

    let cancelled = false;
    (async () => {
      const ids = otherGames.map((g) => g.id);
      const nameById = new Map(otherGames.map((g) => [g.id, g.name]));
      const { data } = await fetchUpcomingSessionsForGames(
        supabase,
        ids,
        getTodayLocalDate(),
      );
      if (cancelled) return;
      setOtherGameSessionsByDate(
        buildOtherGameSessionMap(data ?? [], nameById, getTodayLocalDate()),
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gamesKey encodes otherGames; supabase is stable
  }, [gamesKey, userId]);

  return { otherGameSessionsByDate };
}
