'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { DateSuggestion, GameSession, MemberWithRole } from '@/types';
import { HoverSyncProvider } from './HoverSyncContext';
import { ScheduleHeader } from './ScheduleHeader';
import { RankedList } from './RankedList';
import { MiniCalendar } from './MiniCalendar';
import { ResponseStatus } from './ResponseStatus';
import { ScheduledList } from './ScheduledList';
import { ScheduleSessionModal } from './ScheduleSessionModal';
import { CancelSessionModal } from './CancelSessionModal';
import { CalendarHoverPopover } from './CalendarHoverPopover';
import { generateICS } from '@/lib/ics';
import { useToast } from '@/components/ui/Toast';
import { Button, EyebrowLabel } from '@/components/ui';
import { Link2 } from 'lucide-react';

export interface ScheduleTabContentProps {
  suggestions: DateSuggestion[];
  sessions: GameSession[];
  members: MemberWithRole[];
  gmId: string;
  isGm: boolean;
  gameName: string;
  playDays: number[];
  windowStart: Date;
  windowEnd: Date;
  specialPlayDates: Set<string>;
  playDateNotes?: Map<string, string>;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  timezone?: string | null;
  userTimezone?: string | null;
  use24h?: boolean;
  weekStartDay: number;
  minPlayersNeeded?: number;
  completionByUserId: Map<string, { answered: number; total: number }>;
  subscribeUrl: string;
  onConfirm: (date: string, startTime: string, endTime: string) => Promise<{ success: boolean; error?: string }>;
  onCancel: (date: string) => void | Promise<void>;
}

function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ScheduleTabContent(props: ScheduleTabContentProps) {
  const {
    suggestions, sessions, members, gmId, isGm, gameName, playDays,
    windowStart, windowEnd, specialPlayDates, playDateNotes,
    defaultStartTime, defaultEndTime, timezone, userTimezone,
    use24h = false, weekStartDay, minPlayersNeeded = 0,
    completionByUserId, subscribeUrl, onConfirm, onCancel,
  } = props;

  const toast = useToast();
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<GameSession | null>(null);
  const [autoExpandDate, setAutoExpandDate] = useState<string | null>(null);

  const coGmIds = useMemo(
    () => new Set(members.filter((m) => m.is_co_gm).map((m) => m.id)),
    [members]
  );

  const scheduledDates = useMemo(
    () => new Set(sessions.filter((s) => s.status === 'confirmed').map((s) => s.date)),
    [sessions]
  );

  const unscheduledSuggestions = useMemo(
    () => suggestions.filter((s) => !scheduledDates.has(s.date)),
    [suggestions, scheduledDates]
  );

  const playDayWeekdays = useMemo(() => new Set(playDays), [playDays]);

  const handleCellActivate = (date: string) => {
    const hasSession = sessions.some((s) => s.date === date && s.status === 'confirmed');
    if (hasSession) {
      return;
    }
    setAutoExpandDate(date);
    setTimeout(() => setAutoExpandDate(null), 50);
  };

  const monthRange = `${format(windowStart, 'MMM')} – ${format(windowEnd, 'MMM yyyy')}`;

  const handleConfirm = async (date: string, start: string, end: string) => {
    const res = await onConfirm(date, start, end);
    if (res.success) {
      toast.show(`Locked in ${format(parseISO(date), 'MMM d')}. Party notified.`);
    }
    return res;
  };

  const handleCancelConfirm = async (date: string) => {
    await onCancel(date);
    toast.show(`Cancelled session on ${format(parseISO(date), 'MMM d')}.`);
  };

  const handleDownloadIcs = (session: GameSession) => {
    const ics = generateICS([{
      date: session.date,
      startTime: session.start_time || undefined,
      endTime: session.end_time || undefined,
      title: gameName,
      timezone: timezone || undefined,
    }]);
    downloadICS(ics, `${gameName.toLowerCase().replace(/\s+/g, '-')}-${session.date}.ics`);
    toast.show(`Downloaded .ics for ${format(parseISO(session.date), 'MMM d')}.`);
  };

  const handleDownloadAllIcs = () => {
    const upcoming = sessions.filter((s) => s.status === 'confirmed');
    const events = upcoming.map((s) => ({
      date: s.date,
      startTime: s.start_time || undefined,
      endTime: s.end_time || undefined,
      title: gameName,
      timezone: timezone || undefined,
    }));
    const ics = generateICS(events);
    downloadICS(ics, `${gameName.toLowerCase().replace(/\s+/g, '-')}-sessions.ics`);
  };

  const handleCopySubscribe = async () => {
    try {
      await navigator.clipboard.writeText(subscribeUrl);
      toast.show('Subscribe URL copied to clipboard.');
    } catch {
      toast.show('Could not copy. Select the URL manually.', 'danger');
    }
  };

  const miniCalendarProps = {
    windowStart,
    windowEnd,
    suggestions,
    sessions,
    playDayWeekdays,
    specialPlayDates,
    weekStartDay,
    onCellActivate: handleCellActivate,
  };

  const subscribeLink = subscribeUrl ? (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleCopySubscribe}
      data-testid="calendar-subscribe-copy"
    >
      <Link2 className="size-3 mr-1" />
      Subscribe
    </Button>
  ) : null;

  return (
    <HoverSyncProvider>
      <div className="space-y-5" data-testid="schedule-tab-content">
        <ScheduleHeader
          gameName={gameName}
          playDays={playDays}
          monthRange={monthRange}
          candidateCount={unscheduledSuggestions.length}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5 min-w-0">
            <RankedList
              suggestions={unscheduledSuggestions}
              isGm={isGm}
              gmId={gmId}
              coGmIds={coGmIds}
              use24h={use24h}
              minPlayersNeeded={minPlayersNeeded}
              onLockIn={(d) => setScheduleFor(d)}
              autoExpandDate={autoExpandDate}
            />

            <ScheduledList
              sessions={sessions}
              suggestions={suggestions}
              timezone={timezone}
              userTimezone={userTimezone ?? null}
              use24h={use24h}
              isGm={isGm}
              playDateNotes={playDateNotes}
              onDownloadIcs={handleDownloadIcs}
              onDownloadAllIcs={handleDownloadAllIcs}
              onRequestCancel={(s) => setCancelFor(s)}
            />

            {/* Mobile: collapsible cards below the list */}
            <div className="space-y-3 lg:hidden">
              <details className="group rounded-xl border border-border bg-card p-4" data-testid="mobile-calendar-collapsible">
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <EyebrowLabel>Campaign window</EyebrowLabel>
                  <span className="font-mono text-[11px] text-muted-foreground group-open:hidden">tap to expand</span>
                  <span className="font-mono text-[11px] text-muted-foreground hidden group-open:inline">tap to collapse</span>
                </summary>
                <div className="mt-3">
                  <MiniCalendar {...miniCalendarProps} subscribeLink={subscribeLink} embedded />
                </div>
              </details>
              <details className="group rounded-xl border border-border bg-card p-4" data-testid="mobile-response-collapsible">
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <EyebrowLabel>Response status</EyebrowLabel>
                  <span className="font-mono text-[11px] text-muted-foreground group-open:hidden">tap to expand</span>
                  <span className="font-mono text-[11px] text-muted-foreground hidden group-open:inline">tap to collapse</span>
                </summary>
                <div className="mt-3">
                  <ResponseStatus members={members} completionByUserId={completionByUserId} embedded />
                </div>
              </details>
            </div>
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden lg:block space-y-5 lg:sticky lg:top-20 lg:self-start">
            <MiniCalendar {...miniCalendarProps} subscribeLink={subscribeLink} />
            <ResponseStatus members={members} completionByUserId={completionByUserId} />
          </aside>
        </div>

        <ScheduleSessionModal
          open={scheduleFor !== null}
          date={scheduleFor}
          suggestion={scheduleFor ? suggestions.find((s) => s.date === scheduleFor) : undefined}
          gameDefaultStart={defaultStartTime}
          gameDefaultEnd={defaultEndTime}
          onClose={() => setScheduleFor(null)}
          onConfirm={handleConfirm}
        />

        <CancelSessionModal
          open={cancelFor !== null}
          date={cancelFor?.date ?? null}
          onClose={() => setCancelFor(null)}
          onConfirm={handleCancelConfirm}
        />

        <CalendarHoverPopover suggestions={suggestions} scheduledDates={scheduledDates} />
      </div>
    </HoverSyncProvider>
  );
}
