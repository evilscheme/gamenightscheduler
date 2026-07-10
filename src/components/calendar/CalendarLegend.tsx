'use client';

import { CalendarDays } from 'lucide-react';

interface CalendarLegendProps {
  /** Show the "Extra date" swatch — only meaningful when the game has regular play days. */
  hasPlayDays: boolean;
  /** Show the "Outside campaign" swatch — only meaningful for campaigns with date bounds. */
  hasCampaignDates: boolean;
}

// Compact Legend
export function CalendarLegend({ hasPlayDays, hasCampaignDates }: CalendarLegendProps) {
  return (
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
      {hasPlayDays && (
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
  );
}
