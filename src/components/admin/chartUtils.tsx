'use client';

import { Card, CardContent, CardHeader } from '@/components/ui';
import { HEALTH_BUCKET_ORDER, type HealthBucket, type WEEK_RANGES } from '@/lib/admin';

// Shared by the admin engagement and platform-health charts.

/** A chart range as sent in the `weeks` param. */
export type TimeRange = `${(typeof WEEK_RANGES)[number]}` | 'all';

// Status tokens (--success/--warning/--danger) mean the same thing in every theme
// and adapt to light/dark; --primary doesn't — it's the theme's brand hue (green in
// forest, rose in rose), which would collide with healthy or unhealthy. Both healthy
// buckets are --success: they count as healthy alike. Date found is mixed toward the
// card background, a softer shade of the same hue in light and dark themes.
const BUCKET_STYLE: Record<HealthBucket, { label: string; short: string; color: string }> = {
  healthyBooked: { label: 'Healthy · booked', short: 'Booked', color: 'var(--success)' },
  healthyViable: {
    label: 'Healthy · date found',
    short: 'Date found',
    color: 'color-mix(in srgb, var(--success) 60%, var(--card))',
  },
  gettingGoing: { label: 'Getting going', short: 'Going', color: 'var(--warning)' },
  unhealthy: { label: 'Unhealthy', short: 'Unhealthy', color: 'var(--danger)' },
  dormant: { label: 'Dormant', short: 'Dormant', color: 'var(--muted-foreground)' },
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
