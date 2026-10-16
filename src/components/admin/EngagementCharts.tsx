'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, LoadingSpinner } from '@/components/ui';
import { queryKeys } from '@/lib/queryKeys';
import type { GameState, HealthyBy } from '@/lib/admin';
import type { EngagementBucket } from '@/lib/admin';
import {
  ChartTooltip,
  HEALTH_BUCKETS,
  healthBucket,
  type HealthBucket,
  formatDayLabel,
  type TimeRange,
} from './chartUtils';
import PlatformHealthCharts from './PlatformHealthCharts';

// ── Types ──────────────────────────────────────────────────

interface EngagementData {
  weeklyData: EngagementBucket[];
}

interface EngagementChartsProps {
  games: Array<{ healthState: GameState; healthyBy: HealthyBy | null }>;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '8', label: '8 weeks' },
  { value: '12', label: '12 weeks' },
  { value: '26', label: '6 months' },
  { value: 'all', label: 'All time' },
];

// ── Main Component ─────────────────────────────────────────

export default function EngagementCharts({ games }: EngagementChartsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12');

  const {
    data,
    isPending: loading,
    error,
  } = useQuery({
    queryKey: queryKeys.adminEngagement(timeRange),
    queryFn: async (): Promise<EngagementData> => {
      const res = await fetch(`/api/admin/engagement?weeks=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch engagement data');
      return res.json();
    },
  });

  const chartData = data?.weeklyData.map((w) => ({
    ...w,
    label: formatDayLabel(w.windowEnd),
  })) ?? [];

  const healthData = useMemo(() => {
    const counts = new Map<HealthBucket, number>();
    for (const g of games) {
      const bucket = healthBucket(g.healthState, g.healthyBy);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return HEALTH_BUCKETS.map((b) => ({ short: b.short, label: b.label, count: counts.get(b.key) ?? 0, fill: b.color }));
  }, [games]);

  return (
    <div className="space-y-6">
      {/* Section header with time range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">Engagement</h3>
        <div className="flex gap-1 bg-muted rounded-sm p-0.5">
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                timeRange === opt.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-danger text-center py-12">{error.message}</div>
      ) : (
        <>
          {/* Hero: Platform Growth line chart */}
          <Card>
            <CardHeader>
              <h4 className="text-sm font-semibold text-card-foreground">Platform Growth</h4>
              <p className="text-xs text-muted-foreground">New users, games, and sessions booked per week</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="newUsers"
                    name="New Users"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="newGames"
                    name="New Games"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sessionsConfirmed"
                    name="Sessions Booked"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Secondary row: 3 smaller charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Active Users */}
            <Card>
              <CardHeader>
                <h4 className="text-sm font-semibold text-card-foreground">Active Users</h4>
                <p className="text-xs text-muted-foreground">Users who submitted availability</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="activeUsers"
                      name="Active Users"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Sessions per week */}
            <Card>
              <CardHeader>
                <h4 className="text-sm font-semibold text-card-foreground">Sessions Played</h4>
                <p className="text-xs text-muted-foreground">Sessions held per week, by play date</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="sessionsPlayed"
                      name="Sessions Played"
                      fill="#8b5cf6"
                      radius={[3, 3, 0, 0]}
                      fillOpacity={0.8}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Health Distribution */}
            <Card>
              <CardHeader>
                <h4 className="text-sm font-semibold text-card-foreground">Health Distribution</h4>
                <p className="text-xs text-muted-foreground">Games by health right now, dormant included</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={healthData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="short"
                      interval={0}
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {healthData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <PlatformHealthCharts timeRange={timeRange} />
        </>
      )}
    </div>
  );
}
