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
import { GameSession, AvailabilityStatus } from "@/types";
import { DAY_LABELS } from "@/lib/constants";
import {
  getNextStatus,
  AvailabilityEntry,
} from "@/lib/availabilityStatus";

export type { AvailabilityEntry };

interface AvailabilityCalendarProps {
  playDays: number[];
  windowMonths: number;
  availability: Record<string, AvailabilityEntry>;
  onToggle: (
    date: string,
    status: AvailabilityStatus,
    comment: string | null
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
  const [bulkDayFilter, setBulkDayFilter] = useState<string>("remaining");
  const [bulkStatus, setBulkStatus] = useState<AvailabilityStatus>("available");

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

    // Cycle through states - preserve existing comment regardless of status
    const comment = currentAvail?.comment || null;
    onToggle(dateStr, nextStatus, comment);
  };

  const handleEditComment = (dateStr: string) => {
    setCommentingDate(dateStr);
    setCommentText(availability[dateStr]?.comment || "");
  };

  const handleSaveComment = () => {
    if (commentingDate) {
      const currentStatus = availability[commentingDate]?.status || "available";
      onToggle(commentingDate, currentStatus, commentText.trim() || null);
      setCommentingDate(null);
      setCommentText("");
    }
  };

  const handleCancelComment = () => {
    setCommentingDate(null);
    setCommentText("");
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
      // Preserve existing comments when bulk setting
      const existingComment = availability[dateStr]?.comment || null;
      onToggle(dateStr, status, existingComment);
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
            today={today}
            onDayClick={handleDayClick}
            onEditComment={handleEditComment}
            weekdays={DAY_LABELS.abbrev}
            specialPlayDates={specialPlayDates}
            isGmOrCoGm={isGmOrCoGm}
            onToggleSpecialDate={onToggleSpecialDate}
          />
        ))}
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-success/20 border border-success/30" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-warning/20 border border-warning/30" />
          <span>Maybe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-danger/20 border border-danger/30" />
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-card border border-border" />
          <span>Availability not set</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm non-play-day" />
          <span>Not a play day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-card border border-primary border-dashed" />
          <span>Special play day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm scheduled-session" />
          <span>Game scheduled</span>
        </div>
      </div>

      {/* Compact note editor popover */}
      {commentingDate && (
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={handleCancelComment}
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
                onClick={handleCancelComment}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="e.g., Depends on work schedule"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveComment();
                if (e.key === "Escape") handleCancelComment();
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={handleCancelComment}
              >
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSaveComment}>
                Save
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
  today: Date;
  onDayClick: (date: Date) => void;
  onEditComment: (dateStr: string) => void;
  weekdays: readonly string[];
  specialPlayDates: string[];
  isGmOrCoGm: boolean;
  onToggleSpecialDate?: (date: string) => void;
}

function MonthCalendar({
  month,
  playDays,
  availability,
  confirmedDates,
  today,
  onDayClick,
  onEditComment,
  weekdays,
  specialPlayDates,
  isGmOrCoGm,
  onToggleSpecialDate,
}: MonthCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const startDayOfWeek = getDay(startOfMonth(month));

  // Long-press handling for mobile
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = (dateStr: string, isPlayDay: boolean) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (isPlayDay) {
        // For play days, long-press opens comment editor
        onEditComment(dateStr);
      } else if (isGmOrCoGm && onToggleSpecialDate) {
        // For non-play days, GM can toggle special date
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

          let bgColor = "non-play-day"; // Non-play day (cross-hatched)
          let textColor = "text-muted-foreground";
          let cursor = "cursor-default";
          let extraStyles = "";

          if (isPlayDay && !isPast) {
            cursor = "cursor-pointer hover:ring-1 hover:ring-primary/50";
            if (avail?.status === "available") {
              bgColor = "bg-success/20";
              textColor = "text-success";
            } else if (avail?.status === "maybe") {
              bgColor = "bg-warning/20";
              textColor = "text-warning";
            } else if (avail?.status === "unavailable") {
              bgColor = "bg-danger/20";
              textColor = "text-danger";
            } else {
              bgColor = "bg-card border border-border";
              textColor = "text-card-foreground";
            }
            // Add dashed border for special play dates
            if (isSpecialPlayDate) {
              extraStyles = "border-primary border-dashed !border-2";
            }
          } else if (isPast) {
            textColor = "text-muted-foreground/50";
          }

          const hasComment = !!avail?.comment;
          const hasAvailability = !!avail;

          return (
            <button
              key={dateStr}
              onClick={() => handleDayClickWithLongPressCheck(date)}
              onTouchStart={() =>
                !isPast && handleTouchStart(dateStr, isPlayDay)
              }
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
              disabled={(!isPlayDay && !canAddAsSpecial) || isPast}
              className={`group relative w-full aspect-square min-h-[36px] rounded-sm flex items-center justify-center text-xs transition-all select-none ${bgColor} ${textColor} ${cursor} ${extraStyles} ${
                isToday(date) ? "ring-1 ring-primary font-bold" : ""
              } ${isConfirmed ? "scheduled-session" : ""}`}
              style={{ WebkitTouchCallout: "none" }}
              title={avail?.comment ? `${dateStr}\n${avail.comment}` : dateStr}
            >
              {isConfirmed ? (
                <span className="bg-card/80 px-1 rounded-sm">
                  {format(date, "d")}
                </span>
              ) : (
                format(date, "d")
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
                  title={hasComment ? "Edit note" : "Add note"}
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
