import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Availability,
  AvailabilityStatus,
  GameSession,
  GamePlayDate,
  GameWithMembers,
} from "@/types";
import type { AvailabilityEntry } from "@/lib/availabilityStatus";
import {
  fetchGameWithGM,
  fetchGameMembers,
  fetchUserAvailability,
  fetchAllAvailability,
  fetchGameSessions,
  fetchGamePlayDates,
  fetchUserOtherGames,
  upsertAvailability,
  batchUpsertAvailability,
  confirmSession as confirmSessionQuery,
  cancelSession as cancelSessionQuery,
  regenerateInviteCode,
  leaveGame as leaveGameQuery,
  removePlayer as removePlayerQuery,
  deleteGame as deleteGameQuery,
  toggleCoGm as toggleCoGmQuery,
  addPlayDate,
  removePlayDate,
  updatePlayDateNote as updatePlayDateNoteQuery,
  upsertPlayDate,
} from "@/lib/data";
import { filterAvailabilityForCopy } from "@/lib/copyAvailability";
import { USAGE_LIMITS } from "@/lib/constants";
import { getSchedulingWindow } from "@/lib/scheduling";
import { nanoid } from "nanoid";
import {
  getDay,
  startOfDay,
  parseISO,
  isAfter,
  isBefore,
} from "date-fns";

export interface UseGameDetailReturn {
  // State
  game: GameWithMembers | null;
  loading: boolean;
  refreshing: boolean;
  availability: Record<string, AvailabilityEntry>;
  allAvailability: Availability[];
  sessions: GameSession[];
  gamePlayDates: GamePlayDate[];
  otherGames: { id: string; name: string }[];

  // Actions
  refresh: () => Promise<void>;
  changeAvailability: (
    date: string,
    status: AvailabilityStatus,
    comment: string | null,
    availableAfter: string | null,
    availableUntil: string | null
  ) => Promise<void>;
  copyFromGame: (sourceGameId: string) => Promise<number>;
  confirmSession: (
    date: string,
    startTime: string,
    endTime: string
  ) => Promise<{ success: boolean; error?: string }>;
  cancelSession: (date: string) => Promise<void>;
  regenerateInvite: () => Promise<void>;
  leaveGame: () => Promise<boolean>;
  removePlayer: (playerId: string) => Promise<boolean>;
  deleteGame: () => Promise<boolean>;
  toggleCoGm: (playerId: string, makeCoGm: boolean) => Promise<boolean>;
  toggleExtraDate: (date: string) => Promise<void>;
  updatePlayDateNote: (date: string, note: string | null) => Promise<void>;
}

export function useGameDetail(
  gameId: string,
  userId: string
): UseGameDetailReturn {
  const supabase = createClient();

  const [game, setGame] = useState<GameWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<
    Record<string, AvailabilityEntry>
  >({});
  const [allAvailability, setAllAvailability] = useState<Availability[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [gamePlayDates, setGamePlayDates] = useState<GamePlayDate[]>([]);
  const [otherGames, setOtherGames] = useState<{ id: string; name: string }[]>(
    []
  );
  const [refreshing, setRefreshing] = useState(false);

  // Compute extra date strings from play dates (needed by copyFromGame)
  const extraDateStrings = useMemo(() => {
    const regularDays = new Set(game?.play_days ?? []);
    return gamePlayDates
      .map((r) => ({ date: r.date, note: r.note }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((d) => !regularDays.has(getDay(parseISO(d.date))))
      .map((d) => d.date);
  }, [gamePlayDates, game?.play_days]);

  const fetchData = useCallback(async () => {
    if (!gameId || !userId) return;

    // Fetch game with GM
    const { data: gameData, error: gameError } = await fetchGameWithGM(
      supabase,
      gameId
    );

    if (gameError || !gameData) {
      setLoading(false);
      return;
    }

    // Fetch members with co-GM status
    const { data: members } = await fetchGameMembers(supabase, gameId);

    setGame({ ...gameData, members } as GameWithMembers);

    // Fetch user's availability
    const { data: userAvail } = await fetchUserAvailability(
      supabase,
      gameId,
      userId
    );

    const availMap: Record<string, AvailabilityEntry> = {};
    userAvail?.forEach((a) => {
      availMap[a.date] = {
        status: a.status,
        comment: a.comment,
        available_after: a.available_after,
        available_until: a.available_until,
      };
    });
    setAvailability(availMap);

    // Fetch all availability for suggestions
    const { data: allAvail } = await fetchAllAvailability(supabase, gameId);
    setAllAvailability(allAvail || []);

    // Fetch sessions
    const { data: sessionData } = await fetchGameSessions(supabase, gameId);
    setSessions(sessionData || []);

    // Fetch game play dates
    const { data: playDateRows } = await fetchGamePlayDates(supabase, gameId);
    setGamePlayDates(playDateRows || []);

    // Fetch user's other games for "Copy from" feature
    const otherGamesList = await fetchUserOtherGames(
      supabase,
      userId,
      gameId
    );
    setOtherGames(otherGamesList);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [gameId, userId]);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId, fetchData]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const changeAvailability = useCallback(
    async (
      date: string,
      status: AvailabilityStatus,
      comment: string | null,
      availableAfter: string | null,
      availableUntil: string | null
    ) => {
      if (!userId || !gameId) return;

      // Optimistic update
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
        // Revert on error
        setAvailability((prev) => {
          const next = { ...prev };
          delete next[date];
          return next;
        });
      } else {
        // Update all availability for suggestions
        setAllAvailability((prev) => {
          const existing = prev.findIndex(
            (a) => a.user_id === userId && a.date === date
          );
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
              id: "temp",
              user_id: userId,
              game_id: gameId,
              date,
              status,
              comment,
              available_after: availableAfter,
              available_until: availableUntil,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
    [userId, gameId]
  );

  const copyFromGame = useCallback(
    async (sourceGameId: string): Promise<number> => {
      if (!userId || !gameId || !game) return 0;

      // Fetch user's availability from source game
      const { data: sourceAvail } = await fetchUserAvailability(
        supabase,
        sourceGameId,
        userId
      );

      if (!sourceAvail || sourceAvail.length === 0) return 0;

      // Build source availability map
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

      // Filter dates eligible for copy
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

      // Optimistic update
      setAvailability((prev) => {
        const next = { ...prev };
        for (const { date, entry } of toCopy) {
          next[date] = entry;
        }
        return next;
      });

      // Batch upsert
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
        // Revert on error
        setAvailability((prev) => {
          const next = { ...prev };
          for (const { date } of toCopy) {
            delete next[date];
          }
          return next;
        });
        throw error;
      }

      // Update allAvailability for suggestions
      setAllAvailability((prev) => [
        ...prev,
        ...toCopy.map(({ date, entry }) => ({
          id: "temp",
          user_id: userId,
          game_id: gameId,
          date,
          status: entry.status,
          comment: entry.comment,
          available_after: entry.available_after,
          available_until: entry.available_until,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      ]);

      return toCopy.length;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
    [userId, gameId, game, availability, extraDateStrings]
  );

  const confirmSession = useCallback(
    async (
      date: string,
      startTime: string,
      endTime: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!userId || !gameId)
        return { success: false, error: "Not authenticated" };

      // Validate date is not in the past
      const sessionDate = parseISO(date);
      const today = startOfDay(new Date());
      if (sessionDate < today) {
        return {
          success: false,
          error: "Cannot schedule sessions in the past.",
        };
      }

      // Check if we're updating an existing session or creating a new one
      const existingSession = sessions.find((s) => s.date === date);
      if (!existingSession) {
        // Count future sessions (only for new sessions)
        const futureSessionCount = sessions.filter(
          (s) => parseISO(s.date) >= today
        ).length;

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
        confirmed_by: userId,
      });

      if (error) {
        // Check for RLS policy violation
        if (error.code === "42501") {
          return {
            success: false,
            error:
              "Cannot schedule this session. It may be in the past or the game has reached the session limit.",
          };
        }
        return {
          success: false,
          error: "Failed to confirm session. Please try again.",
        };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
    [userId, gameId, sessions]
  );

  const cancelSession = useCallback(
    async (date: string) => {
      if (!userId || !gameId) return;

      const { error } = await cancelSessionQuery(supabase, gameId, date);

      if (!error) {
        setSessions((prev) => prev.filter((s) => s.date !== date));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
    [userId, gameId]
  );

  const regenerateInvite = useCallback(async () => {
    if (!game || !gameId) return;

    const newCode = nanoid(10);
    const oldCode = game.invite_code;

    // Optimistic update
    setGame((prev) => (prev ? { ...prev, invite_code: newCode } : prev));

    const { error } = await regenerateInviteCode(supabase, gameId, newCode);

    if (error) {
      // Revert on error
      setGame((prev) => (prev ? { ...prev, invite_code: oldCode } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [game, gameId]);

  const leaveGame = useCallback(async (): Promise<boolean> => {
    if (!userId || !gameId) return false;

    const { error } = await leaveGameQuery(supabase, gameId, userId);

    return !error;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [userId, gameId]);

  const removePlayer = useCallback(
    async (playerId: string): Promise<boolean> => {
      if (!gameId) return false;

      const { error } = await removePlayerQuery(supabase, gameId, playerId);

      if (!error) {
        setGame((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            members: prev.members.filter((m) => m.id !== playerId),
          };
        });
        // Also remove their availability from allAvailability
        setAllAvailability((prev) =>
          prev.filter((a) => a.user_id !== playerId)
        );
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
    [gameId]
  );

  const deleteGame = useCallback(async (): Promise<boolean> => {
    if (!gameId) return false;

    const { error } = await deleteGameQuery(supabase, gameId);

    return !error;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [gameId]);

  const toggleCoGm = useCallback(
    async (playerId: string, makeCoGm: boolean): Promise<boolean> => {
      if (!gameId) return false;

      const { error } = await toggleCoGmQuery(
        supabase,
        gameId,
        playerId,
        makeCoGm
      );

      if (!error) {
        setGame((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            members: prev.members.map((m) =>
              m.id === playerId ? { ...m, is_co_gm: makeCoGm } : m
            ),
          };
        });
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
    [gameId]
  );

  const toggleExtraDate = useCallback(
    async (date: string) => {
      if (!gameId || !game) return;

      const isCurrentlyExtra = extraDateStrings.includes(date);

      if (isCurrentlyExtra) {
        // Remove: delete from table
        const existingRow = gamePlayDates.find((r) => r.date === date);
        if (existingRow) {
          setGamePlayDates((prev) => prev.filter((r) => r.date !== date));
          const { error } = await removePlayDate(supabase, gameId, date);
          if (error) {
            // Revert: re-add the removed row
            setGamePlayDates((prev) =>
              [...prev, existingRow].sort((a, b) =>
                a.date.localeCompare(b.date)
              )
            );
          }
        }
      } else {
        // Add: insert into table
        const tempRow: GamePlayDate = {
          id: "temp-" + date,
          game_id: gameId,
          date,
          note: null,
          created_at: new Date().toISOString(),
        };
        setGamePlayDates((prev) =>
          [...prev, tempRow].sort((a, b) => a.date.localeCompare(b.date))
        );

        const { data, error } = await addPlayDate(supabase, gameId, date);

        if (error) {
          setGamePlayDates((prev) => prev.filter((r) => r.date !== date));
        } else if (data) {
          setGamePlayDates((prev) =>
            prev.map((r) =>
              r.id === tempRow.id ? (data as GamePlayDate) : r
            )
          );
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
    [gameId, game, extraDateStrings, gamePlayDates]
  );

  const updatePlayDateNote = useCallback(
    async (date: string, note: string | null) => {
      if (!gameId) return;

      const existing = gamePlayDates.find((r) => r.date === date);
      if (existing) {
        const oldNote = existing.note;
        setGamePlayDates((prev) =>
          prev.map((r) => (r.date === date ? { ...r, note } : r))
        );
        const { error } = await updatePlayDateNoteQuery(
          supabase,
          gameId,
          date,
          note
        );
        if (error) {
          // Revert to old note
          setGamePlayDates((prev) =>
            prev.map((r) => (r.date === date ? { ...r, note: oldNote } : r))
          );
        }
      } else {
        const tempRow: GamePlayDate = {
          id: "temp-" + date,
          game_id: gameId,
          date,
          note,
          created_at: new Date().toISOString(),
        };
        setGamePlayDates((prev) => [...prev, tempRow]);
        const { data, error } = await upsertPlayDate(
          supabase,
          gameId,
          date,
          note
        );
        if (error) {
          // Revert: remove the temp row
          setGamePlayDates((prev) =>
            prev.filter((r) => r.id !== tempRow.id)
          );
        } else if (data) {
          setGamePlayDates((prev) =>
            prev.map((r) =>
              r.id === tempRow.id ? (data as GamePlayDate) : r
            )
          );
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
    [gameId, gamePlayDates]
  );

  return {
    // State
    game,
    loading,
    refreshing,
    availability,
    allAvailability,
    sessions,
    gamePlayDates,
    otherGames,

    // Actions
    refresh,
    changeAvailability,
    copyFromGame,
    confirmSession,
    cancelSession,
    regenerateInvite,
    leaveGame,
    removePlayer,
    deleteGame,
    toggleCoGm,
    toggleExtraDate,
    updatePlayDateNote,
  };
}
