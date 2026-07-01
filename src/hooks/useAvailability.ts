import { useState, useEffect, useCallback } from 'react';
import {
  getDay,
  startOfDay,
  parseISO,
  isAfter,
  isBefore,
  eachDayOfInterval,
  format,
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
  fetchUserDefaults,
} from '@/lib/data';
import { filterAvailabilityForCopy, applyCopyConflicts, type CopyConflict } from '@/lib/copyAvailability';
import { computeDefaultEntries, type WeekdayDefault } from '@/lib/defaultAvailability';
import { getSchedulingWindow } from '@/lib/scheduling';

const supabase = createClient();

export interface ApplyDefaultsResult {
  /** False when the user has not configured any default availability yet. */
  hadDefaults: boolean;
  /** Number of dates filled (0 when everything eligible was already set). */
  filled: number;
}

export interface UseAvailabilityReturn {
  availability: Record<string, AvailabilityEntry>;
  allAvailability: Availability[];
  loading: boolean;
  /** Whether the user has any default availability saved. `null` while the initial fetch is in flight. */
  hasDefaults: boolean | null;
  changeAvailability: (
    date: string,
    status: AvailabilityStatus,
    comment: string | null,
    availableAfter: string | null,
    availableUntil: string | null,
  ) => Promise<void>;
  copyFromGame: (
    sourceGameId: string,
    extraDateStrings: string[],
    conflict: CopyConflict | null,
  ) => Promise<{ copied: number; overridden: number }>;
  applyDefaults: (extraDateStrings: string[]) => Promise<ApplyDefaultsResult>;
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
  const [hasDefaults, setHasDefaults] = useState<boolean | null>(null);

  const fetchAll = useCallback(async () => {
    if (!gameId || !userId) return;
    const [userAvailRes, allAvailRes, defaultsRes] = await Promise.all([
      fetchUserAvailability(supabase, gameId, userId),
      fetchAllAvailability(supabase, gameId),
      fetchUserDefaults(supabase, userId),
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
    setHasDefaults((defaultsRes.data?.length ?? 0) > 0);
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
    async (
      sourceGameId: string,
      extraDateStrings: string[],
      conflict: CopyConflict | null,
    ): Promise<{ copied: number; overridden: number }> => {
      if (!userId || !gameId || !game) return { copied: 0, overridden: 0 };

      const { data: sourceAvail } = await fetchUserAvailability(supabase, sourceGameId, userId);

      const sourceMap: Record<string, AvailabilityEntry> = {};
      (sourceAvail ?? []).forEach((a) => {
        sourceMap[a.date] = {
          status: a.status,
          comment: a.comment,
          available_after: a.available_after,
          available_until: a.available_until,
        };
      });

      const today = startOfDay(new Date());
      const { end: windowEnd } = getSchedulingWindow(game, today);

      const copied = filterAvailabilityForCopy({
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

      const finalEntries = conflict
        ? applyCopyConflicts(copied, conflict.dates, conflict.status)
        : copied;

      if (finalEntries.length === 0) return { copied: 0, overridden: 0 };

      setAvailability((prev) => {
        const next = { ...prev };
        for (const { date, entry } of finalEntries) next[date] = entry;
        return next;
      });

      const rows = finalEntries.map(({ date, entry }) => ({
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
          for (const { date } of finalEntries) delete next[date];
          return next;
        });
        throw error;
      }

      const now = new Date().toISOString();
      setAllAvailability((prev) => [
        ...prev,
        ...finalEntries.map(({ date, entry }) => ({
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

      const overridden = conflict ? conflict.dates.length : 0;
      return { copied: finalEntries.length - overridden, overridden };
    },
    [userId, gameId, game, availability],
  );

  const applyDefaults = useCallback(
    async (extraDateStrings: string[]): Promise<ApplyDefaultsResult> => {
      if (!userId || !gameId || !game) return { hadDefaults: false, filled: 0 };

      const { data: defaultRows } = await fetchUserDefaults(supabase, userId);
      if (!defaultRows || defaultRows.length === 0) {
        return { hadDefaults: false, filled: 0 };
      }

      const defaults: Record<number, WeekdayDefault> = {};
      defaultRows.forEach((d) => {
        defaults[d.day_of_week] = {
          status: d.status,
          comment: d.comment,
          available_after: d.available_after,
          available_until: d.available_until,
        };
      });

      const today = startOfDay(new Date());
      const { start, end } = getSchedulingWindow(game, today);
      // getSchedulingWindow can return start > end (empty window); eachDayOfInterval would throw.
      const dates = isAfter(start, end) ? [] : eachDayOfInterval({ start, end });

      const entries = computeDefaultEntries({
        defaults,
        dates,
        playDays: game.play_days,
        extraPlayDates: extraDateStrings,
        existingAvailability: availability,
        today,
        formatDate: (d) => format(d, 'yyyy-MM-dd'),
        getDayOfWeek: getDay,
        isBefore,
      });

      if (entries.length === 0) return { hadDefaults: true, filled: 0 };

      // Optimistic local update.
      setAvailability((prev) => {
        const next = { ...prev };
        for (const e of entries) {
          next[e.date] = {
            status: e.status,
            comment: e.comment,
            available_after: e.available_after,
            available_until: e.available_until,
          };
        }
        return next;
      });

      const rows = entries.map((e) => ({
        user_id: userId,
        game_id: gameId,
        date: e.date,
        status: e.status,
        comment: e.comment,
        available_after: e.available_after,
        available_until: e.available_until,
      }));

      const { error } = await batchUpsertAvailability(supabase, rows);
      if (error) {
        setAvailability((prev) => {
          const next = { ...prev };
          for (const e of entries) delete next[e.date];
          return next;
        });
        throw error;
      }

      const now = new Date().toISOString();
      setAllAvailability((prev) => [
        ...prev,
        ...entries.map((e) => ({
          id: 'temp',
          user_id: userId,
          game_id: gameId,
          date: e.date,
          status: e.status,
          comment: e.comment,
          available_after: e.available_after,
          available_until: e.available_until,
          created_at: now,
          updated_at: now,
        })),
      ]);

      return { hadDefaults: true, filled: entries.length };
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
    hasDefaults,
    changeAvailability,
    copyFromGame,
    applyDefaults,
    removePlayerData,
    refresh,
  };
}
