import { useState, useEffect, useCallback } from 'react';
import { parseISO, startOfDay } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import type { GameSession } from '@/types';
import {
  fetchGameSessions,
  confirmSession as confirmSessionQuery,
  cancelSession as cancelSessionQuery,
  updateSession as updateSessionQuery,
} from '@/lib/data';
import { USAGE_LIMITS } from '@/lib/constants';

const supabase = createClient();

export interface UseSessionsReturn {
  sessions: GameSession[];
  loading: boolean;
  confirmSession: (
    date: string,
    startTime: string,
    endTime: string,
    confirmedBy: string,
    location?: string | null,
    notes?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  updateSession: (
    sessionId: string,
    patch: {
      start_time?: string;
      end_time?: string;
      location?: string | null;
      notes?: string | null;
    },
  ) => Promise<{ success: boolean; error?: string }>;
  cancelSession: (date: string) => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

export function useSessions(gameId: string, ready: boolean): UseSessionsReturn {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!gameId) return;
    const { data } = await fetchGameSessions(supabase, gameId);
    setSessions(data || []);
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
    if (ready) fetchAll();
  }, [ready, fetchAll]);

  const confirmSession = useCallback(
    async (
      date: string,
      startTime: string,
      endTime: string,
      confirmedBy: string,
      location: string | null = null,
      notes: string | null = null,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!gameId || !confirmedBy) return { success: false, error: 'Not authenticated' };

      const sessionDate = parseISO(date);
      const today = startOfDay(new Date());
      if (sessionDate < today) {
        return { success: false, error: 'Cannot schedule sessions in the past.' };
      }

      const existingSession = sessions.find((s) => s.date === date);
      if (!existingSession) {
        const futureSessionCount = sessions.filter((s) => parseISO(s.date) >= today).length;
        if (futureSessionCount >= USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME) {
          return {
            success: false,
            error: `Cannot have more than ${USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME} future sessions. Please cancel some sessions first.`,
          };
        }
      }

      const { data, error } = await confirmSessionQuery(supabase, {
        game_id: gameId,
        date,
        start_time: startTime,
        end_time: endTime,
        confirmed_by: confirmedBy,
        location,
        notes,
      });

      if (error) {
        if (error.code === '42501') {
          return {
            success: false,
            error:
              'Cannot schedule this session. It may be in the past or the game has reached the session limit.',
          };
        }
        return { success: false, error: 'Failed to confirm session. Please try again.' };
      }

      if (data) {
        setSessions((prev) => {
          const existing = prev.findIndex((s) => s.date === date);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = data;
            return updated;
          }
          return [...prev, data].sort((a, b) => a.date.localeCompare(b.date));
        });
      }

      return { success: true };
    },
    [gameId, sessions],
  );

  const updateSession = useCallback(
    async (
      sessionId: string,
      patch: {
        start_time?: string;
        end_time?: string;
        location?: string | null;
        notes?: string | null;
      },
    ): Promise<{ success: boolean; error?: string }> => {
      if (!gameId) return { success: false, error: 'Not authenticated' };
      const { data, error } = await updateSessionQuery(supabase, sessionId, patch);

      if (error) {
        if (error.code === 'PGRST116') {
          // Row was deleted by another GM in another tab.
          await fetchAll();
          return { success: false, error: 'This session no longer exists.' };
        }
        if (error.code === '42501') {
          return { success: false, error: "You don't have permission to edit this session." };
        }
        return { success: false, error: 'Failed to update session. Please try again.' };
      }

      if (data) {
        setSessions((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      }
      return { success: true };
    },
    [fetchAll, gameId],
  );

  const cancelSession = useCallback(
    async (date: string): Promise<{ success: boolean; error?: string }> => {
      if (!gameId) return { success: false, error: 'Not authenticated' };
      const { error } = await cancelSessionQuery(supabase, gameId, date);
      if (error) return { success: false, error: error.message };
      setSessions((prev) => prev.filter((s) => s.date !== date));
      return { success: true };
    },
    [gameId],
  );

  return { sessions, loading, confirmSession, updateSession, cancelSession, refresh: fetchAll };
}
