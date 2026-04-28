'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, ChevronRight, X } from 'lucide-react';
import type { DateSuggestion, GameSession } from '@/types';
import { Button, EyebrowLabel } from '@/components/ui';
import { formatTime } from '@/lib/formatting';
import { convertTimeForDisplay } from '@/lib/timezone';
import { PartyBreakdown } from './PartyBreakdown';
import { PlayerAvatarCluster, type PlayerAvatarItem } from './PlayerAvatarCluster';

interface ScheduledRowProps {
  session: GameSession;
  suggestion: DateSuggestion | undefined;
  timezone: string | null | undefined;
  userTimezone: string | null;
  use24h: boolean;
  isGm: boolean;
  gmId: string;
  coGmIds: Set<string>;
  playDateNote: string | null;
  past?: boolean;
  onDownloadIcs: (session: GameSession) => void;
  onRequestCancel: (session: GameSession) => void;
}

export function ScheduledRow({
  session, suggestion, timezone, userTimezone, use24h, isGm, gmId, coGmIds,
  playDateNote, past = false, onDownloadIcs, onRequestCancel,
}: ScheduledRowProps) {
  const [expanded, setExpanded] = useState(false);
  // Expandable when there's something in the expanded section worth showing:
  // a party breakdown (from suggestion) or the calendar/cancel actions (upcoming only).
  const expandable = !!suggestion || !past;

  const timeLine = () => {
    if (!session.start_time || !session.end_time) return format(parseISO(session.date), 'EEEE');
    const base = `${formatTime(session.start_time, use24h)} – ${formatTime(session.end_time, use24h)}`;
    if (!timezone) return base;
    const startConv = convertTimeForDisplay(session.date, session.start_time, timezone, userTimezone, use24h);
    const endConv = convertTimeForDisplay(session.date, session.end_time, timezone, userTimezone, use24h);
    const gameStr = `${base} ${startConv.gameTzAbbrev}`;
    if (startConv.isDifferentTz && startConv.userTime && endConv.userTime) {
      return `${gameStr} (${startConv.userTime} – ${endConv.userTime} ${startConv.userTzAbbrev} for you)`;
    }
    return gameStr;
  };

  const visibleAvatars: PlayerAvatarItem[] = [
    ...(suggestion?.availablePlayers ?? []).slice(0, 6).map((p) => ({
      user: p.user,
      state: 'available' as const,
    })),
    ...(suggestion?.maybePlayers ?? []).slice(0, 4).map((p) => ({
      user: p.user,
      state: 'maybe' as const,
    })),
  ];

  const sessionDate = parseISO(session.date);
  const sameYear = sessionDate.getFullYear() === new Date().getFullYear();
  const dateLabel = sameYear
    ? format(sessionDate, 'EEE, MMM d')
    : format(sessionDate, 'EEE, MMM d, yyyy');

  const infoContent = (
    <>
      <p className="font-semibold text-card-foreground">{dateLabel}</p>
      <p className="font-mono text-xs text-muted-foreground">{timeLine()}</p>
      {playDateNote && (
        <p className="mt-0.5 text-xs italic text-muted-foreground">{playDateNote}</p>
      )}
      {visibleAvatars.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <PlayerAvatarCluster avatars={visibleAvatars} />
          {suggestion && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {suggestion.availableCount}✓ · {suggestion.maybeCount}? · {suggestion.unavailableCount}✕
            </span>
          )}
        </div>
      )}
    </>
  );

  return (
    <li
      data-testid={past ? 'past-session-row' : 'scheduled-row'}
      className={`rounded-xl border border-border bg-card p-4 ${past ? 'opacity-70' : ''}`}
    >
      {expandable ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-start gap-3 text-left"
          title={expanded ? 'Hide details' : 'Show details'}
        >
          <span className={`text-lg leading-none ${past ? 'text-muted-foreground' : 'text-primary'}`}>★</span>
          <div className="min-w-0 flex-1">{infoContent}</div>
          <ChevronRight
            className={`mt-0.5 size-4 shrink-0 self-center text-muted-foreground transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        </button>
      ) : (
        <div className="flex items-start gap-3">
          <span className={`text-lg leading-none ${past ? 'text-muted-foreground' : 'text-primary'}`}>★</span>
          <div className="min-w-0 flex-1">{infoContent}</div>
        </div>
      )}

      {expandable && expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {suggestion && (
            <div>
              <EyebrowLabel variant="muted" className="mb-2 block">Party breakdown</EyebrowLabel>
              <PartyBreakdown suggestion={suggestion} gmId={gmId} coGmIds={coGmIds} use24h={use24h} />
            </div>
          )}
          {!past && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDownloadIcs(session)}
                data-testid="ics-download-single"
                title="Download a calendar file (.ics) you can import into Google Calendar, Apple Calendar, or Outlook"
              >
                <Calendar className="mr-1.5 size-4" /> Add to calendar
              </Button>
              {isGm && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onRequestCancel(session)}
                  title="Cancel this scheduled session"
                  aria-label="Cancel"
                >
                  <X className="mr-1 size-4" /> Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
