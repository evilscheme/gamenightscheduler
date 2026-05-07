import { useState, useEffect, useCallback } from 'react';
import {
  getDay,
  startOfDay,
  parseISO,
  isAfter,
  isBefore,
} from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import type {
  Availability,
  AvailabilityStatus,
  GameWithMembers,
} from '@/types';
import type { AvailabilityEntry } from '@/lib/availabilityStatus';
import {
  fetchUserAvailability,
  fetchAllAvailability,
  upsertAvailability,
  batchUpsertAvailability,
} from '@/lib/data';
import { filterAvailabilityForCopy } from '@/lib/copyAvailability';
import { getSchedulingWindow } from '@/lib/scheduling';

const supabase = createClient();

export interface UseAvailabilityReturn {
  availability: Record<string, AvailabilityEntry>;
  allAvailability: Availability[];
  loading: boolean;
  changeAvailability: (
    date: string,
    status: AvailabilityStatus,
    comment: string | null,
    availableAfter: string | null,
    availableUntil: string | null,
  ) => Promise<void>;
  copyFromGame: (sourceGameId: string, extraDateStrings: string[]) => Promise<number>;
  removePlayerData: (playerId: string) => void;
  refresh: () => Promise<void>;
}

export function useAvailability(
  gameId: string,
  userId: string,
  game: GameWithMembers | null,
): UseAvailabilityReturn {
  const [availability, setAvailability] = useState<Record<string, AvailabilityEntry>>({});
  const [allAvailability, setAllAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!gameId || !userId) return;
    const [userAvailRes, allAvailRes] = await Promise.all([
      fetchUserAvailability(supabase, gameId, userId),
      fetchAllAvailability(supabase, gameId),
    ]);

    const map: Record<string, AvailabilityEntry> = {};
    userAvailRes.data?.forEach((a) => {
      map[a.date] = {
        status: a.status,
        comment: a.comment,
        available_after: a.available_after,
        available_until: a.available_until,
      };
    });
    setAvailability(map);
    setAllAvailability(allAvailRes.data || []);
    setLoading(false);
  }, [gameId, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
    if (userId) fetchAll();
  }, [userId, fetchAll]);

  const refresh = fetchAll;

  const changeAvailability = useCallback(
    async (
      date: string,
      status: AvailabilityStatus,
      comment: string | null,
      availableAfter: string | null,
      availableUntil: string | null,
    ) => {
      if (!userId || !gameId) return;

      setAvailability((prev) => ({
        ...prev,
        [date]: {
          status,
          comment,
          available_after: availableAfter,
          available_until: availableUntil,
        },
      }));

      const { error } = await upsertAvailability(supabase, {
        user_id: userId,
        game_id: gameId,
        date,
        status,
        comment,
        available_after: availableAfter,
        available_until: availableUntil,
      });

      if (error) {
        setAvailability((prev) => {
          const next = { ...prev };
          delete next[date];
          return next;
        });
        return;
      }

      setAllAvailability((prev) => {
        const existing = prev.findIndex((a) => a.user_id === userId && a.date === date);
        const now = new Date().toISOString();
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = {
            ...updated[existing],
            status,
            comment,
            available_after: availableAfter,
            available_until: availableUntil,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: 'temp',
            user_id: userId,
            game_id: gameId,
            date,
            status,
            comment,
            available_after: availableAfter,
            available_until: availableUntil,
            created_at: now,
            updated_at: now,
          },
        ];
      });
    },
    [userId, gameId],
  );

  const copyFromGame = useCallback(
    async (sourceGameId: string, extraDateStrings: string[]): Promise<number> => {
      if (!userId || !gameId || !game) return 0;

      const { data: sourceAvail } = await fetchUserAvailability(supabase, sourceGameId, userId);
      if (!sourceAvail || sourceAvail.length === 0) return 0;

      const sourceMap: Record<string, AvailabilityEntry> = {};
      sourceAvail.forEach((a) => {
        sourceMap[a.date] = {
          status: a.status,
          comment: a.comment,
          available_after: a.available_after,
          available_until: a.available_until,
        };
      });

      const today = startOfDay(new Date());
      const { end: windowEnd } = getSchedulingWindow(game, today);

      const toCopy = filterAvailabilityForCopy({
        sourceAvailability: sourceMap,
        destinationAvailability: availability,
        destinationPlayDays: game.play_days,
        destinationExtraPlayDates: extraDateStrings,
        today,
        windowEndDate: windowEnd,
        getDayOfWeek: getDay,
        isBefore,
        isAfter,
        parseDate: (s) => parseISO(s),
      });

      if (toCopy.length === 0) return 0;

      setAvailability((prev) => {
        const next = { ...prev };
        for (const { date, entry } of toCopy) next[date] = entry;
        return next;
      });

      const rows = toCopy.map(({ date, entry }) => ({
        user_id: userId,
        game_id: gameId,
        date,
        status: entry.status,
        comment: entry.comment,
        available_after: entry.available_after,
        available_until: entry.available_until,
      }));

      const { error } = await batchUpsertAvailability(supabase, rows);

      if (error) {
        setAvailability((prev) => {
          const next = { ...prev };
          for (const { date } of toCopy) delete next[date];
          return next;
        });
        throw error;
      }

      const now = new Date().toISOString();
      setAllAvailability((prev) => [
        ...prev,
        ...toCopy.map(({ date, entry }) => ({
          id: 'temp',
          user_id: userId,
          game_id: gameId,
          date,
          status: entry.status,
          comment: entry.comment,
          available_after: entry.available_after,
          available_until: entry.available_until,
          created_at: now,
          updated_at: now,
        })),
      ]);

      return toCopy.length;
    },
    [userId, gameId, game, availability],
  );

  const removePlayerData = useCallback((playerId: string) => {
    setAllAvailability((prev) => prev.filter((a) => a.user_id !== playerId));
  }, []);

  return {
    availability,
    allAvailability,
    loading,
    changeAvailability,
    copyFromGame,
    removePlayerData,
    refresh,
  };
}
