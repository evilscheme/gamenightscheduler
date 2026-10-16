'use client';

import { Card, CardContent } from '@/components/ui';
import EngagementCharts from './EngagementCharts';
import type { AdminStats, GameWithEngagement, UserHealthCounts } from '@/types/api';

export function OverviewTab({ stats, games, userHealth }: {
  stats: AdminStats;
  games: GameWithEngagement[];
  userHealth: UserHealthCounts;
}) {
  // Same classification as the platform-health charts; dormant games are left out
  // of the share so abandoned ones don't drag it down forever.
  const healthyCount = games.filter((g) => g.healthState === 'healthy').length;
  const viableCount = games.filter((g) => g.healthyBy === 'viableDate').length;
  const dormantCount = games.filter((g) => g.healthState === 'dormant').length;
  const liveCount = games.length - dormantCount;
  // Users likewise: churned users (no live game, here 60+ days) are left out.
  const healthyUsers = userHealth.healthyBooked + userHealth.healthyViable;
  const activeUsers = healthyUsers + userHealth.gettingGoing + userHealth.unhealthy;
  const churnedUsers = userHealth.total - activeUsers;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} />
        <StatCard
          title="Healthy Users"
          value={healthyUsers}
          subtitle={`${activeUsers > 0 ? Math.round((healthyUsers / activeUsers) * 100) : 0}% of ${activeUsers} active users · ${churnedUsers} churned`}
          detail={`${userHealth.healthyBooked} booked · ${userHealth.healthyViable} date found`}
        />
        <StatCard title="Total Games" value={stats.totalGames} />
        <StatCard
          title="Healthy Games"
          value={healthyCount}
          subtitle={`${liveCount > 0 ? Math.round((healthyCount / liveCount) * 100) : 0}% of ${liveCount} live games · ${dormantCount} dormant`}
          detail={`${healthyCount - viableCount} booked · ${viableCount} date found`}
        />
        <StatCard title="Confirmed Sessions" value={stats.totalSessions} />
      </div>

      {/* Engagement Charts */}
      <EngagementCharts games={games} />
    </div>
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
