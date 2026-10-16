'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { LoadingSpinner } from '@/components/ui';
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
const STATES = HEALTH_BUCKETS.filter((st) => st.key !== 'dormant');

/** Legend in stacking order (Recharts sorts alphabetically by default). */
const LEGEND_ORDER: string[] = STATES.map((st) => st.key);
const legendRank = (item: { dataKey?: unknown }) => LEGEND_ORDER.indexOf(String(item.dataKey));

/** Funnel legend in step order. */
const FUNNEL_ORDER = ['joined', 'availability', 'session'];
const funnelRank = (item: { dataKey?: unknown }) => FUNNEL_ORDER.indexOf(String(item.dataKey));

type StatePoint = { label: string; healthyPct: number | null } & Record<
  'healthyBooked' | 'healthyViable' | 'gettingGoing' | 'unhealthy',
  number | null
>;

function toStatePoint(
  label: string,
  counts: Omit<StatePoint, 'label' | 'healthyPct'>
): StatePoint {
  const values = Object.values(counts);
  if (values.some((v) => v == null)) return { label, ...counts, healthyPct: null };
  const tracked = (values as number[]).reduce((a, b) => a + b, 0);
  return { label, ...counts, healthyPct: pct(counts.healthyBooked! + counts.healthyViable!, tracked) };
}

/** Stacked counts by state; dormant games and churned users are left out. The
 *  healthy share lives in its own chart — a second axis here read as if the
 *  stack should fill to 100%. */
function StateChart({ data, marker }: { data: StatePoint[]; marker: React.ReactNode }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        {GRID}
        <XAxis dataKey="label" tick={SMALL_TICK} interval="preserveStartEnd" {...AXIS_PROPS} />
        <YAxis tick={SMALL_TICK} allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} itemSorter={legendRank} />
        {STATES.map((st) => (
          <Area
            key={st.key}
            type="linear"
            dataKey={st.key}
            name={st.label}
            stackId="states"
            stroke={st.color}
            fill={st.color}
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

  const games = data.health.map((p) =>
    toStatePoint(formatDayLabel(p.windowEnd), {
      healthyBooked: p.healthyBookedGames,
      healthyViable: p.healthyViableGames,
      gettingGoing: p.gettingGoingGames,
      unhealthy: p.unhealthyGames,
    })
  );
  const users = data.health.map((p) =>
    toStatePoint(formatDayLabel(p.windowEnd), {
      healthyBooked: p.healthyBookedUsers,
      healthyViable: p.healthyViableUsers,
      gettingGoing: p.gettingGoingUsers,
      unhealthy: p.unhealthyUsers,
    })
  );
  // Points before this are rebuilt from timestamps; from here on they're live snapshots.
  const firstSnapshot = data.health.find((p) => p.source === 'snapshot');
  const hasReconstructed = data.health.some((p) => p.source === 'reconstructed');
  const snapshotMarker = firstSnapshot && hasReconstructed ? (
    <ReferenceLine
      x={formatDayLabel(firstSnapshot.windowEnd)}
      stroke="var(--muted-foreground)"
      strokeDasharray="4 4"
      label={{ value: 'live', position: 'insideTopRight', fontSize: 10, fill: 'var(--muted-foreground)' }}
    />
  ) : null;
  const provenance = hasReconstructed
    ? firstSnapshot
      ? 'Left of the dashed line is rebuilt from history (approximate)'
      : 'Rebuilt from history (approximate) until daily snapshots accumulate'
    : null;

  const share = games.map((g, i) => ({ label: g.label, games: g.healthyPct, users: users[i].healthyPct }));

  const funnel = data.funnel.map((c) => ({
    label: formatDayLabel(c.windowEnd),
    signups: c.signups,
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
              <Legend wrapperStyle={{ fontSize: '11px' }} itemSorter={funnelRank} />
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
              <Bar dataKey="wentDormant" name="Went dormant" fill="#ef4444" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
              <Bar dataKey="revived" name="Revived" fill="#22c55e" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
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
