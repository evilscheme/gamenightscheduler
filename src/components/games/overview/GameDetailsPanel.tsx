'use client';

import { Link2 } from 'lucide-react';
import { parseISO } from 'date-fns';
import { Button, EyebrowLabel, useToast } from '@/components/ui';
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
  inviteCode: string;
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
  inviteCode,
  use24h = false,
  adHocOnly = false,
  campaignStartDate,
  campaignEndDate,
}: GameDetailsPanelProps) {
  const toast = useToast();

  const copyCalendarUrl = async () => {
    const webcalUrl = `webcal://${window.location.host}/api/games/calendar/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(webcalUrl);
      toast.show('Calendar URL copied to clipboard.');
    } catch {
      toast.show('Could not copy. Select the URL manually.', 'danger');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
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
            Add this URL to your calendar app to auto-sync confirmed sessions.
          </p>
          <Button onClick={copyCalendarUrl} variant="secondary" size="sm">
            <Link2 className="size-3 mr-1" />
            Copy Calendar URL
          </Button>
        </div>
      </div>
    </div>
  );
}
