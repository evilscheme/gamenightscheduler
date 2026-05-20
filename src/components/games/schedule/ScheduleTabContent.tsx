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
import { SessionDetailsModal } from './SessionDetailsModal';
import { CancelSessionModal } from './CancelSessionModal';
import { CalendarHoverPopover } from './CalendarHoverPopover';
import { generateICS, slugifyGameName, triggerICSDownload, composeIcsDescription } from '@/lib/ics';
import { splitUpcomingPast } from '@/lib/scheduleView';
import { useToast } from '@/components/ui/Toast';
import { Button, EyebrowLabel, Panel } from '@/components/ui';
import { Link2 } from 'lucide-react';

export interface ScheduleTabContentProps {
  suggestions: DateSuggestion[];
  sessions: GameSession[];
  members: MemberWithRole[];
  gmId: string;
  isGm: boolean;
  gameName: string;
  gameDescription?: string | null;
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
  onConfirm: (
    date: string,
    startTime: string,
    endTime: string,
    location: string | null,
    notes: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  onUpdateSession: (
    sessionId: string,
    patch: { start_time?: string; end_time?: string; location?: string | null; notes?: string | null },
  ) => Promise<{ success: boolean; error?: string }>;
  onCancel: (date: string) => Promise<{ success: boolean; error?: string }>;
}

export function ScheduleTabContent(props: ScheduleTabContentProps) {
  const {
    suggestions, sessions, members, gmId, isGm, gameName, gameDescription,
    playDays, windowStart, windowEnd, specialPlayDates, playDateNotes,
    defaultStartTime, defaultEndTime, timezone, userTimezone,
    use24h = false, weekStartDay, minPlayersNeeded = 0,
    completionByUserId, subscribeUrl, onConfirm, onUpdateSession, onCancel,
  } = props;

  const toast = useToast();
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<GameSession | null>(null);
  const [editFor, setEditFor] = useState<GameSession | null>(null);
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

  const handleConfirm = async (values: {
    start: string; end: string; location: string | null; notes: string | null;
  }) => {
    if (!scheduleFor) return { success: false, error: 'No date selected' };
    const res = await onConfirm(scheduleFor, values.start, values.end, values.location, values.notes);
    if (res.success) {
      toast.show(`Scheduled ${format(parseISO(scheduleFor), 'MMM d')}.`);
    }
    return res;
  };

  const handleEdit = async (values: {
    start: string; end: string; location: string | null; notes: string | null;
  }) => {
    if (!editFor) return { success: false, error: 'No session selected' };
    const res = await onUpdateSession(editFor.id, {
      start_time: values.start,
      end_time: values.end,
      location: values.location,
      notes: values.notes,
    });
    if (res.success) {
      toast.show(`Updated ${format(parseISO(editFor.date), 'MMM d')}.`);
    }
    return res;
  };

  const handleCancelConfirm = async (date: string) => {
    const res = await onCancel(date);
    if (res.success) {
      toast.show(`Cancelled session on ${format(parseISO(date), 'MMM d')}.`);
    } else {
      toast.show(res.error ?? 'Could not cancel the session.', 'danger');
    }
    return res;
  };

  const handleDownloadIcs = (session: GameSession) => {
    const ics = generateICS([{
      date: session.date,
      startTime: session.start_time || undefined,
      endTime: session.end_time || undefined,
      title: gameName,
      location: session.location || undefined,
      description: composeIcsDescription(gameDescription, session.notes),
      timezone: timezone || undefined,
    }]);
    triggerICSDownload(ics, `${slugifyGameName(gameName)}-${session.date}.ics`);
    toast.show(`Downloaded calendar file for ${format(parseISO(session.date), 'MMM d')}.`);
  };

  const handleDownloadAllIcs = () => {
    const confirmed = sessions.filter((s) => s.status === 'confirmed');
    const { upcoming } = splitUpcomingPast(confirmed, new Date());
    const events = upcoming.map((s) => ({
      date: s.date,
      startTime: s.start_time || undefined,
      endTime: s.end_time || undefined,
      title: gameName,
      location: s.location || undefined,
      description: composeIcsDescription(gameDescription, s.notes),
      timezone: timezone || undefined,
    }));
    const ics = generateICS(events);
    triggerICSDownload(ics, `${slugifyGameName(gameName)}-sessions.ics`);
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
      title="Copy a webcal:// URL that auto-syncs scheduled sessions to Google Calendar, Apple Calendar, or Outlook"
    >
      <Link2 className="size-3 mr-1" />
      Subscribe
    </Button>
  ) : null;

  return (
    <HoverSyncProvider>
      <div className="space-y-5" data-testid="schedule-tab-content">
        <ScheduleHeader
          monthRange={monthRange}
          candidateCount={unscheduledSuggestions.length}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5 min-w-0">
            <ScheduledList
              sessions={sessions}
              suggestions={suggestions}
              timezone={timezone}
              userTimezone={userTimezone ?? null}
              use24h={use24h}
              isGm={isGm}
              gmId={gmId}
              coGmIds={coGmIds}
              playDateNotes={playDateNotes}
              onDownloadIcs={handleDownloadIcs}
              onDownloadAllIcs={handleDownloadAllIcs}
              onRequestCancel={(s) => setCancelFor(s)}
            />

            <RankedList
              suggestions={unscheduledSuggestions}
              isGm={isGm}
              gmId={gmId}
              coGmIds={coGmIds}
              use24h={use24h}
              minPlayersNeeded={minPlayersNeeded}
              playDateNotes={playDateNotes}
              onLockIn={(d) => setScheduleFor(d)}
              autoExpandDate={autoExpandDate}
            />

            {/* Mobile: collapsible cards below the list */}
            <div className="space-y-3 lg:hidden">
              <Panel as="details" className="group" data-testid="mobile-calendar-collapsible">
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <EyebrowLabel>Calendar</EyebrowLabel>
                  <span className="font-mono text-[11px] text-muted-foreground group-open:hidden">tap to expand</span>
                  <span className="font-mono text-[11px] text-muted-foreground hidden group-open:inline">tap to collapse</span>
                </summary>
                <div className="mt-3">
                  <MiniCalendar {...miniCalendarProps} subscribeLink={subscribeLink} embedded />
                </div>
              </Panel>
              <Panel as="details" className="group" data-testid="mobile-response-collapsible">
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <EyebrowLabel>Response status</EyebrowLabel>
                  <span className="font-mono text-[11px] text-muted-foreground group-open:hidden">tap to expand</span>
                  <span className="font-mono text-[11px] text-muted-foreground hidden group-open:inline">tap to collapse</span>
                </summary>
                <div className="mt-3">
                  <ResponseStatus members={members} completionByUserId={completionByUserId} embedded />
                </div>
              </Panel>
            </div>
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden lg:block space-y-5 lg:sticky lg:top-20 lg:self-start">
            <MiniCalendar {...miniCalendarProps} subscribeLink={subscribeLink} />
            <ResponseStatus members={members} completionByUserId={completionByUserId} />
          </aside>
        </div>

        <SessionDetailsModal
          open={scheduleFor !== null}
          date={scheduleFor}
          mode="schedule"
          suggestion={scheduleFor ? suggestions.find((s) => s.date === scheduleFor) : undefined}
          gameDefaultStart={defaultStartTime}
          gameDefaultEnd={defaultEndTime}
          onClose={() => setScheduleFor(null)}
          onSubmit={handleConfirm}
        />

        <SessionDetailsModal
          open={editFor !== null}
          date={editFor?.date ?? null}
          mode="edit"
          session={editFor ?? undefined}
          onClose={() => setEditFor(null)}
          onSubmit={handleEdit}
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
