'use client';

import { Card, CardContent } from '@/components/ui';
import { healthyShare, liveCount, type PlatformCounts, type StateCounts } from '@/lib/admin';
import EngagementCharts from './EngagementCharts';
import type { AdminStats, GameWithEngagement } from '@/types/api';

export function OverviewTab({ stats, games, health }: {
  stats: AdminStats;
  games: GameWithEngagement[];
  health: PlatformCounts;
}) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} />
        <HealthCard title="Healthy Users" counts={health.users} live="active users" gone="churned" />
        <StatCard title="Total Games" value={stats.totalGames} />
        <HealthCard title="Healthy Games" counts={health.games} live="live games" gone="dormant" />
        <StatCard title="Confirmed Sessions" value={stats.totalSessions} />
      </div>

      {/* Engagement Charts */}
      <EngagementCharts games={games} />
    </div>
  );
}

/** Healthy count, as a share of what's still in play — so abandoned users and
 *  games (`gone`) don't drag the share down forever. */
function HealthCard({ title, counts, live, gone }: { title: string; counts: StateCounts; live: string; gone: string }) {
  const liveTotal = liveCount(counts);
  return (
    <StatCard
      title={title}
      value={counts.healthyBooked + counts.healthyViable}
      subtitle={`${healthyShare(counts) ?? 0}% of ${liveTotal} ${live} · ${counts.total - liveTotal} ${gone}`}
      detail={`${counts.healthyBooked} booked · ${counts.healthyViable} date found`}
    />
  );
}

function StatCard({ title, value, subtitle, detail }: {
  title: string;
  value: number;
  subtitle?: string;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}
