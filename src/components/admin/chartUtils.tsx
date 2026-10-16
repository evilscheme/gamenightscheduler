'use client';

import { Card, CardContent, CardHeader } from '@/components/ui';
import { HEALTH_BUCKET_ORDER, type HealthBucket, type WEEK_RANGES } from '@/lib/admin';

// Shared by the admin engagement and platform-health charts.

/** A chart range as sent in the `weeks` param. */
export type TimeRange = `${(typeof WEEK_RANGES)[number]}` | 'all';

// Both healthy buckets are green: they count as healthy alike, the shade shows the evidence.
const BUCKET_STYLE: Record<HealthBucket, { label: string; short: string; color: string }> = {
  healthyBooked: { label: 'Healthy · booked', short: 'Booked', color: '#15803d' },
  healthyViable: { label: 'Healthy · date found', short: 'Date found', color: '#4ade80' },
  gettingGoing: { label: 'Getting going', short: 'Going', color: '#3b82f6' },
  unhealthy: { label: 'Unhealthy', short: 'Unhealthy', color: '#ef4444' },
  dormant: { label: 'Dormant', short: 'Dormant', color: '#64748b' },
};

/** Label and color per health bucket, healthiest first — every admin view of
 *  health (trend charts, distribution bars, games list) reads from here. */
export const HEALTH_BUCKETS = HEALTH_BUCKET_ORDER.map((key) => ({ key, ...BUCKET_STYLE[key] }));

export const AXIS_PROPS = {
  stroke: 'var(--muted-foreground)',
  tickLine: false,
} as const;

export function formatDayLabel(dayStr: string): string {
  const date = new Date(dayStr + 'T00:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Custom tooltip that uses Tailwind classes for proper theme support */
export function ChartTooltip({ active, payload, label, unit = '' }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
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
          {entry.name}: <span className="font-medium">{entry.value ?? '—'}{entry.value != null ? unit : ''}</span>
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
