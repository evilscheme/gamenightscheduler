import { useState, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
import type { GameWithMembers } from '@/types';
import {
  fetchGameWithGM,
  fetchGameMembers,
  fetchMyGamesLite,
  regenerateInviteCode,
  leaveGame as leaveGameQuery,
  removePlayer as removePlayerQuery,
  deleteGame as deleteGameQuery,
  toggleCoGm as toggleCoGmQuery,
} from '@/lib/data';
import { invalidateGamesLists, queryKeys } from '@/lib/queryKeys';
import { withOptimistic } from './withOptimistic';

export interface UseGameMetaReturn {
  game: GameWithMembers | null;
  loading: boolean;
  refreshing: boolean;
  otherGames: { id: string; name: string }[];
  refresh: () => Promise<void>;
  regenerateInvite: () => Promise<void>;
  leaveGame: () => Promise<boolean>;
  removePlayer: (playerId: string) => Promise<boolean>;
  deleteGame: () => Promise<boolean>;
  toggleCoGm: (playerId: string, makeCoGm: boolean) => Promise<boolean>;
}

export function useGameMeta(gameId: string, userId: string): UseGameMetaReturn {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const gameQuery = useQuery({
    queryKey: queryKeys.game(gameId),
    enabled: !!gameId && !!userId,
    queryFn: async (): Promise<GameWithMembers | null> => {
      // Game and member list are independent; fetch them in parallel.
      const [gameRes, membersRes] = await Promise.all([
        fetchGameWithGM(supabase, gameId),
        fetchGameMembers(supabase, gameId),
      ]);
      // Not found (or not a participant, which RLS reports the same way).
      if (gameRes.error || !gameRes.data) return null;
      return { ...gameRes.data, members: membersRes.data } as GameWithMembers;
    },
  });

  // Shared across game pages and kept fresh by join/create/leave invalidations;
  // the current game is excluded at render rather than baked into the fetch.
  const myGamesQuery = useQuery({
    queryKey: queryKeys.myGamesLite(userId),
    enabled: !!userId,
    queryFn: () => fetchMyGamesLite(supabase, userId),
  });

  const game = gameQuery.data ?? null;
  const otherGames = useMemo(
    () => (myGamesQuery.data ?? []).filter((g) => g.id !== gameId),
    [myGamesQuery.data, gameId]
  );

  const setGame = useCallback(
    (updater: (prev: GameWithMembers | null) => GameWithMembers | null) => {
      queryClient.setQueryData<GameWithMembers | null>(
        queryKeys.game(gameId),
        (prev) => updater(prev ?? null)
      );
    },
    [queryClient, gameId]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myGamesLite(userId) }),
    ]);
    setRefreshing(false);
  }, [queryClient, gameId, userId]);

  const regenerateInvite = useCallback(async () => {
    if (!game || !gameId) return;
    const newCode = nanoid(10);
    const oldCode = game.invite_code;
    await withOptimistic({
      apply: () => setGame((prev) => (prev ? { ...prev, invite_code: newCode } : prev)),
      revert: () => setGame((prev) => (prev ? { ...prev, invite_code: oldCode } : prev)),
      mutation: () => regenerateInviteCode(supabase, gameId, newCode),
    });
  }, [game, gameId, setGame]);

  const leaveGame = useCallback(async (): Promise<boolean> => {
    if (!userId || !gameId) return false;
    const { error } = await leaveGameQuery(supabase, gameId, userId);
    if (error) return false;
    // This game must disappear from the games lists on next visit.
    queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
    invalidateGamesLists(queryClient);
    return true;
  }, [userId, gameId, queryClient]);

  const removePlayer = useCallback(
    async (playerId: string): Promise<boolean> => {
      if (!gameId) return false;
      const { error } = await removePlayerQuery(supabase, gameId, playerId);
      if (error) return false;
      setGame((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.id !== playerId) } : prev
      );
      // Dashboard shows per-game member counts.
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll });
      return true;
    },
    [gameId, setGame, queryClient]
  );

  const deleteGame = useCallback(async (): Promise<boolean> => {
    if (!gameId) return false;
    const { error } = await deleteGameQuery(supabase, gameId);
    if (error) return false;
    queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
    invalidateGamesLists(queryClient);
    return true;
  }, [gameId, queryClient]);

  const toggleCoGm = useCallback(
    async (playerId: string, makeCoGm: boolean): Promise<boolean> => {
      if (!gameId) return false;
      const { error } = await toggleCoGmQuery(supabase, gameId, playerId, makeCoGm);
      if (error) return false;
      setGame((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((m) =>
                m.id === playerId ? { ...m, is_co_gm: makeCoGm } : m
              ),
            }
          : prev
      );
      return true;
    },
    [gameId, setGame]
  );

  return {
    game,
    loading: gameQuery.isPending,
    refreshing,
    otherGames,
    refresh,
    regenerateInvite,
    leaveGame,
    removePlayer,
    deleteGame,
    toggleCoGm,
  };
}
