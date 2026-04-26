'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DateSuggestion, GameSession } from '@/types';
import { EyebrowLabel, Button } from '@/components/ui';
import { splitUpcomingPast } from '@/lib/scheduleView';
import { ScheduledRow } from './ScheduledRow';

interface ScheduledListProps {
  sessions: GameSession[];
  suggestions: DateSuggestion[];
  timezone: string | null | undefined;
  userTimezone: string | null;
  use24h: boolean;
  isGm: boolean;
  playDateNotes: Map<string, string> | undefined;
  onDownloadIcs: (session: GameSession) => void;
  onDownloadAllIcs: () => void;
  onRequestCancel: (session: GameSession) => void;
}

export function ScheduledList({
  sessions, suggestions, timezone, userTimezone, use24h, isGm, playDateNotes,
  onDownloadIcs, onDownloadAllIcs, onRequestCancel,
}: ScheduledListProps) {
  const [showPast, setShowPast] = useState(false);
  const confirmed = sessions.filter((s) => s.status === 'confirmed');
  const { upcoming, past } = splitUpcomingPast(confirmed, new Date());
  const suggestionByDate = new Map(suggestions.map((s) => [s.date, s]));

  if (upcoming.length === 0 && past.length === 0) return null;

  return (
    <section className="space-y-3">
      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <EyebrowLabel>Upcoming sessions</EyebrowLabel>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDownloadAllIcs}
              title="Download a single calendar file containing all upcoming sessions"
            >
              Add all to calendar
            </Button>
          </div>
          <ul className="space-y-2" data-testid="upcoming-sessions-list">
            {upcoming.map((s) => (
              <ScheduledRow
                key={s.id}
                session={s}
                suggestion={suggestionByDate.get(s.date)}
                timezone={timezone}
                userTimezone={userTimezone}
                use24h={use24h}
                isGm={isGm}
                playDateNote={playDateNotes?.get(s.date) ?? null}
                onDownloadIcs={onDownloadIcs}
                onRequestCancel={onRequestCancel}
              />
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <div data-testid="past-sessions">
          <button
            type="button"
            aria-expanded={showPast}
            onClick={() => setShowPast((v) => !v)}
            className="flex w-full items-center justify-between py-1"
            title={showPast ? 'Hide past sessions' : 'Show past sessions'}
          >
            <EyebrowLabel variant="muted">Previous sessions · {past.length}</EyebrowLabel>
            {showPast ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </button>
          {showPast && (
            <ul className="mt-2 space-y-2">
              {past.map((s) => (
                <ScheduledRow
                  key={s.id}
                  session={s}
                  suggestion={suggestionByDate.get(s.date)}
                  timezone={timezone}
                  userTimezone={userTimezone}
                  use24h={use24h}
                  isGm={isGm}
                  playDateNote={playDateNotes?.get(s.date) ?? null}
                  past
                  onDownloadIcs={onDownloadIcs}
                  onRequestCancel={onRequestCancel}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
