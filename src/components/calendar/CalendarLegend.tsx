'use client';

import { CalendarDays } from 'lucide-react';
import { SCHEDULED_STAR_PATH } from '@/lib/constants';

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
        <div className="size-3.5 rounded-sm border border-dashed border-cal-available-ink" />
        <span>Maybe</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="size-3.5 rounded-sm bg-cal-unavailable-bg" />
        <span>Unavailable</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="size-3.5 rounded-sm bg-cal-empty-bg" />
        <span>Not set</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="size-3.5 rounded-sm bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--muted)_3px,var(--muted)_5px)]" />
        <span>Non-play day</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="size-3.5 rounded-sm bg-cal-empty-bg shadow-[0_0_0_2px_var(--primary)]" />
        <span>Today</span>
      </div>
      {hasPlayDays && (
        <div className="flex items-center gap-1.5">
          <div className="relative size-3.5 rounded-sm bg-cal-empty-bg border border-cal-empty-text">
            <span className="absolute top-0 right-0 size-0 border-t-[6px] border-t-primary border-l-[6px] border-l-transparent" />
          </div>
          <span>Extra date</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1">
          <div className="size-3.5">
            <svg className="size-full fill-cal-available-bg" viewBox="0 0 24 24">
              <path d={SCHEDULED_STAR_PATH} />
            </svg>
          </div>
          <div className="size-3.5">
            <svg className="size-full fill-cal-unavailable-bg" viewBox="0 0 24 24">
              <path d={SCHEDULED_STAR_PATH} />
            </svg>
          </div>
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
