'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { LoadingSpinner } from '@/components/ui';
import {
  FUNNEL_POOL_WEEKS,
  FUNNEL_WINDOW_DAYS,
  healthyShare,
  type FunnelCohort,
  type HealthBucket,
  type StateCounts,
} from '@/lib/admin';
import { queryKeys } from '@/lib/queryKeys';
import { ADMIN_QUERY_OPTIONS } from '@/lib/constants';
import type { AdminHealthTrends } from '@/types/api';
import {
  AXIS_PROPS,
  ChartCard,
  ChartTooltip,
  HEALTH_BUCKETS,
  formatDayLabel,
  type TimeRange,
} from './chartUtils';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

const GRID = <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />;
const SMALL_TICK = { fontSize: 10 };

/** Bottom to top: healthy sits on the axis so its count reads straight off it.
 *  Dormant games and churned users are left out of the trends. */
const TRACKED_BUCKETS = HEALTH_BUCKETS.filter((b) => b.key !== 'dormant');

/** Legend items in the given dataKey order (Recharts sorts alphabetically by default). */
const legendOrder = (keys: readonly string[]) => (item: { dataKey?: unknown }) => keys.indexOf(String(item.dataKey));
const bucketLegend = legendOrder(TRACKED_BUCKETS.map((b) => b.key));

const bucketColor = (key: HealthBucket) => HEALTH_BUCKETS.find((b) => b.key === key)?.color;

/** Funnel steps in legend order. The game-night steps take the health charts'
 *  colours, so "date found" and "booked" look the same everywhere on the page. */
const FUNNEL_STEPS: { key: string; name: string; color?: string; count: (c: FunnelCohort) => number }[] = [
  { key: 'joined', name: 'In a game', color: '#3b82f6', count: (c) => c.joinedGame },
  { key: 'availability', name: 'Entered dates', color: '#f59e0b', count: (c) => c.enteredAvailability },
  { key: 'found', name: 'Game night found', color: bucketColor('healthyViable'), count: (c) => c.foundGameNight },
  { key: 'booked', name: 'Booked', color: bucketColor('healthyBooked'), count: (c) => c.bookedGameNight },
];
const funnelLegend = legendOrder(FUNNEL_STEPS.map((s) => s.key));
/** Each step is two lines under one name, solid and its dashed tail; where they
 *  join both carry a value, so the tooltip keeps one entry per name. */
const funnelTooltipKey = (entry: { name?: unknown }) => entry.name;

/** A window's counts, or just its label when the day has no row (a gap). */
type StatePoint = { label: string } & Partial<StateCounts>;

/** Stacked counts by bucket; dormant games and churned users are left out. */
function StateChart({ data, marker }: { data: StatePoint[]; marker: React.ReactNode }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        {GRID}
        <XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" {...AXIS_PROPS} />
        <YAxis tick={SMALL_TICK} allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} itemSorter={bucketLegend} />
        {TRACKED_BUCKETS.map((b) => (
          <Area
            key={b.key}
            type="linear"
            dataKey={b.key}
            name={b.label}
            stackId="buckets"
            stroke={b.color}
            fill={b.color}
            fillOpacity={0.35}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
        {marker}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function PlatformHealthCharts({ timeRange }: { timeRange: TimeRange }) {
  const { data, isPending, error } = useQuery({
    ...ADMIN_QUERY_OPTIONS,
    queryKey: queryKeys.adminHealthTrends(timeRange),
    queryFn: async (): Promise<AdminHealthTrends> => {
      const res = await fetch(`/api/admin/health-trends?weeks=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch platform health data');
      return res.json();
    },
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (error) return <div className="text-danger text-center py-12">{error.message}</div>;

  const games: StatePoint[] = data.health.map((p) => ({ label: formatDayLabel(p.windowEnd), ...p.counts?.games }));
  const users: StatePoint[] = data.health.map((p) => ({ label: formatDayLabel(p.windowEnd), ...p.counts?.users }));
  const share = data.health.map((p) => ({
    label: formatDayLabel(p.windowEnd),
    games: p.counts ? healthyShare(p.counts.games) : null,
    users: p.counts ? healthyShare(p.counts.users) : null,
  }));
  // The marker sits where points become live for good: the first snapshot after
  // the last rebuilt point. A cron gap-fill can rebuild a day after snapshots
  // began, so "first snapshot" alone would mislabel those later points as live.
  const lastRebuilt = data.health.findLastIndex((p) => p.source === 'reconstructed');
  const hasReconstructed = lastRebuilt >= 0;
  const liveFrom = data.health.slice(lastRebuilt + 1).find((p) => p.source === 'snapshot');
  const snapshotMarker = liveFrom && hasReconstructed ? (
    <ReferenceLine
      x={formatDayLabel(liveFrom.windowEnd)}
      stroke="var(--muted-foreground)"
      strokeDasharray="4 4"
      label={{ value: 'live', position: 'insideTopRight', fontSize: 10, fill: 'var(--muted-foreground)' }}
    />
  ) : null;
  const provenance = hasReconstructed
    ? liveFrom
      ? 'Left of the dashed line is rebuilt from history (approximate)'
      : 'Rebuilt from history (approximate)'
    : null;

  // Recharts can't dash part of a line, so each step is drawn twice: solid over
  // mature points, dashed from the last mature point on, so the two join.
  const lastMature = data.funnel.findLastIndex((c) => c.mature);
  const funnel = data.funnel.map((c, i) => {
    const point: Record<string, string | number | null> = { label: formatDayLabel(c.windowEnd) };
    for (const step of FUNNEL_STEPS) {
      const value = pct(step.count(c), c.signups);
      point[step.key] = c.mature ? value : null;
      point[`${step.key}Tail`] = i >= lastMature ? value : null;
    }
    return point;
  });

  const gameNights = data.gameNights.map((d) => ({ label: formatDayLabel(d.windowEnd), ...d }));

  const dormancy = data.dormancy.map((d) => ({ label: formatDayLabel(d.windowEnd), ...d }));
  const deletions = data.deletions.map((d) => ({ label: formatDayLabel(d.windowEnd), ...d }));

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground pt-2">Platform Health</h3>

      <ChartCard
        title="Game Nights"
        subtitle="People whose group had a game night that week: a session booked, or a date enough of them could make by the calendar's rule. Each person counted once"
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={gameNights} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            {GRID}
            <XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" {...AXIS_PROPS} />
            <YAxis tick={SMALL_TICK} allowDecimals={false} {...AXIS_PROPS} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="booked" name="Booked" stackId="nights" fill={bucketColor('healthyBooked')} fillOpacity={0.8} />
            <Bar
              dataKey="dateFound"
              name="Date found"
              stackId="nights"
              fill={bucketColor('healthyViable')}
              fillOpacity={0.8}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Healthy Games"
          subtitle={`Healthy: players, and a session booked or a date in the next 6 weeks enough of them can make. Getting going: neither, but active in the last week. Unhealthy: neither, quiet 1–8 weeks. Dormant games (8+ weeks) left out${provenance ? ` · ${provenance}` : ''}`}
        >
          <StateChart data={games} marker={snapshotMarker} />
        </ChartCard>

        <ChartCard
          title="Healthy Users"
          subtitle={`Healthy: in a healthy game. Getting going: signed up in the last week, or in a game getting going. Unhealthy: the rest. Churned users (no live game, here 8+ weeks) left out${provenance ? ` · ${provenance}` : ''}`}
        >
          <StateChart data={users} marker={snapshotMarker} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Healthy Share"
          subtitle="% of live games and active users that are healthy (dormant games and churned users left out)"
        >
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={share} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              {GRID}
              <XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" {...AXIS_PROPS} />
              <YAxis tick={SMALL_TICK} domain={[0, 100]} unit="%" {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="linear" dataKey="games" name="Games" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="linear" dataKey="users" name="Users" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              {snapshotMarker}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Activation Funnel"
          subtitle={`% of signups in the ${FUNNEL_POOL_WEEKS} weeks ending at each point who reached each step within ${FUNNEL_WINDOW_DAYS} days of signing up · dashed: still inside their ${FUNNEL_WINDOW_DAYS} days`}
        >
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={funnel} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              {GRID}
              <XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" {...AXIS_PROPS} />
              <YAxis tick={SMALL_TICK} domain={[0, 100]} unit="%" {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip unit="%" />} payloadUniqBy={funnelTooltipKey} />
              <Legend wrapperStyle={{ fontSize: '11px' }} itemSorter={funnelLegend} />
              {FUNNEL_STEPS.map((step) => (
                <Line key={step.key} type="linear" dataKey={step.key} name={step.name} stroke={step.color} strokeWidth={2} dot={false} />
              ))}
              {FUNNEL_STEPS.map((step) => (
                <Line
                  key={`${step.key}Tail`}
                  type="linear"
                  dataKey={`${step.key}Tail`}
                  name={step.name}
                  stroke={step.color}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  legendType="none"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Dormant Games" subtitle="Games going dormant (no game night ahead, quiet 8+ weeks), and dormant games coming back">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dormancy} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              {GRID}
              <XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" {...AXIS_PROPS} />
              <YAxis tick={SMALL_TICK} allowDecimals={false} {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="wentDormant" name="Went dormant" fill="var(--danger)" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
              <Bar dataKey="revived" name="Revived" fill="var(--success)" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Deletions" subtitle="Deliberate deletes per week (cascades excluded) · tracked from launch">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={deletions} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              {GRID}
              <XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" {...AXIS_PROPS} />
              <YAxis tick={SMALL_TICK} allowDecimals={false} {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="session" name="Sessions cancelled" stackId="del" fill="#8b5cf6" fillOpacity={0.8} />
              <Bar dataKey="membership" name="Players left or removed" stackId="del" fill="#f59e0b" fillOpacity={0.8} />
              <Bar dataKey="game" name="Games" stackId="del" fill="#ef4444" fillOpacity={0.8} />
              <Bar dataKey="user" name="Accounts" stackId="del" fill="#64748b" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
