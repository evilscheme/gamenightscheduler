'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { LoadingSpinner, PageLoading } from '@/components/ui';
import { OverviewTab } from '@/components/admin/OverviewTab';
import { GamesTab } from '@/components/admin/GamesTab';
import { TopUsersTab } from '@/components/admin/TopUsersTab';
import { ActivityTab } from '@/components/admin/ActivityTab';
import { UpcomingGamesTab } from '@/components/admin/UpcomingGamesTab';
import type { AdminStats, GameWithEngagement } from '@/types/api';
import type { TopUsersResult } from '@/lib/topUsers';

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
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [games, setGames] = useState<GameWithEngagement[]>([]);
  const [topUsers, setTopUsers] = useState<TopUsersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useAuthRedirect({ requireAdmin: true });

  useEffect(() => {
    async function fetchData() {
      if (!profile?.is_admin) return;

      setLoading(true);
      setError(null);

      try {
        const [statsRes, gamesRes, topUsersRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/games'),
          fetch('/api/admin/top-users'),
        ]);

        if (!statsRes.ok || !gamesRes.ok || !topUsersRes.ok) {
          throw new Error('Failed to fetch admin data');
        }

        const statsData = await statsRes.json();
        const gamesData = await gamesRes.json();
        const topUsersData = await topUsersRes.json();

        setStats(statsData);
        setGames(gamesData.games);
        setTopUsers(topUsersData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [profile?.is_admin]);

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
