'use client';

import { format } from 'date-fns';
import type { GameSession, AvailabilityStatus } from '@/types';
import type { AvailabilityEntry } from '@/components/calendar/AvailabilityCalendar';
import { AvailabilityCalendar } from '@/components/calendar/AvailabilityCalendar';
import { AvailabilityHeader } from './AvailabilityHeader';

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
  confirmedSessions: GameSession[];
  extraPlayDates: string[];
  isGmOrCoGm: boolean;
  onToggleExtraDate: (date: string) => void;
  weekStartDay: 0 | 1;
  use24h: boolean;
  otherGames: { id: string; name: string }[];
  onCopyFromGame: (sourceGameId: string) => Promise<number>;
  playDateNotes: Map<string, string>;
  onUpdatePlayDateNote: (date: string, note: string | null) => void;
  hasCampaignDates: boolean;

  // Empty-state banners
  adHocOnly: boolean;
}

export function AvailabilityTabContent(props: AvailabilityTabContentProps) {
  const {
    windowStart, windowEnd, currentUserId, completionByUserId,
    playDays, availability, onToggle, confirmedSessions, extraPlayDates,
    isGmOrCoGm, onToggleExtraDate, weekStartDay, use24h, otherGames,
    onCopyFromGame, playDateNotes, onUpdatePlayDateNote, hasCampaignDates,
    adHocOnly,
  } = props;

  const monthRange = `${format(windowStart, 'MMM')} – ${format(windowEnd, 'MMM yyyy')}`;
  const myProgress = completionByUserId.get(currentUserId) ?? { answered: 0, total: 0 };
  const showEmptyAdHocPlayer = adHocOnly && extraPlayDates.length === 0 && !isGmOrCoGm;
  const showEmptyAdHocGm = adHocOnly && extraPlayDates.length === 0 && isGmOrCoGm;

  return (
    <div className="space-y-5" data-testid="availability-tab-content">
      <AvailabilityHeader
        monthRange={monthRange}
        answered={myProgress.answered}
        total={myProgress.total}
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
        confirmedSessions={confirmedSessions}
        extraPlayDates={extraPlayDates}
        isGmOrCoGm={isGmOrCoGm}
        onToggleExtraDate={onToggleExtraDate}
        weekStartDay={weekStartDay}
        use24h={use24h}
        otherGames={otherGames}
        onCopyFromGame={onCopyFromGame}
        playDateNotes={playDateNotes}
        onUpdatePlayDateNote={onUpdatePlayDateNote}
        hasCampaignDates={hasCampaignDates}
      />
    </div>
  );
}
