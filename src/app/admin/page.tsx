'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { LoadingSpinner, PageLoading } from '@/components/ui';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { GamesTab } from '@/components/admin/GamesTab';
import { TopUsersTab } from '@/components/admin/TopUsersTab';
import { ActivityTab } from '@/components/admin/ActivityTab';
import { UpcomingGamesTab } from '@/components/admin/UpcomingGamesTab';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminStats, GameWithEngagement } from '@/types/api';
import type { TopUsersResult } from '@/lib/admin';

type Tab = 'overview' | 'games' | 'topUsers' | 'activity' | 'upcomingGames';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'games', label: 'Games' },
  { id: 'topUsers', label: 'Top Users' },
  { id: 'activity', label: 'Activity' },
  { id: 'upcomingGames', label: 'Upcoming Games' },
];

export default function AdminPage() {
  const { authStatus, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useAuthRedirect({ requireAdmin: true });

  const statsQuery = useQuery({
    queryKey: queryKeys.adminStats(),
    queryFn: async (): Promise<AdminStats> => {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch admin data');
      return res.json();
    },
    enabled: !!profile?.is_admin,
  });

  const gamesQuery = useQuery({
    queryKey: queryKeys.adminGames(),
    queryFn: async (): Promise<GameWithEngagement[]> => {
      const res = await fetch('/api/admin/games');
      if (!res.ok) throw new Error('Failed to fetch admin data');
      const data = await res.json();
      return data.games;
    },
    enabled: !!profile?.is_admin,
  });

  const topUsersQuery = useQuery({
    queryKey: queryKeys.adminTopUsers(),
    queryFn: async (): Promise<TopUsersResult> => {
      const res = await fetch('/api/admin/top-users');
      if (!res.ok) throw new Error('Failed to fetch admin data');
      return res.json();
    },
    enabled: !!profile?.is_admin,
  });

  const stats = statsQuery.data ?? null;
  const games = gamesQuery.data ?? [];
  const topUsers = topUsersQuery.data ?? null;
  const loading = statsQuery.isPending || gamesQuery.isPending || topUsersQuery.isPending;
  const error =
    statsQuery.error?.message ?? gamesQuery.error?.message ?? topUsersQuery.error?.message ?? null;

  if (authStatus === 'loading') {
    return (
      <PageLoading />
    );
  }

  // If user isn't admin, the redirect will handle it
  if (!profile?.is_admin) {
    return (
      <PageLoading />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-danger text-center py-12">{error}</div>
      ) : (
        <>
          {activeTab === 'overview' && stats && <OverviewTab stats={stats} games={games} />}
          {activeTab === 'games' && <GamesTab games={games} />}
          {activeTab === 'topUsers' && topUsers && <TopUsersTab topUsers={topUsers} />}
          {activeTab === 'activity' && stats && <ActivityTab stats={stats} />}
          {activeTab === 'upcomingGames' && <UpcomingGamesTab />}
        </>
      )}
    </div>
  );
}
