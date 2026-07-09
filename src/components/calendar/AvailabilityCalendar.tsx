"use client";

import { useMemo, useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import {
  format,
  startOfMonth,
  eachDayOfInterval,
  addMonths,
  getDay,
  isBefore,
  isAfter,
  startOfDay,
} from "date-fns";
import type { GameSession, AvailabilityStatus } from "@/types";
import { DAY_LABELS } from "@/lib/constants";
import {
  getNextStatus,
  AvailabilityEntry,
} from "@/lib/availabilityStatus";
import { filterDatesForBulkSet } from "@/lib/bulkAvailability";
import type { OtherGameSessionInfo } from "@/lib/otherGameSessions";
import { useNoteEditorState } from "@/hooks/useNoteEditorState";
import { MonthCalendar } from "./MonthCalendar";
import { CalendarLegend } from "./CalendarLegend";
import { NoteEditorPopover } from "./NoteEditorPopover";
import { DateActionMenu } from "./DateActionMenu";
import { BulkActionsBar } from "./BulkActionsBar";

export type { AvailabilityEntry };

interface AvailabilityCalendarProps {
  playDays: number[];
  windowStart: Date;
  windowEnd: Date;
  availability: Record<string, AvailabilityEntry>;
  onToggle: (
    date: string,
    status: AvailabilityStatus,
    comment: string | null,
    availableAfter: string | null,
    availableUntil: string | null
  ) => void;
  confirmedSessions: GameSession[];
  extraPlayDates?: string[];
  isGmOrCoGm?: boolean;
  onToggleExtraDate?: (date: string) => void;
  weekStartDay?: 0 | 1;
  use24h?: boolean;
  otherGames?: { id: string; name: string }[];
  onCopyFromGame?: (
    sourceGameId: string,
    conflict: import('@/lib/copyAvailability').CopyConflict | null,
  ) => Promise<{ copied: number; overridden: number }>;
  playDateNotes?: Map<string, string>;
  onUpdatePlayDateNote?: (date: string, note: string | null) => void;
  otherGameSessionsByDate?: Map<string, OtherGameSessionInfo[]>;
  hasCampaignDates?: boolean;
  /** Optional content rendered as the first section of the bulk-actions bar
   *  (e.g. "Apply my default availability"), so related fill shortcuts share one element. */
  bulkActionsLead?: ReactNode;
  /** Disables all interaction (day clicks, long-press editing, bulk actions). Used by the admin peek view. */
  readOnly?: boolean;
  /**
   * Applies a bulk status change in one batched call. Required so a caller
   * can't silently regress to one write per date; read-only callers pass a
   * no-op (their bulk-actions bar never renders).
   */
  onBulkSet: (dates: string[], status: AvailabilityStatus) => void;
}

export function AvailabilityCalendar({
  playDays,
  windowStart,
  windowEnd,
  availability,
  onToggle,
  confirmedSessions,
  extraPlayDates = [],
  isGmOrCoGm = false,
  onToggleExtraDate,
  weekStartDay = 0,
  use24h = false,
  otherGames,
  onCopyFromGame,
  otherGameSessionsByDate = new Map(),
  playDateNotes = new Map(),
  onUpdatePlayDateNote,
  hasCampaignDates = false,
  bulkActionsLead,
  readOnly = false,
  onBulkSet,
}: AvailabilityCalendarProps) {
  const today = startOfDay(new Date());
  const maxDate = windowEnd;
  const {
    commentingDate,
    commentText,
    availableAfterText,
    availableUntilText,
    gmNoteText,
    setCommentText,
    setAvailableAfterText,
    setAvailableUntilText,
    setGmNoteText,
    handleEditComment,
    handleSaveComment,
    handleCancelComment,
  } = useNoteEditorState({ readOnly, availability, playDateNotes, onToggle, onUpdatePlayDateNote });
  // Action menu for GM long-press on extra play dates
  const [actionMenuDate, setActionMenuDate] = useState<string | null>(null);
  // Out-of-range toast state (mobile feedback)
  const [outOfRangeToast, setOutOfRangeToast] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showOutOfRangeToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setOutOfRangeToast(message);
    toastTimerRef.current = setTimeout(() => setOutOfRangeToast(null), 2000);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Generate array of months to display
  const months = useMemo(() => {
    const result = [];
    let current = startOfMonth(windowStart);
    while (
      isBefore(current, maxDate) ||
      current.getTime() === startOfMonth(maxDate).getTime()
    ) {
      result.push(current);
      current = addMonths(current, 1);
    }
    return result;
  }, [windowStart, maxDate]);

  // Reorder weekday headers based on week start preference
  const orderedWeekdays = useMemo(() => {
    const days = [...DAY_LABELS.abbrev];
    return [...days.slice(weekStartDay), ...days.slice(0, weekStartDay)];
  }, [weekStartDay]);

  const confirmedDates = new Set(confirmedSessions.map((s) => s.date));
  const confirmedSessionsByDate = useMemo(
    () => new Map(confirmedSessions.map((s) => [s.date, s])),
    [confirmedSessions]
  );

  const handleDayClick = (date: Date) => {
    if (readOnly) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date);
    const isExtraPlayDate = extraPlayDates.includes(dateStr);

    // Can't toggle non-play days (unless it's a extra play date)
    if (!playDays.includes(dayOfWeek) && !isExtraPlayDate) return;

    // Can't toggle past dates or dates outside campaign range
    if (isBefore(date, today)) return;
    if (isBefore(date, windowStart) || isAfter(date, windowEnd)) return;

    const currentAvail = availability[dateStr];
    const nextStatus = getNextStatus(currentAvail);

    // Cycle through states - preserve existing comment and time constraints
    const comment = currentAvail?.comment || null;
    const after = currentAvail?.available_after || null;
    const until = currentAvail?.available_until || null;
    onToggle(dateStr, nextStatus, comment, after, until);
  };

  // Action menu handlers for GM on extra play dates
  const handleOpenActionMenu = (dateStr: string) => {
    setActionMenuDate(dateStr);
  };

  const handleCloseActionMenu = () => {
    setActionMenuDate(null);
  };

  const handleActionMenuEditNote = () => {
    if (actionMenuDate) {
      handleEditComment(actionMenuDate);
      setActionMenuDate(null);
    }
  };

  const handleActionMenuRemoveExtra = () => {
    if (actionMenuDate && onToggleExtraDate) {
      onToggleExtraDate(actionMenuDate);
      setActionMenuDate(null);
    }
  };

  const bulkSetDays = (filter: string, status: AvailabilityStatus) => {
    const dates = filterDatesForBulkSet({
      filter,
      dates: eachDayOfInterval({ start: windowStart, end: maxDate }),
      playDays,
      extraPlayDates,
      existingAvailability: availability,
      today,
      formatDate: (d) => format(d, "yyyy-MM-dd"),
      getDayOfWeek: getDay,
      isBefore,
    });

    if (dates.length === 0) return;

    onBulkSet(dates, status);
  };

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {!readOnly && (
        <BulkActionsBar
          playDays={playDays}
          onApply={bulkSetDays}
          bulkActionsLead={bulkActionsLead}
          otherGames={otherGames}
          otherGameSessionsByDate={otherGameSessionsByDate}
          availability={availability}
          extraPlayDates={extraPlayDates}
          windowEnd={windowEnd}
          onCopyFromGame={onCopyFromGame}
        />
      )}

      {/* Multi-month calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {months.map((month) => (
          <MonthCalendar
            key={format(month, "yyyy-MM")}
            month={month}
            playDays={playDays}
            availability={availability}
            confirmedDates={confirmedDates}
            confirmedSessionsByDate={confirmedSessionsByDate}
            today={today}
            onDayClick={handleDayClick}
            onEditComment={handleEditComment}
            weekdays={orderedWeekdays}
            extraPlayDates={extraPlayDates}
            isGmOrCoGm={isGmOrCoGm}
            onToggleExtraDate={onToggleExtraDate}
            onOpenActionMenu={handleOpenActionMenu}
            weekStartDay={weekStartDay}
            use24h={use24h}
            playDateNotes={playDateNotes}
            windowStart={windowStart}
            windowEnd={windowEnd}
            onOutOfRangeTap={showOutOfRangeToast}
            otherGameSessionsByDate={otherGameSessionsByDate}
            readOnly={readOnly}
          />
        ))}
      </div>

      <CalendarLegend hasPlayDays={playDays.length > 0} hasCampaignDates={hasCampaignDates} />

      {/* Out-of-range toast (mobile feedback) */}
      {outOfRangeToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-card border border-border shadow-lg text-sm text-foreground animate-in fade-in slide-in-from-bottom-2 duration-200"
          role="status"
          aria-live="polite"
        >
          {outOfRangeToast}
        </div>
      )}

      {/* Note & time editor popover */}
      {commentingDate && (
        <NoteEditorPopover
          commentingDate={commentingDate}
          hasAvailability={!!availability[commentingDate]}
          showTimeFields={
            availability[commentingDate]?.status === "available" ||
            availability[commentingDate]?.status === "maybe"
          }
          commentText={commentText}
          availableAfterText={availableAfterText}
          availableUntilText={availableUntilText}
          onCommentChange={setCommentText}
          onAvailableAfterChange={setAvailableAfterText}
          onAvailableUntilChange={setAvailableUntilText}
          onSave={handleSaveComment}
          onCancel={handleCancelComment}
          use24h={use24h}
          otherGameSessions={otherGameSessionsByDate.get(commentingDate) ?? []}
          gmNote={playDateNotes.get(commentingDate!) ?? null}
          showGmNote={isGmOrCoGm || !!playDateNotes.get(commentingDate!)}
          isGmOrCoGm={isGmOrCoGm}
          gmNoteText={gmNoteText}
          onGmNoteChange={setGmNoteText}
        />
      )}

      {/* Action menu for GM long-press on extra play dates */}
      {actionMenuDate && (
        <DateActionMenu
          date={actionMenuDate}
          hasPlayDays={playDays.length > 0}
          onClose={handleCloseActionMenu}
          onEditNote={handleActionMenuEditNote}
          onRemoveExtra={handleActionMenuRemoveExtra}
        />
      )}
    </div>
  );
}
