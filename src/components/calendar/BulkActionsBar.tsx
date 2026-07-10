'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import type { AvailabilityStatus } from '@/types';
import { DAY_LABELS } from '@/lib/constants';
import type { AvailabilityEntry } from '@/lib/availability';
import type { OtherGameSessionInfo } from '@/lib/schedule';
import { CopyFromGamePanel } from '@/components/games/availability/CopyFromGamePanel';

interface BulkActionsBarProps {
  playDays: number[];
  /** Runs the batched status change for the selected day filter. */
  onApply: (filter: string, status: AvailabilityStatus) => void;
  /** e.g. "Apply my default availability" — rendered as its own panel alongside "Mark all". */
  bulkActionsLead?: ReactNode;
  otherGames?: { id: string; name: string }[];
  otherGameSessionsByDate: Map<string, OtherGameSessionInfo[]>;
  availability: Record<string, AvailabilityEntry>;
  extraPlayDates: string[];
  windowEnd: Date;
  onCopyFromGame?: (
    sourceGameId: string,
    conflict: import('@/lib/availability').CopyConflict | null,
  ) => Promise<{ copied: number; overridden: number }>;
}

// Bulk actions bar: "Apply my default availability" (optional lead), "Mark all
// [days] as [status]", and "Copy from [game]" — each its own panel.
export function BulkActionsBar({
  playDays,
  onApply,
  bulkActionsLead,
  otherGames,
  otherGameSessionsByDate,
  availability,
  extraPlayDates,
  windowEnd,
  onCopyFromGame,
}: BulkActionsBarProps) {
  const [bulkDayFilter, setBulkDayFilter] = useState<string>("remaining");
  const [bulkStatus, setBulkStatus] = useState<AvailabilityStatus>("available");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start text-sm">
      {/* Apply my default availability — its own panel */}
      {bulkActionsLead && (
        <div className="bg-secondary rounded-lg p-3">{bulkActionsLead}</div>
      )}

      {/* Mark all — its own panel */}
      <div className="bg-secondary rounded-lg p-3 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Mark all</span>
        <select
          value={bulkDayFilter}
          onChange={(e) => setBulkDayFilter(e.target.value)}
          className="h-8 px-2 rounded-md border border-border bg-card text-card-foreground text-sm"
          aria-label="Day of week"
        >
          <option value="remaining">remaining days</option>
          {playDays.map((day) => (
            <option key={day} value={day}>
              {DAY_LABELS.full[day]}s
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">as</span>
        <select
          value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value as AvailabilityStatus)}
          className="h-8 px-2 rounded-md border border-border bg-card text-card-foreground text-sm"
          aria-label="Availability status"
        >
          <option value="available">available</option>
          <option value="unavailable">unavailable</option>
          <option value="maybe">maybe</option>
        </select>
        <Button size="sm" onClick={() => onApply(bulkDayFilter, bulkStatus)} className="h-8">
          Apply
        </Button>
      </div>

      {/* Copy from — its own panel */}
      {otherGames && otherGames.length > 0 && onCopyFromGame && (
        <CopyFromGamePanel
          otherGames={otherGames}
          otherGameSessionsByDate={otherGameSessionsByDate}
          availability={availability}
          playDays={playDays}
          extraPlayDates={extraPlayDates}
          windowEnd={windowEnd}
          onCopyFromGame={onCopyFromGame}
        />
      )}
    </div>
  );
}
