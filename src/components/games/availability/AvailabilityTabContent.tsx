'use client';

import { format } from 'date-fns';
import type { GameSession, AvailabilityStatus } from '@/types';
import type { AvailabilityEntry } from '@/components/calendar/AvailabilityCalendar';
import { AvailabilityCalendar } from '@/components/calendar/AvailabilityCalendar';
import { AvailabilityHeader } from './AvailabilityHeader';
import { ApplyDefaultsButton } from './ApplyDefaultsButton';
import type { ApplyDefaultsResult } from '@/hooks/useAvailability';
import type { OtherGameSessionInfo } from '@/lib/otherGameSessions';

export interface AvailabilityTabContentProps {
  // Header
  windowStart: Date;
  windowEnd: Date;
  currentUserId: string;
  completionByUserId: Map<string, { answered: number; total: number }>;

  // Calendar
  playDays: number[];
  availability: Record<string, AvailabilityEntry>;
  onToggle: (
    date: string,
    status: AvailabilityStatus,
    comment: string | null,
    availableAfter: string | null,
    availableUntil: string | null
  ) => void;
  /** Applies a bulk status change in one call. When omitted, the calendar falls back to per-date onToggle calls. */
  onBulkSet?: (dates: string[], status: AvailabilityStatus) => void;
  confirmedSessions: GameSession[];
  extraPlayDates: string[];
  isGmOrCoGm: boolean;
  onToggleExtraDate: (date: string) => void;
  weekStartDay: 0 | 1;
  use24h: boolean;
  otherGames: { id: string; name: string }[];
  otherGameSessionsByDate?: Map<string, OtherGameSessionInfo[]>;
  onCopyFromGame: (
    sourceGameId: string,
    conflict: import('@/lib/copyAvailability').CopyConflict | null,
  ) => Promise<{ copied: number; overridden: number }>;
  onApplyDefaults?: () => Promise<ApplyDefaultsResult>;
  hasDefaults?: boolean | null;
  playDateNotes: Map<string, string>;
  onUpdatePlayDateNote: (date: string, note: string | null) => void;
  hasCampaignDates: boolean;

  // Empty-state banners
  adHocOnly: boolean;

  /** Renders the calendar non-interactive (admin peek view). */
  readOnly?: boolean;
}

export function AvailabilityTabContent(props: AvailabilityTabContentProps) {
  const {
    windowStart, windowEnd, currentUserId, completionByUserId,
    playDays, availability, onToggle, onBulkSet, confirmedSessions, extraPlayDates,
    isGmOrCoGm, onToggleExtraDate, weekStartDay, use24h, otherGames,
    onCopyFromGame, onApplyDefaults, hasDefaults, playDateNotes, onUpdatePlayDateNote, hasCampaignDates,
    adHocOnly, readOnly = false, otherGameSessionsByDate = new Map(),
  } = props;

  const monthRange = `${format(windowStart, 'MMM')} – ${format(windowEnd, 'MMM yyyy')}`;
  const myProgress = completionByUserId.get(currentUserId) ?? { answered: 0, total: 0 };
  const showEmptyAdHocPlayer = adHocOnly && extraPlayDates.length === 0 && !isGmOrCoGm && !readOnly;
  const showEmptyAdHocGm = adHocOnly && extraPlayDates.length === 0 && isGmOrCoGm && !readOnly;

  return (
    <div className="space-y-5" data-testid="availability-tab-content">
      <AvailabilityHeader
        monthRange={monthRange}
        answered={myProgress.answered}
        total={myProgress.total}
        readOnly={readOnly}
      />

      {showEmptyAdHocPlayer && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
          <p className="text-sm text-primary">
            No play dates have been added yet. Your GM will add dates to the calendar when
            they&apos;re ready — check back soon!
          </p>
        </div>
      )}
      {showEmptyAdHocGm && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
          <p className="text-sm text-primary">
            Add potential play dates by clicking the + on any date in the calendar below
            (or long-press on mobile).
          </p>
        </div>
      )}

      <AvailabilityCalendar
        playDays={playDays}
        windowStart={windowStart}
        windowEnd={windowEnd}
        availability={availability}
        onToggle={onToggle}
        onBulkSet={onBulkSet}
        confirmedSessions={confirmedSessions}
        extraPlayDates={extraPlayDates}
        isGmOrCoGm={isGmOrCoGm}
        onToggleExtraDate={onToggleExtraDate}
        weekStartDay={weekStartDay}
        use24h={use24h}
        otherGames={otherGames}
        otherGameSessionsByDate={otherGameSessionsByDate}
        onCopyFromGame={onCopyFromGame}
        bulkActionsLead={
          onApplyDefaults ? (
            <ApplyDefaultsButton onApplyDefaults={onApplyDefaults} hasDefaults={hasDefaults ?? null} />
          ) : undefined
        }
        playDateNotes={playDateNotes}
        onUpdatePlayDateNote={onUpdatePlayDateNote}
        hasCampaignDates={hasCampaignDates}
        readOnly={readOnly}
      />
    </div>
  );
}
