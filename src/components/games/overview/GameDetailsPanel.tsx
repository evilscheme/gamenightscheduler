'use client';

import { parseISO } from 'date-fns';
import { EyebrowLabel, Panel } from '@/components/ui';
import { CalendarSubscribeButton } from '@/components/games/CalendarSubscribeButton';
import { DAY_LABELS } from '@/lib/constants';
import { formatTime } from '@/lib/formatting';
import { formatTimezoneDisplay } from '@/lib/timezone';

function formatDisplayDate(dateStr: string): string {
  return parseISO(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface GameDetailsPanelProps {
  playDays: number[];
  schedulingWindowMonths: number;
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  timezone: string | null;
  minPlayersNeeded?: number;
  subscribeUrl: string;
  use24h?: boolean;
  adHocOnly?: boolean;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <EyebrowLabel variant="muted">{label}</EyebrowLabel>
      <div className="mt-1 text-sm text-card-foreground">{children}</div>
    </div>
  );
}

export function GameDetailsPanel({
  playDays,
  schedulingWindowMonths,
  defaultStartTime,
  defaultEndTime,
  timezone,
  minPlayersNeeded = 0,
  subscribeUrl,
  use24h = false,
  adHocOnly = false,
  campaignStartDate,
  campaignEndDate,
}: GameDetailsPanelProps) {
  return (
    <Panel>
      <EyebrowLabel>Game details</EyebrowLabel>
      <div className="mt-3 space-y-4">
        <Field label={adHocOnly ? 'Scheduling' : 'Play days'}>
          {adHocOnly
            ? 'Ad-hoc dates only'
            : playDays.map((d) => DAY_LABELS.full[d]).join(', ')}
        </Field>

        <Field label="Scheduling window">
          <span className="font-mono">{schedulingWindowMonths}</span>{' '}
          {schedulingWindowMonths === 1 ? 'month' : 'months'} ahead
          {(campaignStartDate || campaignEndDate) && (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {campaignStartDate && campaignEndDate
                ? `${formatDisplayDate(campaignStartDate)} – ${formatDisplayDate(campaignEndDate)}`
                : campaignStartDate
                  ? `Starting ${formatDisplayDate(campaignStartDate)}`
                  : `Until ${formatDisplayDate(campaignEndDate!)}`}
            </p>
          )}
        </Field>

        <Field label="Default session time">
          <span className="font-mono">
            {formatTime(defaultStartTime, use24h)} – {formatTime(defaultEndTime, use24h)}
          </span>
        </Field>

        {timezone && (
          <Field label="Timezone">{formatTimezoneDisplay(timezone)}</Field>
        )}

        {minPlayersNeeded > 0 && (
          <Field label="Minimum players">
            <span className="font-mono">{minPlayersNeeded}</span> needed
          </Field>
        )}

        <div>
          <EyebrowLabel variant="muted">Calendar subscription</EyebrowLabel>
          <p className="mb-2 mt-1 text-[11px] text-muted-foreground">
            Subscribe to auto-sync confirmed sessions to your calendar app.
          </p>
          <CalendarSubscribeButton webcalUrl={subscribeUrl} />
        </div>
      </div>
    </Panel>
  );
}
