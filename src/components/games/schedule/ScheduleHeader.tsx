'use client';

import { EyebrowLabel } from '@/components/ui';
import { DAY_LABELS } from '@/lib/constants';

interface ScheduleHeaderProps {
  gameName: string;
  playDays: number[];
  monthRange: string;
  candidateCount: number;
  updatedAgo: string | null;
}

function formatCadence(playDays: number[]): string {
  if (!playDays.length) return 'Ad-hoc';
  return playDays.map((d) => DAY_LABELS.short[d]).join(' / ');
}

export function ScheduleHeader({ gameName, playDays, monthRange, candidateCount, updatedAgo }: ScheduleHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <EyebrowLabel>{`${gameName.toUpperCase()} · ${formatCadence(playDays).toUpperCase()}`}</EyebrowLabel>
        <h2 className="mt-1 text-2xl font-semibold text-foreground">Best nights for the party</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {monthRange} · {candidateCount} candidate {candidateCount === 1 ? 'date' : 'dates'}
        </p>
      </div>
      {updatedAgo && (
        <p className="font-mono text-xs text-muted-foreground self-end sm:self-auto">
          Updated {updatedAgo}
        </p>
      )}
    </div>
  );
}
