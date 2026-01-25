'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Card, CardContent, CardHeader, LoadingSpinner } from '@/components/ui';

type Tab = 'overview' | 'games' | 'activity';

interface AdminStats {
  totalUsers: number;
  totalGames: number;
  totalSessions: number;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    is_gm: boolean;
    is_admin: boolean;
    created_at: string;
  }>;
  recentGames: Array<{
    id: string;
    name: string;
    created_at: string;
    gm: { name: string } | null;
  }>;
}

interface GameWithEngagement {
  id: string;
  name: string;
  created_at: string;
  gm: { id: string; name: string; email: string } | null;
  playerCount: number;
  sessionCount: number;
  confirmedSessionCount: number;
  availabilityFillRate: number;
  lastActivity: string | null;
}

export default function AdminPage() {
  const { session, profile, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [games, setGames] = useState<GameWithEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useAuthRedirect({ requireAdmin: true });

  useEffect(() => {
    async function fetchData() {
      if (!profile?.is_admin) return;

      setLoading(true);
      setError(null);

      try {
        const [statsRes, gamesRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/games'),
        ]);

        if (!statsRes.ok || !gamesRes.ok) {
          throw new Error('Failed to fetch admin data');
        }

        const statsData = await statsRes.json();
        const gamesData = await gamesRes.json();

        setStats(statsData);
        setGames(gamesData.games);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [profile?.is_admin]);

  // Show spinner while auth is loading or while we have a session but profile hasn't loaded yet
  if (authLoading || (session && !profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // If user isn't admin, the redirect will handle it
  if (!profile?.is_admin) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'games', label: 'Games' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
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
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-danger text-center py-12">{error}</div>
      ) : (
        <>
          {activeTab === 'overview' && stats && <OverviewTab stats={stats} />}
          {activeTab === 'games' && <GamesTab games={games} />}
          {activeTab === 'activity' && stats && <ActivityTab stats={stats} />}
        </>
      )}
    </div>
  );
}

function OverviewTab({ stats }: { stats: AdminStats }) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} />
        <StatCard title="Total Games" value={stats.totalGames} />
        <StatCard title="Confirmed Sessions" value={stats.totalSessions} />
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function GamesTab({ games }: { games: GameWithEngagement[] }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-card-foreground">All Games ({games.length})</h2>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Game</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">GM</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Players</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Confirmed Sessions</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Fill Rate</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Last Activity</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-2 font-medium text-foreground">{game.name}</td>
                  <td className="py-3 px-2 text-muted-foreground">{game.gm?.name ?? 'Unknown'}</td>
                  <td className="py-3 px-2 text-center text-foreground">{game.playerCount}</td>
                  <td className="py-3 px-2 text-center text-foreground">
                    {game.sessionCount}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        game.availabilityFillRate >= 75
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : game.availabilityFillRate >= 50
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {game.availabilityFillRate}%
                    </span>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{formatDate(game.lastActivity)}</td>
                  <td className="py-3 px-2 text-muted-foreground">{formatDate(game.created_at)}</td>
                </tr>
              ))}
              {games.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No games found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityTab({ stats }: { stats: AdminStats }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Users */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-card-foreground">Recent Users</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external avatar URL from OAuth provider
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                      {user.name[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">
                      {user.name}
                      {user.is_admin && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                      {user.is_gm && (
                        <span className="ml-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded">
                          GM
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{formatDate(user.created_at)}</p>
              </div>
            ))}
            {stats.recentUsers.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No users found</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Games */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-card-foreground">Recent Games</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentGames.map((game) => (
              <div
                key={game.id}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="font-medium text-foreground">{game.name}</p>
                  <p className="text-sm text-muted-foreground">GM: {game.gm?.name ?? 'Unknown'}</p>
                </div>
                <p className="text-sm text-muted-foreground">{formatDate(game.created_at)}</p>
              </div>
            ))}
            {stats.recentGames.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No games found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
