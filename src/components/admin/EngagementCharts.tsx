'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, LoadingSpinner } from '@/components/ui';
import type { HealthGrade } from '@/lib/gameHealth';

// ── Types ──────────────────────────────────────────────────

interface WeekBucket {
  week: string;
  newUsers: number;
  newGames: number;
  sessionsConfirmed: number;
  activeUsers: number;
}

interface EngagementData {
  weeklyData: WeekBucket[];
}

interface EngagementChartsProps {
  games: Array<{ healthGrade: HealthGrade }>;
}

type TimeRange = '8' | '12' | '26' | 'all';

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '8', label: '8 weeks' },
  { value: '12', label: '12 weeks' },
  { value: '26', label: '6 months' },
  { value: 'all', label: 'All time' },
];

const HEALTH_GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

// ── Helpers ────────────────────────────────────────────────

function formatWeekLabel(weekStr: string): string {
  const date = new Date(weekStr + 'T00:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Custom tooltip that uses Tailwind classes for proper theme support */
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-sm px-3 py-2 text-xs shadow-lg">
      {label && <p className="text-muted-foreground mb-1">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="text-card-foreground">
          <span style={{ color: entry.color }}>&#9679;</span>{' '}
          {entry.name}: <span className="font-medium">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function EngagementCharts({ games }: EngagementChartsProps) {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('12');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/engagement?weeks=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch engagement data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = data?.weeklyData.map((w) => ({
    ...w,
    label: formatWeekLabel(w.week),
  })) ?? [];

  const healthData = useMemo(() => {
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const g of games) dist[g.healthGrade]++;
    return Object.entries(dist).map(([grade, count]) => ({
      grade,
      count,
      fill: HEALTH_GRADE_COLORS[grade],
    }));
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
        <div className="text-destructive text-center py-12">{error}</div>
      ) : (
        <>
          {/* Hero: Platform Growth line chart */}
          <Card>
            <CardHeader>
              <h4 className="text-sm font-semibold text-card-foreground">Platform Growth</h4>
              <p className="text-xs text-muted-foreground">New users, games, and sessions confirmed per week</p>
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
                    name="Sessions"
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
                <h4 className="text-sm font-semibold text-card-foreground">Sessions / Week</h4>
                <p className="text-xs text-muted-foreground">Confirmed game sessions</p>
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
                      dataKey="sessionsConfirmed"
                      name="Sessions"
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
                <p className="text-xs text-muted-foreground">Games by health grade</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={healthData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="grade"
                      tick={{ fontSize: 11 }}
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
                        <Cell key={entry.grade} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
