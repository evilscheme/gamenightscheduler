'use client';

import { format, parseISO, startOfDay, isBefore, differenceInCalendarDays } from 'date-fns';
import { Calendar, Link2, Star } from 'lucide-react';
import { Button, EyebrowLabel } from '@/components/ui';
import type { GameSession } from '@/types';
import { formatTime } from '@/lib/formatting';

interface UpcomingSessionsCardProps {
  sessions: GameSession[];
  use24h: boolean;
  subscribeUrl: string;
  onDownloadIcs: (session: GameSession) => void;
  onDownloadAllIcs: () => void;
  onCopySubscribe: () => void;
}

function relativeLabel(daysFromNow: number): string {
  if (daysFromNow === 0) return 'today';
  if (daysFromNow === 1) return 'tomorrow';
  if (daysFromNow < 7) return `in ${daysFromNow} days`;
  if (daysFromNow < 14) return 'next week';
  if (daysFromNow < 30) return `in ${Math.round(daysFromNow / 7)} weeks`;
  return `in ${Math.round(daysFromNow / 30)} months`;
}

export function UpcomingSessionsCard({
  sessions,
  use24h,
  subscribeUrl,
  onDownloadIcs,
  onDownloadAllIcs,
  onCopySubscribe,
}: UpcomingSessionsCardProps) {
  const today = startOfDay(new Date());
  const upcoming = sessions
    .filter((s) => !isBefore(parseISO(s.date), today))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Star className="size-4 fill-primary text-primary" />
          <EyebrowLabel>Upcoming sessions ({upcoming.length})</EyebrowLabel>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {upcoming.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDownloadAllIcs}
              title="Download a single calendar file containing all upcoming sessions"
            >
              <Calendar className="mr-1 size-3" /> Add all to calendar
            </Button>
          )}
          {subscribeUrl && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCopySubscribe}
              title="Copy a webcal:// URL that auto-syncs scheduled sessions to Google Calendar, Apple Calendar, or Outlook"
            >
              <Link2 className="mr-1 size-3" /> Subscribe
            </Button>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {upcoming.map((s) => {
          const date = parseISO(s.date);
          const daysFromNow = differenceInCalendarDays(date, today);
          const monthAbbr = format(date, 'MMM').toUpperCase();
          const dayNum = format(date, 'd');
          const fullDateLabel = format(date, 'EEEE, MMMM d');
          const sameYear = date.getFullYear() === today.getFullYear();
          const heading = sameYear ? fullDateLabel : `${fullDateLabel}, ${format(date, 'yyyy')}`;
          const timeWindow =
            s.start_time && s.end_time
              ? `${formatTime(s.start_time, use24h)} – ${formatTime(s.end_time, use24h)}`
              : null;

          return (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-md border border-primary/25 bg-primary/15">
                <span className="font-mono text-[9px] font-bold tracking-wider text-primary">
                  {monthAbbr}
                </span>
                <span className="font-mono text-base font-bold leading-none text-primary">
                  {dayNum}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-card-foreground">{heading}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {timeWindow && <span className="font-mono">{timeWindow}</span>}
                  {timeWindow && <span aria-hidden>·</span>}
                  <span>{relativeLabel(daysFromNow)}</span>
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDownloadIcs(s)}
                title="Download a calendar file (.ics) you can import into Google Calendar, Apple Calendar, or Outlook"
                className="shrink-0"
              >
                <Calendar className="mr-1 size-3" /> Add to calendar
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
