"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
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
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const startDayOfWeek = getDay(startOfMonth(currentMonth));

  const canGoPrev = isSameMonth(currentMonth, today) ? false : true;
  const canGoNext = isBefore(endOfMonth(currentMonth), maxDate);

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

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
    <div className="space-y-6">
      {/* Bulk actions */}
      <div className="bg-secondary rounded-lg p-4">
        <p className="text-sm font-medium text-foreground mb-3">
          Quick Actions
        </p>
        <div className="flex flex-wrap gap-2">
          {playDays.map((day) => (
            <div key={day} className="flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkSetDay(day, true)}
                className="text-xs"
              >
                All {FULL_DAYS[day]}s Available
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => bulkSetDay(day, false)}
                className="text-xs"
              >
                Unavailable
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card rounded-lg border border-border p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            disabled={!canGoPrev}
          >
            &larr; Prev
          </Button>
          <h3 className="text-lg font-semibold text-card-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            disabled={!canGoNext}
          >
            Next &rarr;
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`text-center text-sm font-medium py-2 ${
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
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for start of month offset */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
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
              cursor = "cursor-pointer hover:ring-2 hover:ring-primary/50";
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
                onClick={() => handleDayClick(date)}
                disabled={!isPlayDay || isPast}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${bgColor} ${textColor} ${cursor} ${
                  isToday(date) ? "ring-2 ring-primary" : ""
                }`}
              >
                <span className={isToday(date) ? "font-bold" : ""}>
                  {format(date, "d")}
                </span>
                {isConfirmed && <span className="text-xs">🎲</span>}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 dark:bg-green-500/30 border border-green-500/30" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/20 dark:bg-red-500/30 border border-red-500/30" />
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-card border border-border" />
            <span>Not set</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted" />
            <span>Not a play day</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🎲</span>
            <span>Confirmed session</span>
          </div>
        </div>
      </div>
    </div>
  );
}
