import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GamePlayDate } from '@/types';
import {
  fetchGamePlayDates,
  addPlayDate,
  removePlayDate,
  updatePlayDateNote as updatePlayDateNoteQuery,
  upsertPlayDate,
} from '@/lib/data';

const supabase = createClient();

export interface UsePlayDatesReturn {
  gamePlayDates: GamePlayDate[];
  loading: boolean;
  toggleExtraDate: (date: string, isCurrentlyExtra: boolean) => Promise<void>;
  updatePlayDateNote: (date: string, note: string | null) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePlayDates(gameId: string, ready: boolean): UsePlayDatesReturn {
  const [gamePlayDates, setGamePlayDates] = useState<GamePlayDate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!gameId) return;
    const { data } = await fetchGamePlayDates(supabase, gameId);
    setGamePlayDates(data || []);
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
    if (ready) fetchAll();
  }, [ready, fetchAll]);

  const toggleExtraDate = useCallback(
    async (date: string, isCurrentlyExtra: boolean) => {
      if (!gameId) return;

      if (isCurrentlyExtra) {
        const existingRow = gamePlayDates.find((r) => r.date === date);
        if (!existingRow) return;
        setGamePlayDates((prev) => prev.filter((r) => r.date !== date));
        const { error } = await removePlayDate(supabase, gameId, date);
        if (error) {
          setGamePlayDates((prev) =>
            [...prev, existingRow].sort((a, b) => a.date.localeCompare(b.date)),
          );
        }
        return;
      }

      const tempRow: GamePlayDate = {
        id: 'temp-' + date,
        game_id: gameId,
        date,
        note: null,
        created_at: new Date().toISOString(),
      };
      setGamePlayDates((prev) =>
        [...prev, tempRow].sort((a, b) => a.date.localeCompare(b.date)),
      );

      const { data, error } = await addPlayDate(supabase, gameId, date);
      if (error) {
        setGamePlayDates((prev) => prev.filter((r) => r.date !== date));
      } else if (data) {
        setGamePlayDates((prev) =>
          prev.map((r) => (r.id === tempRow.id ? (data as GamePlayDate) : r)),
        );
      }
    },
    [gameId, gamePlayDates],
  );

  const updatePlayDateNote = useCallback(
    async (date: string, note: string | null) => {
      if (!gameId) return;
      const existing = gamePlayDates.find((r) => r.date === date);

      if (existing) {
        const oldNote = existing.note;
        setGamePlayDates((prev) => prev.map((r) => (r.date === date ? { ...r, note } : r)));
        const { error } = await updatePlayDateNoteQuery(supabase, gameId, date, note);
        if (error) {
          setGamePlayDates((prev) =>
            prev.map((r) => (r.date === date ? { ...r, note: oldNote } : r)),
          );
        }
        return;
      }

      const tempRow: GamePlayDate = {
        id: 'temp-' + date,
        game_id: gameId,
        date,
        note,
        created_at: new Date().toISOString(),
      };
      setGamePlayDates((prev) => [...prev, tempRow]);
      const { data, error } = await upsertPlayDate(supabase, gameId, date, note);
      if (error) {
        setGamePlayDates((prev) => prev.filter((r) => r.id !== tempRow.id));
      } else if (data) {
        setGamePlayDates((prev) =>
          prev.map((r) => (r.id === tempRow.id ? (data as GamePlayDate) : r)),
        );
      }
    },
    [gameId, gamePlayDates],
  );

  return { gamePlayDates, loading, toggleExtraDate, updatePlayDateNote, refresh: fetchAll };
}
