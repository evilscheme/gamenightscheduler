'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, ChevronRight, X } from 'lucide-react';
import type { DateSuggestion, GameSession } from '@/types';
import { Avatar, Button, EyebrowLabel } from '@/components/ui';
import { formatTime } from '@/lib/formatting';
import { convertTimeForDisplay } from '@/lib/timezone';
import { PartyBreakdown } from './PartyBreakdown';

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
  const expandable = !!suggestion;

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

  const availableAvatars = (suggestion?.availablePlayers ?? []).slice(0, 6);
  const maybeAvatars = (suggestion?.maybePlayers ?? []).slice(0, 4);

  const infoContent = (
    <>
      <p className="font-semibold text-card-foreground">
        {format(parseISO(session.date), 'EEEE, MMMM d, yyyy')}
      </p>
      <p className="font-mono text-xs text-muted-foreground">{timeLine()}</p>
      {playDateNote && (
        <p className="mt-0.5 text-xs italic text-muted-foreground">{playDateNote}</p>
      )}
      {(availableAvatars.length > 0 || maybeAvatars.length > 0) && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex -space-x-1">
            {availableAvatars.map((p) => (
              <Avatar key={p.user.id} userId={p.user.id} name={p.user.name} size={18} ring="available" />
            ))}
            {maybeAvatars.map((p) => (
              <Avatar key={p.user.id} userId={p.user.id} name={p.user.name} size={18} ring="maybe" />
            ))}
          </div>
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
      <div className="flex items-start gap-3">
        <span className={`text-lg leading-none ${past ? 'text-muted-foreground' : 'text-primary'}`}>★</span>
        {expandable ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
            title={expanded ? 'Hide party breakdown' : 'Show who can make it'}
          >
            <div className="min-w-0 flex-1">{infoContent}</div>
            <ChevronRight
              className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${
                expanded ? 'rotate-90' : ''
              }`}
            />
          </button>
        ) : (
          <div className="min-w-0 flex-1">{infoContent}</div>
        )}
        {!past && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDownloadIcs(session)}
              data-testid="ics-download-single"
              title="Download a calendar file (.ics) you can import into Google Calendar, Apple Calendar, or Outlook"
              aria-label="Add to calendar"
            >
              <Calendar className="size-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Add to calendar</span>
            </Button>
            {isGm && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onRequestCancel(session)}
                title="Cancel this scheduled session"
                aria-label="Cancel session"
              >
                <X className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {expandable && expanded && (
        <div className="mt-3 border-t border-border pt-3">
          <EyebrowLabel variant="muted" className="mb-2 block">Party breakdown</EyebrowLabel>
          <PartyBreakdown suggestion={suggestion!} gmId={gmId} coGmIds={coGmIds} use24h={use24h} />
        </div>
      )}
    </li>
  );
}
