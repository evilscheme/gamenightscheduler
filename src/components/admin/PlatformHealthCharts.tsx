'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { LoadingSpinner } from '@/components/ui';
import { healthyShare, type StateCounts } from '@/lib/admin';
import { queryKeys } from '@/lib/queryKeys';
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
const funnelLegend = legendOrder(['joined', 'availability', 'session']);

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

  const funnel = data.funnel.map((c) => ({
    label: formatDayLabel(c.windowEnd),
    joined: pct(c.joinedGame, c.signups),
    availability: pct(c.enteredAvailability, c.signups),
    session: pct(c.gotSession, c.signups),
  }));

  const dormancy = data.dormancy.map((d) => ({ label: formatDayLabel(d.windowEnd), ...d }));
  const deletions = data.deletions.map((d) => ({ label: formatDayLabel(d.windowEnd), ...d }));

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground pt-2">Platform Health</h3>

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

        <ChartCard title="Activation Funnel" subtitle="% of each week's signups who reached each step so far">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={funnel} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              {GRID}
              <XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" {...AXIS_PROPS} />
              <YAxis tick={SMALL_TICK} domain={[0, 100]} unit="%" {...AXIS_PROPS} />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} itemSorter={funnelLegend} />
              <Line type="linear" dataKey="joined" name="In a game" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="linear" dataKey="availability" name="Entered dates" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="linear" dataKey="session" name="Got a session" stroke="#8b5cf6" strokeWidth={2} dot={false} />
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
