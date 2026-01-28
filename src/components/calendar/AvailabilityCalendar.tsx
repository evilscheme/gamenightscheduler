"use client";

import { useMemo, useState, useRef } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  getDay,
  isToday,
  isBefore,
  startOfDay,
  parseISO,
} from "date-fns";
import { Button } from "@/components/ui";
import type { GameSession, AvailabilityStatus } from "@/types";
import { DAY_LABELS } from "@/lib/constants";
import {
  getNextStatus,
  AvailabilityEntry,
} from "@/lib/availabilityStatus";
import { formatTimeShort } from "@/lib/formatting";

export type { AvailabilityEntry };

interface AvailabilityCalendarProps {
  playDays: number[];
  windowMonths: number;
  availability: Record<string, AvailabilityEntry>;
  onToggle: (
    date: string,
    status: AvailabilityStatus,
    comment: string | null,
    availableAfter: string | null,
    availableUntil: string | null
  ) => void;
  confirmedSessions: GameSession[];
  specialPlayDates?: string[];
  isGmOrCoGm?: boolean;
  onToggleSpecialDate?: (date: string) => void;
}

export function AvailabilityCalendar({
  playDays,
  windowMonths,
  availability,
  onToggle,
  confirmedSessions,
  specialPlayDates = [],
  isGmOrCoGm = false,
  onToggleSpecialDate,
}: AvailabilityCalendarProps) {
  const today = startOfDay(new Date());
  const maxDate = endOfMonth(addMonths(today, windowMonths));
  const [commentingDate, setCommentingDate] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [availableAfterText, setAvailableAfterText] = useState("");
  const [availableUntilText, setAvailableUntilText] = useState("");
  const [bulkDayFilter, setBulkDayFilter] = useState<string>("remaining");
  const [bulkStatus, setBulkStatus] = useState<AvailabilityStatus>("available");
  // Action menu for GM long-press on special play dates
  const [actionMenuDate, setActionMenuDate] = useState<string | null>(null);

  // Generate array of months to display
  const months = useMemo(() => {
    const result = [];
    let current = startOfMonth(today);
    while (
      isBefore(current, maxDate) ||
      current.getTime() === startOfMonth(maxDate).getTime()
    ) {
      result.push(current);
      current = addMonths(current, 1);
    }
    return result;
  }, [today, maxDate]);

  const confirmedDates = new Set(confirmedSessions.map((s) => s.date));
  const confirmedSessionsByDate = useMemo(
    () => new Map(confirmedSessions.map((s) => [s.date, s])),
    [confirmedSessions]
  );

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date);
    const isSpecialPlayDate = specialPlayDates.includes(dateStr);

    // Can't toggle non-play days (unless it's a special play date)
    if (!playDays.includes(dayOfWeek) && !isSpecialPlayDate) return;

    // Can't toggle past dates
    if (isBefore(date, today)) return;

    const currentAvail = availability[dateStr];
    const nextStatus = getNextStatus(currentAvail);

    // Cycle through states - preserve existing comment and time constraints
    const comment = currentAvail?.comment || null;
    const after = currentAvail?.available_after || null;
    const until = currentAvail?.available_until || null;
    onToggle(dateStr, nextStatus, comment, after, until);
  };

  const handleEditComment = (dateStr: string) => {
    setCommentingDate(dateStr);
    setCommentText(availability[dateStr]?.comment || "");
    // Load time fields, converting HH:MM:SS to HH:MM for input
    const after = availability[dateStr]?.available_after;
    const until = availability[dateStr]?.available_until;
    setAvailableAfterText(after ? after.slice(0, 5) : "");
    setAvailableUntilText(until ? until.slice(0, 5) : "");
  };

  const handleSaveComment = () => {
    if (commentingDate) {
      const currentStatus = availability[commentingDate]?.status || "available";
      onToggle(
        commentingDate,
        currentStatus,
        commentText.trim() || null,
        availableAfterText || null,
        availableUntilText || null
      );
      setCommentingDate(null);
      setCommentText("");
      setAvailableAfterText("");
      setAvailableUntilText("");
    }
  };

  const handleCancelComment = () => {
    setCommentingDate(null);
    setCommentText("");
    setAvailableAfterText("");
    setAvailableUntilText("");
  };

  // Action menu handlers for GM on special play dates
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

  const handleActionMenuRemoveSpecial = () => {
    if (actionMenuDate && onToggleSpecialDate) {
      onToggleSpecialDate(actionMenuDate);
      setActionMenuDate(null);
    }
  };

  const bulkSetDays = (filter: string, status: AvailabilityStatus) => {
    const datesInWindow = eachDayOfInterval({
      start: today,
      end: maxDate,
    }).filter((date) => {
      const dayOfWeek = getDay(date);
      const dateStr = format(date, "yyyy-MM-dd");
      const isSpecialPlayDate = specialPlayDates.includes(dateStr);
      if (!playDays.includes(dayOfWeek) && !isSpecialPlayDate) return false;
      if (isBefore(date, today)) return false;

      if (filter === "remaining") {
        // Only dates without availability set
        return !availability[dateStr];
      } else {
        // Specific day of week
        return dayOfWeek === parseInt(filter, 10);
      }
    });

    datesInWindow.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      // Preserve existing comments and time constraints when bulk setting
      const existing = availability[dateStr];
      onToggle(
        dateStr,
        status,
        existing?.comment || null,
        existing?.available_after || null,
        existing?.available_until || null
      );
    });
  };

  const handleBulkSubmit = () => {
    bulkSetDays(bulkDayFilter, bulkStatus);
  };

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      <div className="bg-secondary rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Mark all</span>
          <select
            value={bulkDayFilter}
            onChange={(e) => setBulkDayFilter(e.target.value)}
            className="h-8 px-2 rounded-md border border-border bg-card text-card-foreground text-sm"
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
            onChange={(e) =>
              setBulkStatus(e.target.value as AvailabilityStatus)
            }
            className="h-8 px-2 rounded-md border border-border bg-card text-card-foreground text-sm"
          >
            <option value="available">available</option>
            <option value="unavailable">unavailable</option>
            <option value="maybe">maybe</option>
          </select>
          <Button size="sm" onClick={handleBulkSubmit} className="h-8">
            Apply
          </Button>
        </div>
      </div>

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
            weekdays={DAY_LABELS.abbrev}
            specialPlayDates={specialPlayDates}
            isGmOrCoGm={isGmOrCoGm}
            onToggleSpecialDate={onToggleSpecialDate}
            onOpenActionMenu={handleOpenActionMenu}
          />
        ))}
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-cal-available-bg" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-cal-maybe-bg" />
          <span>Maybe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-cal-unavailable-bg" />
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-cal-unset-bg border-2 border-dashed border-cal-unset-border" />
          <span>Not set</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-cal-disabled-bg" />
          <span>Non-play day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-cal-unset-bg shadow-[0_0_0_2px_var(--primary)]" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative w-3.5 h-3.5 rounded-sm bg-cal-unset-bg border border-cal-unset-border">
            <span className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-t-primary border-l-[6px] border-l-transparent" />
          </div>
          <span>Special play day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative w-3.5 h-3.5 rounded-sm bg-cal-scheduled-bg flex items-center justify-center">
            <svg
              className="w-2.5 h-2.5 text-cal-scheduled-text/40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </div>
          <span>Game scheduled</span>
        </div>
      </div>

      {/* Note & time editor popover */}
      {commentingDate && (
        <NoteEditorPopover
          commentingDate={commentingDate}
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
        />
      )}

      {/* Action menu for GM long-press on special play dates */}
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
                onClick={handleActionMenuRemoveSpecial}
              >
                Remove special play day
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
  weekdays: readonly string[];
  specialPlayDates: string[];
  isGmOrCoGm: boolean;
  onToggleSpecialDate?: (date: string) => void;
  onOpenActionMenu?: (dateStr: string) => void;
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
  specialPlayDates,
  isGmOrCoGm,
  onToggleSpecialDate,
  onOpenActionMenu,
}: MonthCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const startDayOfWeek = getDay(startOfMonth(month));

  // Long-press handling for mobile
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = (
    dateStr: string,
    isRegularPlayDay: boolean,
    isSpecialPlayDate: boolean
  ) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (isSpecialPlayDate && isGmOrCoGm && onOpenActionMenu) {
        // For special play dates, GM gets action menu (edit note or remove)
        onOpenActionMenu(dateStr);
      } else if (isRegularPlayDay || isSpecialPlayDate) {
        // For regular play days (or special dates for non-GM), long-press opens comment editor
        onEditComment(dateStr);
      } else if (isGmOrCoGm && onToggleSpecialDate) {
        // For non-play days, GM can add as special date
        onToggleSpecialDate(dateStr);
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
    <div className="bg-card rounded-lg border border-border p-2">
      {/* Month header */}
      <h4 className="text-xs font-semibold text-card-foreground text-center mb-1.5">
        {format(month, "MMM yyyy")}
      </h4>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {weekdays.map((day, i) => (
          <div
            key={`${day}-${i}`}
            className={`text-center text-[10px] font-medium ${
              playDays.includes(i)
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
            className="w-full aspect-square min-h-[36px]"
          />
        ))}

        {/* Day cells */}
        {days.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const dayOfWeek = getDay(date);
          const isRegularPlayDay = playDays.includes(dayOfWeek);
          const isSpecialPlayDate = specialPlayDates.includes(dateStr);
          const isPlayDay = isRegularPlayDay || isSpecialPlayDate;
          const isPast = isBefore(date, today);
          const isConfirmed = confirmedDates.has(dateStr);
          const avail = availability[dateStr];

          // Can GM add this as a special play date? Only non-play days that aren't past
          const canAddAsSpecial =
            isGmOrCoGm && !isRegularPlayDay && !isSpecialPlayDate && !isPast;
          // Can GM remove this special play date?
          const canRemoveSpecial = isGmOrCoGm && isSpecialPlayDate && !isPast;

          let bgColor = "bg-cal-disabled-bg"; // Non-play day
          let textColor = "text-cal-disabled-text";
          let cursor = "cursor-default";
          const extraStyles = "";
          const isTodayDate = isToday(date);

          // Scheduled sessions get priority styling (solid purple)
          if (isConfirmed) {
            bgColor = "bg-cal-scheduled-bg";
            textColor = "text-cal-scheduled-text font-semibold";
            if (!isPast) {
              cursor = "cursor-pointer hover:brightness-110 transition-all";
            }
          } else if (isPlayDay && !isPast) {
            cursor = "cursor-pointer hover:ring-2 hover:ring-primary/50 hover:scale-105 transition-transform";
            if (avail?.status === "available") {
              bgColor = "bg-cal-available-bg";
              textColor = "text-cal-available-text font-medium";
            } else if (avail?.status === "maybe") {
              bgColor = "bg-cal-maybe-bg";
              textColor = "text-cal-maybe-text font-medium";
            } else if (avail?.status === "unavailable") {
              bgColor = "bg-cal-unavailable-bg";
              textColor = "text-cal-unavailable-text font-medium";
            } else {
              // Unset play day - but not if it's today (today gets solid styling)
              if (isTodayDate) {
                bgColor = "bg-cal-unset-bg";
              } else {
                bgColor = "bg-cal-unset-bg border-2 border-dashed border-cal-unset-border";
              }
              textColor = "text-cal-unset-text";
            }
          } else if (isPast) {
            textColor = "text-cal-disabled-text/50";
          }

          // Today indicator - bold shadow ring effect (doesn't conflict with borders)
          const todayStyles = isTodayDate
            ? "shadow-[0_0_0_3px_var(--primary)] font-bold z-10"
            : "";

          const hasComment = !!avail?.comment;
          const hasTimeConstraint = !!(avail?.available_after || avail?.available_until);
          const hasAvailability = !!avail;

          // Build tooltip
          const tooltipParts = [format(date, "EEEE, MMM d")];
          if (isConfirmed) {
            const session = confirmedSessionsByDate.get(dateStr);
            const startStr = formatTimeShort(session?.start_time ?? null);
            const endStr = formatTimeShort(session?.end_time ?? null);
            if (startStr && endStr) {
              tooltipParts.push(`Scheduled: ${startStr}–${endStr}`);
            } else if (startStr) {
              tooltipParts.push(`Scheduled: starts ${startStr}`);
            } else if (endStr) {
              tooltipParts.push(`Scheduled: ends ${endStr}`);
            } else {
              tooltipParts.push("Scheduled");
            }
          }
          if (hasTimeConstraint) {
            const after = formatTimeShort(avail?.available_after ?? null);
            const until = formatTimeShort(avail?.available_until ?? null);
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
          const cellTooltip = tooltipParts.join("\n");

          // Data attribute for testing - represents the cell state
          const dataStatus = isConfirmed
            ? "scheduled"
            : isPast
              ? "past"
              : !isPlayDay
                ? "disabled"
                : avail?.status === "available"
                  ? "available"
                  : avail?.status === "unavailable"
                    ? "unavailable"
                    : avail?.status === "maybe"
                      ? "maybe"
                      : "unset";

          return (
            <button
              key={dateStr}
              onClick={() => handleDayClickWithLongPressCheck(date)}
              onTouchStart={() =>
                !isPast &&
                handleTouchStart(dateStr, isRegularPlayDay, isSpecialPlayDate)
              }
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
              disabled={(!isPlayDay && !canAddAsSpecial) || isPast}
              className={`group relative w-full aspect-square min-h-[36px] rounded-sm flex items-center justify-center text-xs transition-all select-none ${bgColor} ${textColor} ${cursor} ${extraStyles} ${todayStyles}`}
              style={{ WebkitTouchCallout: "none" }}
              data-date={dateStr}
              data-status={dataStatus}
              data-special={isSpecialPlayDate ? "true" : undefined}
              title={cellTooltip}
            >
              {/* Scheduled game star decoration - visible indicator beyond color */}
              {isConfirmed && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <svg
                    className="w-[85%] h-[85%] text-cal-scheduled-text/30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                  </svg>
                </span>
              )}
              {format(date, "d")}
              {/* Special play date indicator - corner triangle */}
              {isSpecialPlayDate && !isPast && (
                <span className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-primary border-l-[10px] border-l-transparent" />
              )}
              {/* GM: Add special play date icon on non-play days */}
              {canAddAsSpecial && onToggleSpecialDate && (
                <span
                  className="absolute top-0.5 left-0.5 text-[10px] leading-none cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-125 transition-all text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Prevent click after long-press (mobile)
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    onToggleSpecialDate(dateStr);
                  }}
                  title="Enable as special play date"
                >
                  +
                </span>
              )}
              {/* GM: Remove special play date icon */}
              {canRemoveSpecial && onToggleSpecialDate && (
                <span
                  className="absolute top-0.5 left-0.5 text-[10px] leading-none cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-125 transition-all text-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Prevent click after long-press (mobile)
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    onToggleSpecialDate(dateStr);
                  }}
                  title="Remove special play date"
                >
                  -
                </span>
              )}
              {/* Time constraint clock icon */}
              {isPlayDay && !isPast && hasTimeConstraint && (
                <span
                  className="absolute bottom-0.5 left-1 text-[10px] leading-none pointer-events-none"
                  title={(() => {
                    const after = formatTimeShort(avail?.available_after ?? null);
                    const until = formatTimeShort(avail?.available_until ?? null);
                    if (after && until) return `${after}–${until}`;
                    if (after) return `After ${after}`;
                    return `Until ${until}`;
                  })()}
                >
                  🕐
                </span>
              )}
              {/* Note/comment icon for play days */}
              {isPlayDay && !isPast && hasAvailability && (
                <span
                  className={`absolute bottom-0.5 right-1 text-xs leading-none cursor-pointer hover:scale-125 transition-all ${
                    hasComment
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Prevent duplicate open after long-press (mobile)
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    onEditComment(dateStr);
                  }}
                  title={hasComment ? `Edit note: ${avail!.comment}` : "Add note"}
                >
                  {hasComment ? "💬" : "✏️"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Time options for availability selects (30-minute increments)
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const h12 = h % 12 || 12;
      const ampm = h >= 12 ? "PM" : "AM";
      const label = m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
})();

// Extracted component to avoid IIFE in JSX (Turbopack compatibility)
interface NoteEditorPopoverProps {
  commentingDate: string;
  showTimeFields: boolean;
  commentText: string;
  availableAfterText: string;
  availableUntilText: string;
  onCommentChange: (value: string) => void;
  onAvailableAfterChange: (value: string) => void;
  onAvailableUntilChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function NoteEditorPopover({
  commentingDate,
  showTimeFields,
  commentText,
  availableAfterText,
  availableUntilText,
  onCommentChange,
  onAvailableAfterChange,
  onAvailableUntilChange,
  onSave,
  onCancel,
}: NoteEditorPopoverProps) {
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
            Note for {format(parseISO(commentingDate), "MMM d")}
          </span>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            &times;
          </button>
        </div>
        {showTimeFields && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Available after
              </label>
              <select
                value={availableAfterText}
                onChange={(e) => onAvailableAfterChange(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">—</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Available until
              </label>
              <select
                value={availableUntilText}
                onChange={(e) => onAvailableUntilChange(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">—</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="mb-3">
          <label className="block text-xs text-muted-foreground mb-1">
            Note
          </label>
          <input
            type="text"
            value={commentText}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="e.g., Depends on work schedule"
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>
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
      </div>
    </div>
  );
}
