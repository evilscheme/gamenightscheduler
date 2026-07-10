'use client';

import { Card, CardContent } from '@/components/ui';
import EngagementCharts from './EngagementCharts';
import type { AdminStats, GameWithEngagement } from '@/types/api';

export function OverviewTab({ stats, games }: { stats: AdminStats; games: GameWithEngagement[] }) {
  const healthyCount = games.filter((g) => g.healthScore >= 60).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} />
        <StatCard title="Total Games" value={stats.totalGames} />
        <StatCard title="Confirmed Sessions" value={stats.totalSessions} />
        <StatCard
          title="Healthy Games"
          value={healthyCount}
          subtitle={`${stats.totalGames > 0 ? Math.round((healthyCount / stats.totalGames) * 100) : 0}% of all games`}
        />
      </div>

      {/* Engagement Charts */}
      <EngagementCharts games={games} />
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: number; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
