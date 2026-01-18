"use client";

import { useMemo, useState } from "react";
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

export interface AvailabilityEntry {
  status: AvailabilityStatus;
  comment: string | null;
}

interface AvailabilityCalendarProps {
  playDays: number[];
  windowMonths: number;
  availability: Record<string, AvailabilityEntry>;
  onToggle: (date: string, status: AvailabilityStatus, comment: string | null) => void;
  confirmedSessions: GameSession[];
}

export function AvailabilityCalendar({
  playDays,
  windowMonths,
  availability,
  onToggle,
  confirmedSessions,
}: AvailabilityCalendarProps) {
  const today = startOfDay(new Date());
  const maxDate = endOfMonth(addMonths(today, windowMonths));
  const [commentingDate, setCommentingDate] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Generate array of months to display
  const months = useMemo(() => {
    const result = [];
    let current = startOfMonth(today);
    while (isBefore(current, maxDate) || current.getTime() === startOfMonth(maxDate).getTime()) {
      result.push(current);
      current = addMonths(current, 1);
    }
    return result;
  }, [today, maxDate]);

  const confirmedDates = new Set(confirmedSessions.map((s) => s.date));

  // Cycle through: unset -> available (yes) -> unavailable (no) -> maybe -> available (continuous)
  const getNextStatus = (current: AvailabilityEntry | undefined): AvailabilityStatus => {
    if (!current) return 'available';
    switch (current.status) {
      case 'available': return 'unavailable';
      case 'unavailable': return 'maybe';
      case 'maybe': return 'available';
    }
  };

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date);

    // Can't toggle non-play days
    if (!playDays.includes(dayOfWeek)) return;

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
      const currentStatus = availability[commentingDate]?.status || 'available';
      onToggle(commentingDate, currentStatus, commentText.trim() || null);
      setCommentingDate(null);
      setCommentText("");
    }
  };

  const handleCancelComment = () => {
    setCommentingDate(null);
    setCommentText("");
  };

  const bulkSetDay = (dayOfWeek: number, status: AvailabilityStatus) => {
    const datesInWindow = eachDayOfInterval({
      start: today,
      end: maxDate,
    }).filter((date) => getDay(date) === dayOfWeek && !isBefore(date, today));

    datesInWindow.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      onToggle(dateStr, status, null);
    });
  };

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      <div className="bg-secondary rounded-lg p-3">
        <p className="text-xs font-medium text-foreground mb-2">
          Quick Actions
        </p>
        <div className="flex flex-wrap gap-1.5">
          {playDays.map((day) => (
            <div key={day} className="flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkSetDay(day, 'available')}
                className="text-xs h-7 px-2"
              >
                All {DAY_LABELS.full[day]}s ✓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => bulkSetDay(day, 'unavailable')}
                className="text-xs h-7 px-2"
              >
                ✗
              </Button>
            </div>
          ))}
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
          <span>Not set</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <span>Not a play day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">🎲</span>
          <span>Confirmed</span>
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
                Note for {format(parseISO(commentingDate), 'MMM d')}
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
                if (e.key === 'Enter') handleSaveComment();
                if (e.key === 'Escape') handleCancelComment();
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
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSaveComment}
              >
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
}: MonthCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const startDayOfWeek = getDay(startOfMonth(month));

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
          <div key={`empty-${i}`} className="w-full aspect-square min-h-[36px]" />
        ))}

        {/* Day cells */}
        {days.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const dayOfWeek = getDay(date);
          const isPlayDay = playDays.includes(dayOfWeek);
          const isPast = isBefore(date, today);
          const isConfirmed = confirmedDates.has(dateStr);
          const avail = availability[dateStr];

          let bgColor = "bg-muted"; // Non-play day
          let textColor = "text-muted-foreground";
          let cursor = "cursor-default";

          if (isPlayDay && !isPast) {
            cursor = "cursor-pointer hover:ring-1 hover:ring-primary/50";
            if (avail?.status === 'available') {
              bgColor = "bg-success/20";
              textColor = "text-success";
            } else if (avail?.status === 'maybe') {
              bgColor = "bg-warning/20";
              textColor = "text-warning";
            } else if (avail?.status === 'unavailable') {
              bgColor = "bg-danger/20";
              textColor = "text-danger";
            } else {
              bgColor = "bg-card border border-border";
              textColor = "text-card-foreground";
            }
          } else if (isPast) {
            textColor = "text-muted-foreground/50";
          }

          const hasComment = !!avail?.comment;
          const hasAvailability = !!avail;

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(date)}
              disabled={!isPlayDay || isPast}
              className={`relative w-full aspect-square min-h-[36px] rounded-sm flex items-center justify-center text-xs transition-all ${bgColor} ${textColor} ${cursor} ${
                isToday(date) ? "ring-1 ring-primary font-bold" : ""
              }`}
              title={avail?.comment ? `${dateStr}\n${avail.comment}` : dateStr}
            >
              {format(date, "d")}
              {isConfirmed && (
                <span className="absolute top-0.5 right-1 text-xs leading-none">🎲</span>
              )}
              {isPlayDay && !isPast && hasAvailability && (
                <span
                  className="absolute bottom-0.5 right-1 text-xs leading-none cursor-pointer hover:scale-125 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
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
