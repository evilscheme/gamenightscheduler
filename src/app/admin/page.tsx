'use client';

import { useState, type ReactNode } from 'react';
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
import { ADMIN_QUERY_OPTIONS } from '@/lib/constants';
import type { AdminGamesResponse, AdminStats } from '@/types/api';
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

  const isAdmin = !!profile?.is_admin;

  // Overview and Activity share stats, Overview and Games share the games list;
  // both load up front since Overview is the landing tab.
  const statsQuery = useQuery({
    ...ADMIN_QUERY_OPTIONS,
    queryKey: queryKeys.adminStats(),
    queryFn: () => fetchAdmin<AdminStats>('/api/admin/stats'),
    enabled: isAdmin,
  });

  const gamesQuery = useQuery({
    ...ADMIN_QUERY_OPTIONS,
    queryKey: queryKeys.adminGames(),
    queryFn: () => fetchAdmin<AdminGamesResponse>('/api/admin/games'),
    enabled: isAdmin,
  });

  // Only once its tab is opened; the cache keeps it after that.
  const topUsersQuery = useQuery({
    ...ADMIN_QUERY_OPTIONS,
    queryKey: queryKeys.adminTopUsers(),
    queryFn: () => fetchAdmin<TopUsersResult>('/api/admin/top-users'),
    enabled: isAdmin && activeTab === 'topUsers',
  });

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

      {/* Each tab waits only for the queries it reads. */}
      {activeTab === 'overview' && (
        <TabQueries queries={[statsQuery, gamesQuery]}>
          {() => (
            <OverviewTab stats={statsQuery.data!} games={gamesQuery.data!.games} health={gamesQuery.data!.health} />
          )}
        </TabQueries>
      )}
      {activeTab === 'games' && (
        <TabQueries queries={[gamesQuery]}>{() => <GamesTab games={gamesQuery.data!.games} />}</TabQueries>
      )}
      {activeTab === 'topUsers' && (
        <TabQueries queries={[topUsersQuery]}>{() => <TopUsersTab topUsers={topUsersQuery.data!} />}</TabQueries>
      )}
      {activeTab === 'activity' && (
        <TabQueries queries={[statsQuery]}>{() => <ActivityTab stats={statsQuery.data!} />}</TabQueries>
      )}
      {activeTab === 'upcomingGames' && <UpcomingGamesTab />}
    </div>
  );
}

async function fetchAdmin<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch admin data');
  return res.json();
}

/** A spinner until every query has data, or the first error. Children render
 *  only once all of them have data, so they can read it unguarded. */
function TabQueries({
  queries,
  children,
}: {
  queries: { isPending: boolean; error: Error | null }[];
  children: () => ReactNode;
}) {
  const error = queries.find((q) => q.error)?.error;
  if (error) return <div className="text-danger text-center py-12">{error.message}</div>;
  if (queries.some((q) => q.isPending)) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  return <>{children()}</>;
}
