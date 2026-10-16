'use client';

import { Card, CardContent, CardHeader } from '@/components/ui';
import type { GameState, HealthyBy } from '@/lib/admin';

// Shared by the admin engagement and platform-health charts.

export type TimeRange = '8' | '12' | '26' | 'all';

/** Health states with healthy split by its evidence (HealthyBy). */
export type HealthBucket = 'healthyBooked' | 'healthyViable' | 'gettingGoing' | 'unhealthy' | 'dormant';

/** One label and color per bucket, healthiest first — every admin view of health
 *  (trend charts, distribution bars, games list) reads from here. Both healthy
 *  buckets are green: they count as healthy alike, the shade shows the evidence. */
export const HEALTH_BUCKETS: ReadonlyArray<{ key: HealthBucket; label: string; short: string; color: string }> = [
  { key: 'healthyBooked', label: 'Healthy · booked', short: 'Booked', color: '#15803d' },
  { key: 'healthyViable', label: 'Healthy · date found', short: 'Date found', color: '#4ade80' },
  { key: 'gettingGoing', label: 'Getting going', short: 'Going', color: '#3b82f6' },
  { key: 'unhealthy', label: 'Unhealthy', short: 'Unhealthy', color: '#ef4444' },
  { key: 'dormant', label: 'Dormant', short: 'Dormant', color: '#64748b' },
];

export function healthBucket(state: GameState, healthyBy: HealthyBy | null): HealthBucket {
  if (state === 'healthy') return healthyBy === 'booked' ? 'healthyBooked' : 'healthyViable';
  return state;
}

export const AXIS_PROPS = {
  stroke: 'var(--muted-foreground)',
  tickLine: false,
} as const;

export function formatDayLabel(dayStr: string): string {
  const date = new Date(dayStr + 'T00:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Custom tooltip that uses Tailwind classes for proper theme support. A series'
 *  own `unit` prop wins over the tooltip-wide one, for charts that mix % and counts. */
export function ChartTooltip({ active, payload, label, unit = '' }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string; unit?: string }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-sm px-3 py-2 text-xs shadow-lg">
      {label && <p className="text-muted-foreground mb-1">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="text-card-foreground">
          <span style={{ color: entry.color }}>&#9679;</span>{' '}
          {entry.name}: <span className="font-medium">{entry.value ?? '—'}{entry.value != null ? (entry.unit ?? unit) : ''}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartCard({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h4 className="text-sm font-semibold text-card-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
