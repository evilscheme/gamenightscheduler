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
import { splitUpcomingPast } from '@/lib/schedule';
import { useToast } from '@/components/ui/Toast';
import { CalendarSubscribeButton } from '@/components/games/CalendarSubscribeButton';

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
  // Date of a session just confirmed, so its row glows as it appears (cleared
  // by the row once the glow finishes). Null when nothing is celebrating.
  const [celebrateDate, setCelebrateDate] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<GameSession | null>(null);
  // editFor is set via onEditDetails in ScheduledList (added in a later task);
  // the edit-mode modal is rendered here so it's ready when that wiring lands.
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

  // ScheduledList renders null with no confirmed sessions, so its grid cell has
  // to disappear too — otherwise desktop column 1 opens with an empty gap row.
  const hasScheduled = scheduledDates.size > 0;

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
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!reduceMotion) setCelebrateDate(scheduleFor);
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

  const subscribeLink = <CalendarSubscribeButton webcalUrl={subscribeUrl} />;

  const calendarPanel = <MiniCalendar {...miniCalendarProps} subscribeLink={subscribeLink} />;
  const responsePanel = (
    <ResponseStatus members={members} completionByUserId={completionByUserId} />
  );

  return (
    <HoverSyncProvider>
      <div className="space-y-5" data-testid="schedule-tab-content">
        <ScheduleHeader
          monthRange={monthRange}
          candidateCount={unscheduledSuggestions.length}
        />

        {/*
          Flat grid so the sidebar renders ONCE and is repositioned per
          breakpoint, rather than being rendered twice behind lg:hidden.
          Mobile (1 column): scheduled -> calendar + response -> ranked list, so
          the calendar sits above the long ranked list.
          Desktop (2 columns): scheduled + ranked stack in column 1; the sidebar
          is sticky in column 2 and scrolls independently. Duplicating it would
          put two month-pagers in the DOM with cursors that desync on resize,
          and duplicate DOM text breaks unscoped getByText() assertions.
        */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          {hasScheduled && (
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
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
                celebrateDate={celebrateDate}
                onCelebrationDone={() => setCelebrateDate(null)}
                onDownloadIcs={handleDownloadIcs}
                onDownloadAllIcs={handleDownloadAllIcs}
                onRequestCancel={(s) => setCancelFor(s)}
                onEditDetails={(s) => setEditFor(s)}
              />
            </div>
          )}

          {/*
            top-20 is 5rem, so capping at 100vh-6rem leaves a 1rem gap below the
            panel. The cap is what makes trapped content structurally impossible:
            three months usually fits, but ResponseStatus renders a row per
            player and games allow 50.
          */}
          <aside
            data-testid="sidebar-panels"
            className={`space-y-5 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto ${
              hasScheduled ? 'lg:row-span-2' : ''
            }`}
          >
            {calendarPanel}
            {responsePanel}
          </aside>

          <div
            className={`min-w-0 lg:col-start-1 ${
              hasScheduled ? 'lg:row-start-2' : 'lg:row-start-1'
            }`}
          >
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
          </div>
        </div>

        {scheduleFor !== null && (
          <SessionDetailsModal
            key={`schedule-${scheduleFor}`}
            open
            date={scheduleFor}
            mode="schedule"
            suggestion={suggestions.find((s) => s.date === scheduleFor)}
            gameDefaultStart={defaultStartTime}
            gameDefaultEnd={defaultEndTime}
            onClose={() => setScheduleFor(null)}
            onSubmit={handleConfirm}
          />
        )}

        {editFor !== null && (
          <SessionDetailsModal
            key={`edit-${editFor.id}`}
            open
            date={editFor.date}
            mode="edit"
            session={editFor}
            onClose={() => setEditFor(null)}
            onSubmit={handleEdit}
          />
        )}

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
