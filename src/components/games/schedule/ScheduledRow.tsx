'use client';

import { format, parseISO } from 'date-fns';
import { Calendar, X } from 'lucide-react';
import type { DateSuggestion, GameSession } from '@/types';
import { Avatar, Button } from '@/components/ui';
import { formatTime } from '@/lib/formatting';
import { convertTimeForDisplay } from '@/lib/timezone';

interface ScheduledRowProps {
  session: GameSession;
  suggestion: DateSuggestion | undefined;
  timezone: string | null | undefined;
  userTimezone: string | null;
  use24h: boolean;
  isGm: boolean;
  playDateNote: string | null;
  past?: boolean;
  onDownloadIcs: (session: GameSession) => void;
  onRequestCancel: (session: GameSession) => void;
}

export function ScheduledRow({
  session, suggestion, timezone, userTimezone, use24h, isGm, playDateNote, past = false,
  onDownloadIcs, onRequestCancel,
}: ScheduledRowProps) {
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

  return (
    <li
      data-testid={past ? 'past-session-row' : 'scheduled-row'}
      className={`rounded-xl border border-border bg-card p-4 ${past ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className={`text-lg leading-none ${past ? 'text-muted-foreground' : 'text-primary'}`}>★</span>
        <div className="min-w-0 flex-1">
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
        </div>
        {!past && (
          <div className="flex shrink-0 gap-2">
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
                title="Cancel this scheduled session and notify the party"
              >
                <X className="mr-1 size-4" /> Cancel
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
