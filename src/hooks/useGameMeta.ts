import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
import type { GameWithMembers } from '@/types';
import {
  fetchGameWithGM,
  fetchGameMembers,
  fetchUserOtherGames,
  regenerateInviteCode,
  leaveGame as leaveGameQuery,
  removePlayer as removePlayerQuery,
  deleteGame as deleteGameQuery,
  toggleCoGm as toggleCoGmQuery,
} from '@/lib/data';
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
  const [game, setGame] = useState<GameWithMembers | null>(null);
  const [otherGames, setOtherGames] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!gameId || !userId) return;

    const { data: gameData, error: gameError } = await fetchGameWithGM(supabase, gameId);
    if (gameError || !gameData) {
      setLoading(false);
      return;
    }

    const [membersRes, otherGamesList] = await Promise.all([
      fetchGameMembers(supabase, gameId),
      fetchUserOtherGames(supabase, userId, gameId),
    ]);

    setGame({ ...gameData, members: membersRes.data } as GameWithMembers);
    setOtherGames(otherGamesList);
    setLoading(false);
  }, [gameId, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
    if (userId) fetchAll();
  }, [userId, fetchAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const regenerateInvite = useCallback(async () => {
    if (!game || !gameId) return;
    const newCode = nanoid(10);
    const oldCode = game.invite_code;
    await withOptimistic({
      apply: () => setGame((prev) => (prev ? { ...prev, invite_code: newCode } : prev)),
      revert: () => setGame((prev) => (prev ? { ...prev, invite_code: oldCode } : prev)),
      mutation: () => regenerateInviteCode(supabase, gameId, newCode),
    });
  }, [game, gameId]);

  const leaveGame = useCallback(async (): Promise<boolean> => {
    if (!userId || !gameId) return false;
    const { error } = await leaveGameQuery(supabase, gameId, userId);
    return !error;
  }, [userId, gameId]);

  const removePlayer = useCallback(
    async (playerId: string): Promise<boolean> => {
      if (!gameId) return false;
      const { error } = await removePlayerQuery(supabase, gameId, playerId);
      if (error) return false;
      setGame((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.id !== playerId) } : prev,
      );
      return true;
    },
    [gameId],
  );

  const deleteGame = useCallback(async (): Promise<boolean> => {
    if (!gameId) return false;
    const { error } = await deleteGameQuery(supabase, gameId);
    return !error;
  }, [gameId]);

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
                m.id === playerId ? { ...m, is_co_gm: makeCoGm } : m,
              ),
            }
          : prev,
      );
      return true;
    },
    [gameId],
  );

  return {
    game,
    loading,
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
