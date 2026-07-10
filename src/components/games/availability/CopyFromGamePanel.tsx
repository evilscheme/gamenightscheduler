'use client';

import { useState } from 'react';
import { parseISO, startOfDay } from 'date-fns';
import { Button } from '@/components/ui';
import type { AvailabilityEntry } from '@/lib/availability';
import type { AvailabilityStatus } from '@/types';
import {
  filterSessionConflictsForCopy,
  type CopyConflict,
} from '@/lib/availability';
import type { OtherGameSessionInfo } from '@/lib/schedule';
import { CopyConflictModal } from './CopyConflictModal';

interface CopyFromGamePanelProps {
  otherGames: { id: string; name: string }[];
  otherGameSessionsByDate: Map<string, OtherGameSessionInfo[]>;
  availability: Record<string, AvailabilityEntry>;
  playDays: number[];
  extraPlayDates: string[];
  windowEnd: Date;
  onCopyFromGame: (
    sourceGameId: string,
    conflict: CopyConflict | null,
  ) => Promise<{ copied: number; overridden: number }>;
}

export function CopyFromGamePanel({
  otherGames,
  otherGameSessionsByDate,
  availability,
  playDays,
  extraPlayDates,
  windowEnd,
  onCopyFromGame,
}: CopyFromGamePanelProps) {
  const [sourceGameId, setSourceGameId] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<{
    sourceGameName: string;
    conflictDates: string[];
  } | null>(null);

  const sourceGameName = otherGames.find((g) => g.id === sourceGameId)?.name ?? 'game';

  // The source game's confirmed-session dates currently held in memory.
  const candidateDates = () => {
    const dates: string[] = [];
    for (const [date, infos] of otherGameSessionsByDate) {
      if (infos.some((i) => i.gameId === sourceGameId)) dates.push(date);
    }
    return dates;
  };

  const runCopy = async (conflict: CopyConflict | null) => {
    setIsCopying(true);
    setResultMessage(null);
    try {
      const { copied, overridden } = await onCopyFromGame(sourceGameId, conflict);
      if (copied === 0 && overridden === 0) {
        setResultMessage('No new dates to copy');
      } else {
        const base = `Copied ${copied} date${copied !== 1 ? 's' : ''} from ${sourceGameName}`;
        const status = conflict?.status;
        setResultMessage(
          overridden > 0 && status
            ? `${base} · ${overridden} marked ${status}`
            : base,
        );
      }
      setTimeout(() => setResultMessage(null), 4000);
    } catch {
      setResultMessage('Failed to copy availability');
      setTimeout(() => setResultMessage(null), 4000);
    } finally {
      setIsCopying(false);
    }
  };

  const handleCopyClick = () => {
    if (!sourceGameId) return;
    const conflictDates = filterSessionConflictsForCopy({
      conflictCandidateDates: candidateDates(),
      destinationAvailability: availability,
      destinationPlayDays: playDays,
      destinationExtraPlayDates: extraPlayDates,
      today: startOfDay(new Date()),
      windowEndDate: windowEnd,
      parseDate: parseISO,
    });

    if (conflictDates.length > 0) {
      setPendingConflict({ sourceGameName, conflictDates });
    } else {
      runCopy(null);
    }
  };

  const handleConfirmConflict = (status: AvailabilityStatus) => {
    const dates = pendingConflict?.conflictDates ?? [];
    setPendingConflict(null);
    runCopy({ dates, status });
  };

  return (
    <div className="bg-secondary rounded-lg p-3 flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground">Copy from</span>
      <select
        value={sourceGameId}
        onChange={(e) => {
          setSourceGameId(e.target.value);
          setResultMessage(null);
        }}
        className="h-8 px-2 rounded-md border border-border bg-card text-card-foreground text-sm max-w-50"
        data-testid="copy-game-select"
      >
        <option value="">Select a game</option>
        {otherGames.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        onClick={handleCopyClick}
        disabled={!sourceGameId || isCopying}
        className="h-8"
        data-testid="copy-game-button"
      >
        {isCopying ? 'Copying...' : 'Copy'}
      </Button>
      {resultMessage && (
        <span className="text-xs text-muted-foreground" data-testid="copy-result-message">
          {resultMessage}
        </span>
      )}

      {pendingConflict && (
        <CopyConflictModal
          sourceGameName={pendingConflict.sourceGameName}
          conflictDates={pendingConflict.conflictDates}
          onConfirm={handleConfirmConflict}
          onCancel={() => setPendingConflict(null)}
        />
      )}
    </div>
  );
}
