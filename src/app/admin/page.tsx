'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { parseISO } from 'date-fns';
import { ChevronRight, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { Avatar, Button, Card, CardContent, CardHeader, EmptyState, LoadingSpinner, PageLoading } from '@/components/ui';
import EngagementCharts from '@/components/admin/EngagementCharts';
import { formatTimeShort } from '@/lib/formatting';
import type { HealthBreakdown, HealthGrade } from '@/lib/gameHealth';
import type { TopUsersResult, TopGmEntry, TopPlayerEntry } from '@/lib/topUsers';
import type { AdminUpcomingSessionRow } from '@/types';

type Tab = 'overview' | 'games' | 'topUsers' | 'activity' | 'upcomingGames';

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

import type { GameWithEngagement } from '@/types/api';

type SortField = 'health' | 'name' | 'created' | 'lastActivity';

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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'games', label: 'Games' },
    { id: 'topUsers', label: 'Top Users' },
    { id: 'activity', label: 'Activity' },
    { id: 'upcomingGames', label: 'Upcoming Games' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
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

function OverviewTab({ stats, games }: { stats: AdminStats; games: GameWithEngagement[] }) {
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

const HEALTH_GRADE_STYLES: Record<HealthGrade, string> = {
  A: 'bg-success/10 text-success',
  B: 'bg-primary/10 text-primary',
  C: 'bg-warning/10 text-warning',
  D: 'bg-danger/10 text-danger',
  F: 'bg-danger/20 text-danger font-semibold',
};

function formatBreakdownTooltip(b: HealthBreakdown): string {
  return `Players: ${b.playerScore} | Sessions: ${b.sessionScore} | Fill Rate: ${b.fillRateScore} | Recency: ${b.recencyScore}`;
}

function GamesTab({ games }: { games: GameWithEngagement[] }) {
  const [sortBy, setSortBy] = useState<SortField>('health');
  const [sortDesc, setSortDesc] = useState(true);
  const [hideUnhealthy, setHideUnhealthy] = useState(false);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  const sortedGames = useMemo(() => {
    const filtered = hideUnhealthy ? games.filter((g) => g.healthScore >= 30) : games;

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'health':
          cmp = a.healthScore - b.healthScore;
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'created':
          cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '');
          break;
        case 'lastActivity':
          cmp = (a.lastActivity ?? '').localeCompare(b.lastActivity ?? '');
          break;
      }
      return sortDesc ? -cmp : cmp;
    });

    return sorted;
  }, [games, sortBy, sortDesc, hideUnhealthy]);

  const healthyCount = games.filter((g) => g.healthScore >= 60).length;

  const handleSortChange = (field: SortField) => {
    if (sortBy === field) {
      setSortDesc((prev) => !prev);
    } else {
      setSortBy(field);
      setSortDesc(field === 'health' || field === 'lastActivity');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-card-foreground">
            Games
            <span className="text-sm font-normal text-muted-foreground ml-2">
              Showing {sortedGames.length} of {games.length} ({healthyCount} healthy)
            </span>
          </h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideUnhealthy}
                onChange={(e) => setHideUnhealthy(e.target.checked)}
                className="rounded-sm border-border"
              />
              Hide unhealthy (score &lt; 30)
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <SortableHeader field="health" label="Health" currentSort={sortBy} sortDesc={sortDesc} onSort={handleSortChange} align="center" />
                <SortableHeader field="name" label="Game" currentSort={sortBy} sortDesc={sortDesc} onSort={handleSortChange} />
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">GM</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Players</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Total Sessions</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Upcoming Sessions</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Fill Rate</th>
                <SortableHeader field="lastActivity" label="Last Activity" currentSort={sortBy} sortDesc={sortDesc} onSort={handleSortChange} />
                <SortableHeader field="created" label="Created" currentSort={sortBy} sortDesc={sortDesc} onSort={handleSortChange} />
              </tr>
            </thead>
            <tbody>
              {sortedGames.map((game) => (
                <tr key={game.id} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-sm text-xs font-medium cursor-help ${HEALTH_GRADE_STYLES[game.healthGrade]}`}
                      title={`${game.healthLabel} (${game.healthScore}/100)\n${formatBreakdownTooltip(game.healthBreakdown)}`}
                    >
                      {game.healthGrade} {game.healthScore}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-medium text-foreground">
                    <Link
                      href={`/admin/games/${game.id}`}
                      className="hover:text-primary hover:underline"
                      title="Open read-only admin view"
                    >
                      {game.name}
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{game.gm?.name ?? 'Unknown'}</td>
                  <td className="py-3 px-2 text-center text-foreground">{game.playerCount}</td>
                  <td className="py-3 px-2 text-center text-foreground">{game.sessionCount}</td>
                  <td className="py-3 px-2 text-center text-foreground">{game.futureSessionCount}</td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium ${
                        game.availabilityFillRate >= 75
                          ? 'bg-success/10 text-success'
                          : game.availabilityFillRate >= 50
                          ? 'bg-warning/10 text-warning'
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {game.availabilityFillRate}%
                    </span>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{formatDate(game.lastActivity)}</td>
                  <td className="py-3 px-2 text-muted-foreground">{formatDate(game.created_at)}</td>
                </tr>
              ))}
              {sortedGames.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    {hideUnhealthy ? 'No healthy games found' : 'No games found'}
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

function SortableHeader({
  field,
  label,
  currentSort,
  sortDesc,
  onSort,
  align = 'left',
}: {
  field: SortField;
  label: string;
  currentSort: SortField;
  sortDesc: boolean;
  onSort: (field: SortField) => void;
  align?: 'left' | 'center';
}) {
  const isActive = currentSort === field;
  return (
    <th className={`${align === 'center' ? 'text-center' : 'text-left'} py-3 px-2 font-medium text-muted-foreground`}>
      <button
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
          isActive ? 'text-foreground' : ''
        }`}
      >
        {label}
        {isActive && (
          <span className="text-xs">{sortDesc ? '↓' : '↑'}</span>
        )}
      </button>
    </th>
  );
}

function UserCell({ user, expanded }: { user: TopGmEntry['user']; expanded: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ChevronRight
        className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
      />
      <Avatar userId={user.id} name={user.name} avatarUrl={user.avatar_url} size={30} />
      <div className="min-w-0">
        <p className="font-medium text-foreground truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
    </div>
  );
}

/** Expanded sub-row listing a user's games as links to the admin peek view. */
function UserGamesRow({ games, colSpan }: { games: TopGmEntry['games']; colSpan: number }) {
  return (
    <tr className="border-b border-border/50 bg-muted/30" data-testid="user-games-row">
      <td colSpan={colSpan} className="p-2">
        <div className="flex flex-wrap gap-2 pl-8">
          {games.map((g) => (
            <Link
              key={g.id}
              href={`/admin/games/${g.id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              title="Open read-only admin view"
            >
              <Eye className="size-3" />
              {g.name}
            </Link>
          ))}
          {games.length === 0 && (
            <span className="text-xs text-muted-foreground">No games</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function TopUsersTab({ topUsers }: { topUsers: TopUsersResult }) {
  const [expandedGm, setExpandedGm] = useState<string | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const toggle = (setter: typeof setExpandedGm) => (userId: string) =>
    setter((prev) => (prev === userId ? null : userId));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Top GMs */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-card-foreground">Top GMs</h2>
          <p className="text-sm text-muted-foreground">
            Ranked by sessions booked across owned games · click a row to see their games
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="top-gms-table">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">GM</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Games</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Sessions</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Upcoming</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Players</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.topGms.map((entry: TopGmEntry, i: number) => (
                  <Fragment key={entry.user.id}>
                    <tr
                      className="border-b border-border/50 hover:bg-muted/50 cursor-pointer select-none"
                      onClick={() => toggle(setExpandedGm)(entry.user.id)}
                      aria-expanded={expandedGm === entry.user.id}
                    >
                      <td className="py-3 px-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 px-2">
                        <UserCell user={entry.user} expanded={expandedGm === entry.user.id} />
                      </td>
                      <td className="py-3 px-2 text-center text-foreground">{entry.gamesOwned}</td>
                      <td className="py-3 px-2 text-center text-foreground">{entry.sessionsBooked}</td>
                      <td className="py-3 px-2 text-center text-foreground">{entry.upcomingSessions}</td>
                      <td className="py-3 px-2 text-center text-foreground">{entry.playersHosted}</td>
                    </tr>
                    {expandedGm === entry.user.id && (
                      <UserGamesRow games={entry.games} colSpan={6} />
                    )}
                  </Fragment>
                ))}
                {topUsers.topGms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No GMs with games yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Players */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-card-foreground">Top Players</h2>
          <p className="text-sm text-muted-foreground">
            Ranked by sessions scheduled in games they joined · click a row to see their games
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="top-players-table">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Player</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Games</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Sessions</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Dates Marked</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.topPlayers.map((entry: TopPlayerEntry, i: number) => (
                  <Fragment key={entry.user.id}>
                    <tr
                      className="border-b border-border/50 hover:bg-muted/50 cursor-pointer select-none"
                      onClick={() => toggle(setExpandedPlayer)(entry.user.id)}
                      aria-expanded={expandedPlayer === entry.user.id}
                    >
                      <td className="py-3 px-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 px-2">
                        <UserCell user={entry.user} expanded={expandedPlayer === entry.user.id} />
                      </td>
                      <td className="py-3 px-2 text-center text-foreground">{entry.gamesJoined}</td>
                      <td className="py-3 px-2 text-center text-foreground">{entry.sessionsScheduled}</td>
                      <td className="py-3 px-2 text-center text-foreground">{entry.datesMarked}</td>
                    </tr>
                    {expandedPlayer === entry.user.id && (
                      <UserGamesRow games={entry.games} colSpan={5} />
                    )}
                  </Fragment>
                ))}
                {topUsers.topPlayers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No players have joined games yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
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
                  <Avatar
                    userId={user.id}
                    name={user.name}
                    avatarUrl={user.avatar_url}
                    size={30}
                  />
                  <div>
                    <p className="font-medium text-foreground">
                      {user.name}
                      {user.is_admin && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm">
                          Admin
                        </span>
                      )}
                      {user.is_gm && (
                        <span className="ml-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-sm">
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

interface UpcomingSessionsResponse {
  sessions: AdminUpcomingSessionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatUpcomingSessionDate(dateStr: string): string {
  return parseISO(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function UpcomingGamesTab() {
  const { use24h } = useUserPreferences();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UpcomingSessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/upcoming-sessions?page=${page}`);
        if (!res.ok) throw new Error('Failed to fetch upcoming sessions');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <div className="text-danger text-center py-12">{error}</div>;
  }

  if (!data || data.total === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            title="No upcoming sessions"
            description="Confirmed sessions across all games will appear here once scheduled."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-card-foreground">
          Upcoming Games
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {data.total} upcoming session{data.total !== 1 ? 's' : ''}
          </span>
        </h2>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Time</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Game</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">GM</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Location</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((row) => (
                <tr key={row.session.id} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-2 text-foreground whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {formatUpcomingSessionDate(row.session.date)}
                      {row.dayHighlight && (
                        <span className="inline-block rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          {row.dayHighlight === 'today' ? 'Today' : 'Tomorrow'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                    {row.session.start_time
                      ? `${formatTimeShort(row.session.start_time, use24h)}${
                          row.session.end_time
                            ? `–${formatTimeShort(row.session.end_time, use24h)}`
                            : ''
                        }`
                      : 'TBD'}
                  </td>
                  <td className="py-3 px-2 font-medium text-foreground">
                    <Link
                      href={`/admin/games/${row.gameId}`}
                      className="hover:text-primary hover:underline"
                      title="Open read-only admin view"
                    >
                      {row.gameName}
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{row.gmName}</td>
                  <td className="py-3 px-2 text-muted-foreground">{row.session.location ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} &middot; {data.total} total session
            {data.total !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              aria-label="Previous page of upcoming sessions"
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={data.page >= data.totalPages}
              aria-label="Next page of upcoming sessions"
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
