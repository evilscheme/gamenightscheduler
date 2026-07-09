"use client";

import { useMemo, useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  getDay,
  isToday,
  isBefore,
  isAfter,
  startOfDay,
  parseISO,
} from "date-fns";
import { CalendarDays, Clock, FileText, MessageSquare, Pencil, Plus, X } from "lucide-react";
import { Button, EyebrowLabel } from "@/components/ui";
import type { GameSession, AvailabilityStatus } from "@/types";
import { DAY_LABELS, TEXT_LIMITS } from "@/lib/constants";
import {
  getNextStatus,
  AvailabilityEntry,
} from "@/lib/availabilityStatus";
import { filterDatesForBulkSet } from "@/lib/bulkAvailability";
import { formatTimeShort } from "@/lib/formatting";
import { calendarCellState } from "@/lib/calendarCellState";
import { getTimeOptions } from "@/lib/timeOptions";
import {
  formatSessionTimeWindow,
  type OtherGameSessionInfo,
} from "@/lib/otherGameSessions";
import { CopyFromGamePanel } from "@/components/games/availability/CopyFromGamePanel";

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
  const [commentingDate, setCommentingDate] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [availableAfterText, setAvailableAfterText] = useState("");
  const [availableUntilText, setAvailableUntilText] = useState("");
  const [gmNoteText, setGmNoteText] = useState("");
  const [bulkDayFilter, setBulkDayFilter] = useState<string>("remaining");
  const [bulkStatus, setBulkStatus] = useState<AvailabilityStatus>("available");
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

  const handleEditComment = (dateStr: string) => {
    if (readOnly) return;
    setCommentingDate(dateStr);
    setCommentText(availability[dateStr]?.comment || "");
    // Load time fields, converting HH:MM:SS to HH:MM for input
    const after = availability[dateStr]?.available_after;
    const until = availability[dateStr]?.available_until;
    setAvailableAfterText(after ? after.slice(0, 5) : "");
    setAvailableUntilText(until ? until.slice(0, 5) : "");
    setGmNoteText(playDateNotes.get(dateStr) || "");
  };

  const handleSaveComment = () => {
    if (commentingDate) {
      // Only update availability if the user has set a status (don't auto-create one)
      const currentAvail = availability[commentingDate];
      if (currentAvail) {
        onToggle(
          commentingDate,
          currentAvail.status,
          commentText.trim() || null,
          availableAfterText || null,
          availableUntilText || null
        );
      }
      // Save GM note if changed and user is GM
      const existingNote = playDateNotes.get(commentingDate) || "";
      const newNote = gmNoteText.trim();
      if (onUpdatePlayDateNote && newNote !== existingNote) {
        onUpdatePlayDateNote(commentingDate, newNote || null);
      }
      setCommentingDate(null);
      setCommentText("");
      setAvailableAfterText("");
      setAvailableUntilText("");
      setGmNoteText("");
    }
  };

  const handleCancelComment = () => {
    setCommentingDate(null);
    setCommentText("");
    setAvailableAfterText("");
    setAvailableUntilText("");
    setGmNoteText("");
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

  const handleBulkSubmit = () => {
    bulkSetDays(bulkDayFilter, bulkStatus);
  };

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {!readOnly && (
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start text-sm">
        {/* Apply my default availability — its own panel */}
        {bulkActionsLead && (
          <div className="bg-secondary rounded-lg p-3">{bulkActionsLead}</div>
        )}

        {/* Mark all — its own panel */}
        <div className="bg-secondary rounded-lg p-3 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Mark all</span>
          <select
            value={bulkDayFilter}
            onChange={(e) => setBulkDayFilter(e.target.value)}
            className="h-8 px-2 rounded-md border border-border bg-card text-card-foreground text-sm"
            aria-label="Day of week"
          >
            <option value="remaining">remaining days</option>
            {playDays.map((day) => (
              <option key={day} value={day}>
                {DAY_LABELS.full[day]}s
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">as</span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as AvailabilityStatus)}
            className="h-8 px-2 rounded-md border border-border bg-card text-card-foreground text-sm"
            aria-label="Availability status"
          >
            <option value="available">available</option>
            <option value="unavailable">unavailable</option>
            <option value="maybe">maybe</option>
          </select>
          <Button size="sm" onClick={handleBulkSubmit} className="h-8">
            Apply
          </Button>
        </div>

        {/* Copy from — its own panel */}
        {otherGames && otherGames.length > 0 && onCopyFromGame && (
          <CopyFromGamePanel
            otherGames={otherGames}
            otherGameSessionsByDate={otherGameSessionsByDate}
            availability={availability}
            playDays={playDays}
            extraPlayDates={extraPlayDates}
            windowEnd={windowEnd}
            onCopyFromGame={onCopyFromGame}
          />
        )}
      </div>
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

      {/* Compact Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-3.5 rounded-sm bg-cal-available-bg" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3.5 rounded-sm bg-cal-maybe-bg" />
          <span>Maybe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3.5 rounded-sm bg-cal-unavailable-bg/60" />
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3.5 rounded-sm bg-cal-unset-bg border-2 border-dashed border-cal-unset-border" />
          <span>Not set</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3.5 rounded-sm bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--muted)_3px,var(--muted)_5px)]" />
          <span>Non-play day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3.5 rounded-sm bg-cal-unset-bg shadow-[0_0_0_2px_var(--primary)]" />
          <span>Today</span>
        </div>
        {playDays.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="relative size-3.5 rounded-sm bg-cal-unset-bg border border-cal-unset-border">
              <span className="absolute top-0 right-0 size-0 border-t-[6px] border-t-primary border-l-[6px] border-l-transparent" />
            </div>
            <span>Extra date</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="relative size-3.5 rounded-sm bg-cal-available-bg flex items-center justify-center">
            <svg
              className="size-2.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1"
              opacity="0.75"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </div>
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex size-3.5 items-center justify-center rounded-sm bg-accent text-accent-foreground">
            <CalendarDays className="size-2.5" />
          </div>
          <span>Scheduled in another game</span>
        </div>
        {hasCampaignDates && (
          <div className="flex items-center gap-1.5">
            <div className="size-3.5 rounded-sm cal-out-of-range" />
            <span>Outside campaign</span>
          </div>
        )}
      </div>

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
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={handleCloseActionMenu}
        >
          <div
            className="bg-card rounded-lg shadow-lg border border-border p-4 w-full max-w-xs mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-card-foreground">
                {format(parseISO(actionMenuDate), "MMM d")}
              </span>
              <button
                onClick={handleCloseActionMenu}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start"
                onClick={handleActionMenuEditNote}
              >
                Add/Edit note
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="w-full justify-start"
                onClick={handleActionMenuRemoveExtra}
              >
                {playDays.length > 0 ? "Remove extra date" : "Remove play date"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Separate component for individual month to keep things clean
interface MonthCalendarProps {
  month: Date;
  playDays: number[];
  availability: Record<string, AvailabilityEntry>;
  confirmedDates: Set<string>;
  confirmedSessionsByDate: Map<string, GameSession>;
  today: Date;
  onDayClick: (date: Date) => void;
  onEditComment: (dateStr: string) => void;
  weekdays: readonly string[] | string[];
  extraPlayDates: string[];
  isGmOrCoGm: boolean;
  onToggleExtraDate?: (date: string) => void;
  onOpenActionMenu?: (dateStr: string) => void;
  weekStartDay: 0 | 1;
  use24h: boolean;
  playDateNotes?: Map<string, string>;
  windowStart: Date;
  windowEnd: Date;
  onOutOfRangeTap?: (message: string) => void;
  otherGameSessionsByDate?: Map<string, OtherGameSessionInfo[]>;
  readOnly?: boolean;
}

function MonthCalendar({
  month,
  playDays,
  availability,
  confirmedDates,
  confirmedSessionsByDate,
  today,
  onDayClick,
  onEditComment,
  weekdays,
  extraPlayDates,
  isGmOrCoGm,
  onToggleExtraDate,
  onOpenActionMenu,
  weekStartDay,
  use24h,
  playDateNotes,
  windowStart,
  windowEnd,
  onOutOfRangeTap,
  otherGameSessionsByDate = new Map(),
  readOnly = false,
}: MonthCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const startDayOfWeek = (getDay(startOfMonth(month)) - weekStartDay + 7) % 7;

  // Long-press handling for mobile
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = (
    dateStr: string,
    isRegularPlayDay: boolean,
    isExtraPlayDate: boolean
  ) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (isExtraPlayDate && isGmOrCoGm && onOpenActionMenu) {
        // For extra play dates, GM gets action menu (edit note or remove)
        onOpenActionMenu(dateStr);
      } else if (isRegularPlayDay || isExtraPlayDate) {
        // For regular play days (or extra dates for non-GM), long-press opens comment editor
        onEditComment(dateStr);
      } else if (isGmOrCoGm && onToggleExtraDate) {
        // For non-play days, GM can add as extra date
        onToggleExtraDate(dateStr);
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDayClickWithLongPressCheck = (date: Date) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onDayClick(date);
  };

  return (
    <div className="rounded-md bg-background/40 p-2">
      {/* Month header */}
      <h4 className="mb-1 text-xs font-semibold text-card-foreground">
        {format(month, "MMMM yyyy")}
      </h4>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {weekdays.map((day, i) => (
          <div
            key={`${day}-${i}`}
            className={`text-center font-mono text-[10px] ${
              playDays.includes((i + weekStartDay) % 7)
                ? "text-card-foreground"
                : "text-muted-foreground"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Empty cells for start of month offset */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-full aspect-square min-h-9"
          />
        ))}

        {/* Day cells */}
        {days.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const dayOfWeek = getDay(date);
          const isRegularPlayDay = playDays.includes(dayOfWeek);
          const isExtraPlayDate = extraPlayDates.includes(dateStr);
          const isOutOfRange = isBefore(date, windowStart) || isAfter(date, windowEnd);
          const isPlayDay = (isRegularPlayDay || isExtraPlayDate) && !isOutOfRange;
          const isPast = isBefore(date, today);
          const isConfirmed = confirmedDates.has(dateStr);
          const avail = availability[dateStr];
          const otherSessions = otherGameSessionsByDate.get(dateStr);
          const showOtherGameBadge = isPlayDay && !isPast && !!otherSessions?.length;

          // Can GM add this as a extra play date? Only non-play days that aren't past
          const canAddAsExtra =
            isGmOrCoGm && !isRegularPlayDay && !isExtraPlayDate && !isPast && !isOutOfRange;
          // Can GM remove this extra play date?
          const canRemoveExtra = isGmOrCoGm && isExtraPlayDate && !isPast;

          const isTodayDate = isToday(date);
          const { bgColor, textColor, cursor, todayStyles, dataStatus } =
            calendarCellState({
              isOutOfRange,
              isConfirmed,
              isPast,
              isPlayDay,
              isToday: isTodayDate,
              status: avail?.status,
            });

          const hasComment = !!avail?.comment;
          const hasTimeConstraint = !!(avail?.available_after || avail?.available_until);
          // Time windows only apply to available/maybe. The data is preserved
          // through an "unavailable" toggle so it round-trips, but don't surface
          // the clock — its editor hides the time fields when unavailable, so the
          // icon would be a dead affordance the user can't edit or clear.
          const showTimeConstraint =
            hasTimeConstraint &&
            (avail?.status === "available" || avail?.status === "maybe");
          const hasAvailability = !!avail;

          // Build tooltip
          const tooltipParts = [format(date, "EEEE, MMM d")];
          if (isConfirmed) {
            const session = confirmedSessionsByDate.get(dateStr);
            const startStr = formatTimeShort(session?.start_time ?? null, use24h);
            const endStr = formatTimeShort(session?.end_time ?? null, use24h);
            if (startStr && endStr) {
              tooltipParts.push(`Scheduled: ${startStr}–${endStr}`);
            } else if (startStr) {
              tooltipParts.push(`Scheduled: starts ${startStr}`);
            } else if (endStr) {
              tooltipParts.push(`Scheduled: ends ${endStr}`);
            } else {
              tooltipParts.push("Scheduled");
            }
            if (!isPast) {
              const statusLabel = avail?.status === "available" ? "Available" : avail?.status === "maybe" ? "Maybe" : avail?.status === "unavailable" ? "Unavailable" : "Not set";
              tooltipParts.push(`Your status: ${statusLabel}`);
            }
          }
          if (showTimeConstraint) {
            const after = formatTimeShort(avail?.available_after ?? null, use24h);
            const until = formatTimeShort(avail?.available_until ?? null, use24h);
            if (after && until) {
              tooltipParts.push(`Available ${after}–${until}`);
            } else if (after) {
              tooltipParts.push(`Available after ${after}`);
            } else if (until) {
              tooltipParts.push(`Available until ${until}`);
            }
          }
          if (hasComment) {
            tooltipParts.push(`Note: ${avail!.comment}`);
          }
          if (otherSessions?.length) {
            for (const os of otherSessions) {
              const when = formatSessionTimeWindow(os.startTime, os.endTime, use24h);
              tooltipParts.push(`Scheduled: ${os.gameName}${when ? ` ${when}` : ""}`);
            }
          }
          const gmNote = playDateNotes?.get(dateStr);
          if (gmNote) {
            tooltipParts.push(`GM note: ${gmNote}`);
          }
          const cellTooltip = tooltipParts.join("\n");


          return (
            <button
              key={dateStr}
              onClick={() => handleDayClickWithLongPressCheck(date)}
              onTouchStart={() => {
                if (isOutOfRange && !isPast && onOutOfRangeTap) {
                  onOutOfRangeTap(
                    isBefore(date, windowStart) ? "Before campaign start" : "After campaign end"
                  );
                  return;
                }
                if (!isPast && !isOutOfRange) {
                  handleTouchStart(dateStr, isRegularPlayDay, isExtraPlayDate);
                }
              }}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
              disabled={(!isPlayDay && !canAddAsExtra) || isPast || isOutOfRange}
              className={`group relative w-full aspect-square min-h-9 rounded-sm flex items-center justify-center font-mono text-xl transition-all select-none ${bgColor} ${textColor} ${cursor} ${todayStyles}`}
              style={{ WebkitTouchCallout: "none" }}
              data-date={dateStr}
              data-status={dataStatus}
              data-availability={isConfirmed && !isPast ? (avail?.status ?? "unset") : undefined}
              data-extra={isExtraPlayDate ? "true" : undefined}
              data-other-game={showOtherGameBadge ? "true" : undefined}
              title={cellTooltip}
            >
              {/* Scheduled game star decoration */}
              {isConfirmed && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <svg
                    className="size-[85%]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    opacity="0.4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                  </svg>
                </span>
              )}
              {/* Another game is scheduled this night (informational).
                  Always top-right; the GM add/remove icons own the top-left, and
                  the extra-date triangle (also top-right) is suppressed below when
                  this badge shows, so nothing overlaps. */}
              {showOtherGameBadge && (
                <span
                  className="absolute top-0.5 right-0.5 z-10 flex items-center rounded-sm bg-accent text-accent-foreground p-px leading-none"
                  data-testid="other-game-indicator"
                  title={otherSessions!
                    .map((os) => `Scheduled: ${os.gameName}`)
                    .join("\n")}
                >
                  <CalendarDays className="size-2.5" />
                </span>
              )}
              {format(date, "d")}
              {/* Extra date indicator - corner triangle (hidden for ad-hoc games,
                  and yielded to the other-game badge when both want the top-right) */}
              {isExtraPlayDate && !isPast && playDays.length > 0 && !showOtherGameBadge && (
                <span className="absolute top-0 right-0 size-0 border-t-10 border-t-primary border-l-10 border-l-transparent" />
              )}
              {/* GM: Add extra play date icon on non-play days */}
              {canAddAsExtra && onToggleExtraDate && (
                <span
                  className="absolute top-0.5 left-0.5 leading-none cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-125 transition-all text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Prevent click after long-press (mobile)
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    onToggleExtraDate(dateStr);
                  }}
                  title={playDays.length > 0 ? "Add extra date" : "Add play date"}
                >
                  <Plus className="size-2.5" />
                </span>
              )}
              {/* GM: Remove extra play date icon */}
              {canRemoveExtra && onToggleExtraDate && (
                <span
                  className="absolute top-0.5 left-0.5 leading-none cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-125 transition-all text-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Prevent click after long-press (mobile)
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    onToggleExtraDate(dateStr);
                  }}
                  title={playDays.length > 0 ? "Remove extra date" : "Remove play date"}
                >
                  <X className="size-2.5" />
                </span>
              )}
              {/* Bottom-left status icons (clickable — open editor popover) */}
              {isPlayDay && !isPast && (showTimeConstraint || playDateNotes?.has(dateStr)) && (
                <span
                  className="absolute bottom-0 left-0.5 leading-none cursor-pointer flex items-center gap-px hover:scale-125 transition-all"
                  data-testid="note-icons"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    onEditComment(dateStr);
                  }}
                >
                  {showTimeConstraint && (
                    <span
                      data-testid="time-indicator"
                      title={(() => {
                        const after = formatTimeShort(avail?.available_after ?? null, use24h);
                        const until = formatTimeShort(avail?.available_until ?? null, use24h);
                        if (after && until) return `${after}–${until}`;
                        if (after) return `After ${after}`;
                        return `Until ${until}`;
                      })()}
                    >
                      <Clock className="size-2.5" />
                    </span>
                  )}
                  {playDateNotes?.has(dateStr) && (
                    <span data-testid="note-indicator" title={`GM note: ${playDateNotes.get(dateStr)}`}>
                      <FileText className="size-2.5" />
                    </span>
                  )}
                </span>
              )}
              {/* Bottom-right edit icon — opens editor popover (read-only: only show existing notes) */}
              {isPlayDay && !isPast && (hasComment || (!readOnly && (hasAvailability || isGmOrCoGm))) && (
                <span
                  className={`absolute bottom-0.5 right-1 leading-none cursor-pointer hover:scale-125 transition-all ${
                    hasComment
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  data-testid="edit-note-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    onEditComment(dateStr);
                  }}
                  title={
                    hasComment
                      ? readOnly
                        ? `Note: ${avail!.comment}`
                        : `Edit note: ${avail!.comment}`
                      : "Add note"
                  }
                >
                  {hasComment ? <MessageSquare className="size-2.5" /> : <Pencil className="size-2.5" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Extracted component to avoid IIFE in JSX (Turbopack compatibility)
interface NoteEditorPopoverProps {
  commentingDate: string;
  hasAvailability: boolean;
  showTimeFields: boolean;
  commentText: string;
  availableAfterText: string;
  availableUntilText: string;
  onCommentChange: (value: string) => void;
  onAvailableAfterChange: (value: string) => void;
  onAvailableUntilChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  use24h: boolean;
  gmNote?: string | null;
  showGmNote?: boolean;
  isGmOrCoGm?: boolean;
  gmNoteText?: string;
  onGmNoteChange?: (value: string) => void;
  otherGameSessions?: OtherGameSessionInfo[];
}

function NoteEditorPopover({
  commentingDate,
  hasAvailability,
  showTimeFields,
  commentText,
  availableAfterText,
  availableUntilText,
  onCommentChange,
  onAvailableAfterChange,
  onAvailableUntilChange,
  onSave,
  onCancel,
  use24h,
  gmNote,
  showGmNote,
  isGmOrCoGm,
  gmNoteText,
  onGmNoteChange,
  otherGameSessions,
}: NoteEditorPopoverProps) {
  const timeOptions = getTimeOptions(use24h);
  return (
    <div
      className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-lg shadow-lg border border-border p-4 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-card-foreground">
            {format(parseISO(commentingDate), "MMM d")}
          </span>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Scheduled elsewhere — confirmed sessions you have in other games that
            night. Matches the calendar's accent badge so the two read as one idea. */}
        {otherGameSessions && otherGameSessions.length > 0 && (
          <div className="mb-3">
            <EyebrowLabel variant="muted" className="block mb-2">Scheduled elsewhere</EyebrowLabel>
            <div className="rounded-md border border-accent/30 bg-accent/10 p-3 space-y-1.5">
              {otherGameSessions.map((os) => {
                const when = formatSessionTimeWindow(os.startTime, os.endTime, use24h);
                return (
                  <div key={os.gameId} className="flex items-start gap-2 text-sm" data-testid="popover-other-game">
                    <CalendarDays className="size-3.5 mt-0.5 shrink-0 text-accent-foreground" />
                    <span className="text-foreground">
                      <span className="font-medium">{os.gameName}</span>
                      {when && <span className="text-muted-foreground"> · {when}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GM Note section */}
        {showGmNote && (
          <div className="mb-3">
            <EyebrowLabel variant="muted" className="block mb-2">GM Note</EyebrowLabel>
            <div className="bg-secondary/50 rounded-md p-3">
              {isGmOrCoGm ? (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Visible to all players
                  </label>
                  <input
                    type="text"
                    value={gmNoteText || ""}
                    onChange={(e) => onGmNoteChange?.(e.target.value)}
                    placeholder="e.g., Only after 2pm, different location"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    maxLength={TEXT_LIMITS.PLAY_DATE_NOTE}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSave();
                      if (e.key === "Escape") onCancel();
                    }}
                  />
                </div>
              ) : gmNote ? (
                <p className="text-sm text-foreground">
                  {gmNote}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {/* Your Availability section — only when user has set availability */}
        {hasAvailability && (
          <div className="mb-3">
            <EyebrowLabel variant="muted" className="block mb-2">Your Availability</EyebrowLabel>
            <div className="space-y-3">
              {showTimeFields && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="available-after" className="block text-xs text-muted-foreground mb-1">
                      Available after
                    </label>
                    <select
                      id="available-after"
                      value={availableAfterText}
                      onChange={(e) => onAvailableAfterChange(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">—</option>
                      {timeOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="available-until" className="block text-xs text-muted-foreground mb-1">
                      Available until
                    </label>
                    <select
                      id="available-until"
                      value={availableUntilText}
                      onChange={(e) => onAvailableUntilChange(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">—</option>
                      {timeOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="availability-note" className="block text-xs text-muted-foreground mb-1">
                  Note
                </label>
                <input
                  id="availability-note"
                  type="text"
                  value={commentText}
                  onChange={(e) => onCommentChange(e.target.value)}
                  placeholder="e.g., Depends on work schedule"
                  maxLength={TEXT_LIMITS.AVAILABILITY_COMMENT}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSave();
                    if (e.key === "Escape") onCancel();
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {hasAvailability || isGmOrCoGm ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={onSave}>
              Save
            </Button>
          </div>
        ) : (
          <Button size="sm" className="w-full" onClick={onCancel}>
            OK
          </Button>
        )}
      </div>
    </div>
  );
}
