'use client';

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isBefore,
  isAfter,
} from 'date-fns';
import { CalendarDays, Clock, FileText, MessageSquare, Pencil, Plus, X } from 'lucide-react';
import type { GameSession } from '@/types';
import { AvailabilityEntry } from '@/lib/availabilityStatus';
import { formatTimeShort } from '@/lib/formatting';
import { calendarCellState } from '@/lib/calendarCellState';
import {
  formatSessionTimeWindow,
  type OtherGameSessionInfo,
} from '@/lib/otherGameSessions';
import { useLongPress } from '@/hooks/useLongPress';

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

export function MonthCalendar({
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
  const { handleTouchStart, handleTouchEnd, consumeLongPress } = useLongPress(
    (dateStr, isRegularPlayDay, isExtraPlayDate) => {
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
    }
  );

  const handleDayClickWithLongPressCheck = (date: Date) => {
    if (consumeLongPress()) return;
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
                    if (consumeLongPress()) return;
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
                    if (consumeLongPress()) return;
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
                    if (consumeLongPress()) return;
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
                    if (consumeLongPress()) return;
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
