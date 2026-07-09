import { useCallback, useMemo } from 'react';
import {
  getDay,
  startOfDay,
  parseISO,
  isAfter,
  eachDayOfInterval,
  format,
} from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabase/client';
import type {
  Availability,
  AvailabilityStatus,
  GameWithMembers,
} from '@/types';
import type { AvailabilityEntry } from '@/lib/availability';
import {
  fetchUserAvailability,
  fetchAllAvailability,
  upsertAvailability,
  batchUpsertAvailability,
  fetchUserDefaults,
} from '@/lib/data';
import { queryKeys } from '@/lib/queryKeys';
import {
  filterAvailabilityForCopy,
  applyCopyConflicts,
  type CopyConflict,
  buildBulkUpsertEntries,
  computeDefaultEntries,
  type WeekdayDefault,
} from '@/lib/availability';
import { getSchedulingWindow } from '@/lib/scheduling';

const supabase = getSupabaseClient();

const EMPTY_AVAILABILITY: Availability[] = [];

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
  /** Set one status on many dates with a single batched upsert (bulk-actions bar). */
  bulkSetStatus: (dates: string[], status: AvailabilityStatus) => Promise<void>;
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
  const queryClient = useQueryClient();

  // Single source of truth: every player's rows for this game. The current
  // user's own entries (the old separate fetchUserAvailability query) are
  // derived from this set instead of fetched twice.
  const allQuery = useQuery({
    queryKey: queryKeys.availability(gameId),
    enabled: !!gameId && !!userId,
    queryFn: async () => (await fetchAllAvailability(supabase, gameId)).data ?? [],
  });
  const allAvailability = allQuery.data ?? EMPTY_AVAILABILITY;

  const availability = useMemo(() => {
    const map: Record<string, AvailabilityEntry> = {};
    for (const a of allAvailability) {
      if (a.user_id !== userId) continue;
      map[a.date] = {
        status: a.status,
        comment: a.comment,
        available_after: a.available_after,
        available_until: a.available_until,
      };
    }
    return map;
  }, [allAvailability, userId]);

  const defaultsQueryFn = useCallback(
    async () => (await fetchUserDefaults(supabase, userId)).data ?? [],
    [userId]
  );
  const defaultsQuery = useQuery({
    queryKey: queryKeys.userDefaults(userId),
    enabled: !!userId,
    queryFn: defaultsQueryFn,
  });
  const hasDefaults = defaultsQuery.data === undefined ? null : defaultsQuery.data.length > 0;

  /** Build a full upsert row for the current user from a per-date entry. */
  const toUpsertRow = useCallback(
    (date: string, entry: AvailabilityEntry) => ({
      user_id: userId,
      game_id: gameId,
      date,
      status: entry.status,
      comment: entry.comment,
      available_after: entry.available_after,
      available_until: entry.available_until,
    }),
    [userId, gameId]
  );

  /**
   * Recover from a failed write: roll back the optimistic rows, then refetch
   * from the server. The refetch matters when writes to the same date
   * interleave — an earlier write's rollback can clobber a later write that
   * succeeded, and only server truth can untangle that.
   */
  const revertAndReconcile = useCallback(
    (revert: () => void) => {
      revert();
      queryClient.invalidateQueries({ queryKey: queryKeys.availability(gameId) });
    },
    [queryClient, gameId]
  );

  /**
   * Optimistically write the current user's rows for the given dates into the
   * availability cache. Returns a revert function that restores exactly the
   * rows that were replaced or removed (not a whole-cache snapshot, so two
   * in-flight changes to different dates can't clobber each other).
   */
  const optimisticallyApply = useCallback(
    (entries: { date: string; entry: AvailabilityEntry }[]) => {
      const key = queryKeys.availability(gameId);
      const dates = new Set(entries.map((e) => e.date));
      const prevRows = (queryClient.getQueryData<Availability[]>(key) ?? []).filter(
        (a) => a.user_id === userId && dates.has(a.date)
      );
      const prevByDate = new Map(prevRows.map((r) => [r.date, r]));
      const nowIso = new Date().toISOString();
      const nextRows: Availability[] = entries.map(({ date, entry }) => ({
        id: prevByDate.get(date)?.id ?? 'temp',
        user_id: userId,
        game_id: gameId,
        date,
        status: entry.status,
        comment: entry.comment,
        available_after: entry.available_after,
        available_until: entry.available_until,
        created_at: prevByDate.get(date)?.created_at ?? nowIso,
        updated_at: nowIso,
      }));

      queryClient.setQueryData<Availability[]>(key, (cur = []) => [
        ...cur.filter((a) => !(a.user_id === userId && dates.has(a.date))),
        ...nextRows,
      ]);

      return () => {
        queryClient.setQueryData<Availability[]>(key, (cur = []) => [
          ...cur.filter((a) => !(a.user_id === userId && dates.has(a.date))),
          ...prevRows,
        ]);
      };
    },
    [queryClient, gameId, userId]
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.availability(gameId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.userDefaults(userId) }),
    ]);
  }, [queryClient, gameId, userId]);

  const changeAvailability = useCallback(
    async (
      date: string,
      status: AvailabilityStatus,
      comment: string | null,
      availableAfter: string | null,
      availableUntil: string | null,
    ) => {
      if (!userId || !gameId) return;

      const revert = optimisticallyApply([
        {
          date,
          entry: {
            status,
            comment,
            available_after: availableAfter,
            available_until: availableUntil,
          },
        },
      ]);

      const { error } = await upsertAvailability(
        supabase,
        toUpsertRow(date, {
          status,
          comment,
          available_after: availableAfter,
          available_until: availableUntil,
        })
      );

      if (error) revertAndReconcile(revert);
    },
    [userId, gameId, optimisticallyApply, toUpsertRow, revertAndReconcile],
  );

  const bulkSetStatus = useCallback(
    async (dates: string[], status: AvailabilityStatus) => {
      if (!userId || !gameId || dates.length === 0) return;

      // Preserve existing comments/time constraints, matching single-date toggles.
      const entries = buildBulkUpsertEntries(dates, status, availability);
      const revert = optimisticallyApply(entries);

      const rows = entries.map(({ date, entry }) => toUpsertRow(date, entry));

      const { error } = await batchUpsertAvailability(supabase, rows);
      if (error) revertAndReconcile(revert);
    },
    [userId, gameId, availability, optimisticallyApply, toUpsertRow, revertAndReconcile],
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
        parseDate: (s) => parseISO(s),
      });

      const finalEntries = conflict
        ? applyCopyConflicts(copied, conflict.dates, conflict.status)
        : copied;

      if (finalEntries.length === 0) return { copied: 0, overridden: 0 };

      const revert = optimisticallyApply(finalEntries);

      const rows = finalEntries.map(({ date, entry }) => toUpsertRow(date, entry));

      const { error } = await batchUpsertAvailability(supabase, rows);

      if (error) {
        revertAndReconcile(revert);
        throw error;
      }

      const overridden = conflict ? conflict.dates.length : 0;
      return { copied: finalEntries.length - overridden, overridden };
    },
    [userId, gameId, game, availability, optimisticallyApply, toUpsertRow, revertAndReconcile],
  );

  const applyDefaults = useCallback(
    async (extraDateStrings: string[]): Promise<ApplyDefaultsResult> => {
      if (!userId || !gameId || !game) return { hadDefaults: false, filled: 0 };

      // Force a fresh read (defaults may have been edited in another tab) and
      // refresh the cached copy while we're at it.
      const defaultRows = await queryClient.fetchQuery({
        queryKey: queryKeys.userDefaults(userId),
        queryFn: defaultsQueryFn,
        staleTime: 0,
      });
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
      });

      if (entries.length === 0) return { hadDefaults: true, filled: 0 };

      const datedEntries = entries.map((e) => ({
        date: e.date,
        entry: {
          status: e.status,
          comment: e.comment,
          available_after: e.available_after,
          available_until: e.available_until,
        },
      }));
      const revert = optimisticallyApply(datedEntries);

      const rows = datedEntries.map(({ date, entry }) => toUpsertRow(date, entry));

      const { error } = await batchUpsertAvailability(supabase, rows);
      if (error) {
        revertAndReconcile(revert);
        throw error;
      }

      return { hadDefaults: true, filled: entries.length };
    },
    [userId, gameId, game, availability, optimisticallyApply, queryClient, defaultsQueryFn, toUpsertRow, revertAndReconcile],
  );

  const removePlayerData = useCallback(
    (playerId: string) => {
      queryClient.setQueryData<Availability[]>(
        queryKeys.availability(gameId),
        (prev = []) => prev.filter((a) => a.user_id !== playerId)
      );
    },
    [queryClient, gameId]
  );

  return {
    availability,
    allAvailability,
    // Defaults gate loading too (both queries run in parallel, so this costs
    // nothing): rendering before hasDefaults resolves would flash the
    // ApplyDefaultsButton's null state for users with no defaults.
    loading: allQuery.isPending || (!!userId && defaultsQuery.isPending),
    hasDefaults,
    changeAvailability,
    bulkSetStatus,
    copyFromGame,
    applyDefaults,
    removePlayerData,
    refresh,
  };
}
