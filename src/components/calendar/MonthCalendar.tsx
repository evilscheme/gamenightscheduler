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
import { AvailabilityEntry } from '@/lib/availability';
import { SCHEDULED_STAR_PATH } from '@/lib/constants';
import { calendarCellState } from '@/lib/calendarCellState';
import { type OtherGameSessionInfo } from '@/lib/schedule';
import { describeCalendarCell, tooltipModelToText, type TooltipModel } from '@/lib/calendarCellTooltip';
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
  onInertTap?: (message: string) => void;
  otherGameSessionsByDate?: Map<string, OtherGameSessionInfo[]>;
  readOnly?: boolean;
  onHoverDate?: (hover: { date: string; model: TooltipModel } | null) => void;
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
  onInertTap,
  otherGameSessionsByDate = new Map(),
  readOnly = false,
  onHoverDate,
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
          const isInert = (!isPlayDay && !canAddAsExtra) || isPast || isOutOfRange;

          const isTodayDate = isToday(date);
          const { bgColor, textColor, cursor, todayStyles, starFill, dataStatus } =
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

          const tooltipModel = describeCalendarCell({
            date: dateStr,
            isOutOfRange,
            isConfirmed,
            isPast,
            isPlayDay,
            isToday: isTodayDate,
            status: avail?.status,
            entry: avail,
            session: confirmedSessionsByDate.get(dateStr),
            gmNote: playDateNotes?.get(dateStr),
            otherSessions: otherSessions ?? [],
            isExtraDate: isExtraPlayDate,
            isGmOrCoGm,
            readOnly,
            canAddAsExtra,
            windowStart,
            windowEnd,
            use24h,
          });
          const cellAriaLabel = tooltipModelToText(tooltipModel);

          return (
            <button
              key={dateStr}
              onClick={() => {
                if (isInert) return;
                handleDayClickWithLongPressCheck(date);
              }}
              onMouseEnter={() => onHoverDate?.({ date: dateStr, model: tooltipModel })}
              onMouseLeave={() => onHoverDate?.(null)}
              onTouchStart={() => {
                if (isOutOfRange) {
                  onInertTap?.(
                    isBefore(date, windowStart) ? "Before campaign start" : "After campaign end"
                  );
                  return;
                }
                if (isPast) {
                  onInertTap?.("Past date");
                  return;
                }
                // A GM can long-press a non-play day to add it, so only the
                // members who genuinely can't act get the toast.
                if (!isPlayDay && !canAddAsExtra) {
                  onInertTap?.("Not a play day");
                  return;
                }
                handleTouchStart(dateStr, isRegularPlayDay, isExtraPlayDate);
              }}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
              aria-disabled={isInert || undefined}
              // aria-disabled keeps the cell in the a11y tree so its label can
              // explain why it's dead, but a hover-only popover gives a keyboard
              // user nothing to reach — so inert cells stay out of the tab order.
              tabIndex={isInert ? -1 : 0}
              className={`group relative w-full aspect-square min-h-9 rounded-sm flex items-center justify-center font-mono text-xl transition-all select-none ${bgColor} ${textColor} ${cursor} ${todayStyles}`}
              style={{ WebkitTouchCallout: "none" }}
              data-date={dateStr}
              data-status={dataStatus}
              data-availability={isConfirmed && !isPast ? (avail?.status ?? "unset") : undefined}
              data-extra={isExtraPlayDate ? "true" : undefined}
              data-other-game={showOtherGameBadge ? "true" : undefined}
              aria-label={cellAriaLabel}
            >
              {/* Scheduled game star decoration */}
              {isConfirmed && (
                <span className={`absolute inset-0 pointer-events-none ${isPast ? "opacity-50" : ""}`}>
                  <svg
                    className={`size-full ${starFill}`}
                    viewBox="0 0 24 24"
                  >
                    <path d={SCHEDULED_STAR_PATH} />
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
                >
                  <CalendarDays className="size-2.5" />
                </span>
              )}
              <span className="relative z-10">{format(date, "d")}</span>
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
                  aria-label={playDays.length > 0 ? "Add extra date" : "Add play date"}
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
                  aria-label={playDays.length > 0 ? "Remove extra date" : "Remove play date"}
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
                    <span data-testid="time-indicator">
                      <Clock className="size-2.5" />
                    </span>
                  )}
                  {playDateNotes?.has(dateStr) && (
                    <span data-testid="note-indicator">
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
                  aria-label={
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
