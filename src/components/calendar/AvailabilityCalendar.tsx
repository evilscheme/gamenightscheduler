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

  // Cycle through: unset -> unavailable -> maybe -> available -> unavailable (continuous)
  const getNextStatus = (current: AvailabilityEntry | undefined): AvailabilityStatus => {
    if (!current) return 'unavailable';
    switch (current.status) {
      case 'unavailable': return 'maybe';
      case 'maybe': return 'available';
      case 'available': return 'unavailable';
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

    if (nextStatus === 'maybe') {
      // Open comment input for maybe status
      setCommentingDate(dateStr);
      setCommentText(currentAvail?.comment || "");
    } else {
      onToggle(dateStr, nextStatus, null);
    }
  };

  const handleMaybeConfirm = () => {
    if (commentingDate) {
      onToggle(commentingDate, 'maybe', commentText.trim() || null);
      setCommentingDate(null);
      setCommentText("");
    }
  };

  const handleMaybeCancel = () => {
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {months.map((month) => (
          <MonthCalendar
            key={format(month, "yyyy-MM")}
            month={month}
            playDays={playDays}
            availability={availability}
            confirmedDates={confirmedDates}
            today={today}
            onDayClick={handleDayClick}
            weekdays={DAY_LABELS.abbrev}
          />
        ))}
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500/20 dark:bg-green-500/30 border border-green-500/30" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-yellow-500/20 dark:bg-yellow-500/30 border border-yellow-500/30" />
          <span>Maybe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500/20 dark:bg-red-500/30 border border-red-500/30" />
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

      {/* Maybe comment modal */}
      {commentingDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-card-foreground mb-2">
              Maybe Available
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {format(new Date(commentingDate), 'EEEE, MMMM d, yyyy')}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Add a note (optional)
              </label>
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="e.g., Depends on work schedule"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMaybeConfirm();
                  if (e.key === 'Escape') handleMaybeCancel();
                }}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleMaybeCancel}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleMaybeConfirm}
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
  weekdays: readonly string[];
}

function MonthCalendar({
  month,
  playDays,
  availability,
  confirmedDates,
  today,
  onDayClick,
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
      <div className="grid grid-cols-7 gap-px">
        {/* Empty cells for start of month offset */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="w-full aspect-square" />
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
              bgColor = "bg-green-500/20 dark:bg-green-500/30";
              textColor = "text-green-700 dark:text-green-400";
            } else if (avail?.status === 'maybe') {
              bgColor = "bg-yellow-500/20 dark:bg-yellow-500/30";
              textColor = "text-yellow-700 dark:text-yellow-400";
            } else if (avail?.status === 'unavailable') {
              bgColor = "bg-red-500/20 dark:bg-red-500/30";
              textColor = "text-red-700 dark:text-red-400";
            } else {
              bgColor = "bg-card border border-border";
              textColor = "text-card-foreground";
            }
          } else if (isPast) {
            textColor = "text-muted-foreground/50";
          }

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(date)}
              disabled={!isPlayDay || isPast}
              className={`w-full aspect-square rounded-sm flex items-center justify-center text-[10px] transition-all ${bgColor} ${textColor} ${cursor} ${
                isToday(date) ? "ring-1 ring-primary font-bold" : ""
              }`}
              title={avail?.comment ? `${dateStr}\n${avail.comment}` : dateStr}
            >
              <span className="relative">
                {format(date, "d")}
                {isConfirmed && (
                  <span className="absolute -top-1 -right-2 text-[8px]">🎲</span>
                )}
                {avail?.comment && (
                  <span className="absolute -bottom-1 -right-2 text-[8px]">💬</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
