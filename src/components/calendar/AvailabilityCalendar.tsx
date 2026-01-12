"use client";

import { useMemo } from "react";
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
import { GameSession } from "@/types";

interface AvailabilityCalendarProps {
  playDays: number[];
  windowMonths: number;
  availability: Record<string, boolean>;
  onToggle: (date: string, isAvailable: boolean) => void;
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

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date);

    // Can't toggle non-play days
    if (!playDays.includes(dayOfWeek)) return;

    // Can't toggle past dates
    if (isBefore(date, today)) return;

    // Toggle availability
    const currentAvail = availability[dateStr];
    onToggle(
      dateStr,
      currentAvail === false ? true : currentAvail === true ? false : false
    );
  };

  const bulkSetDay = (dayOfWeek: number, isAvailable: boolean) => {
    const datesInWindow = eachDayOfInterval({
      start: today,
      end: maxDate,
    }).filter((date) => getDay(date) === dayOfWeek && !isBefore(date, today));

    datesInWindow.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      onToggle(dateStr, isAvailable);
    });
  };

  const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
  const FULL_DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

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
                onClick={() => bulkSetDay(day, true)}
                className="text-xs h-7 px-2"
              >
                All {FULL_DAYS[day]}s ✓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => bulkSetDay(day, false)}
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
            weekdays={WEEKDAYS}
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
    </div>
  );
}

// Separate component for individual month to keep things clean
interface MonthCalendarProps {
  month: Date;
  playDays: number[];
  availability: Record<string, boolean>;
  confirmedDates: Set<string>;
  today: Date;
  onDayClick: (date: Date) => void;
  weekdays: string[];
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
            if (avail === true) {
              bgColor = "bg-green-500/20 dark:bg-green-500/30";
              textColor = "text-green-700 dark:text-green-400";
            } else if (avail === false) {
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
              title={dateStr}
            >
              <span className="relative">
                {format(date, "d")}
                {isConfirmed && (
                  <span className="absolute -top-1 -right-2 text-[8px]">🎲</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
