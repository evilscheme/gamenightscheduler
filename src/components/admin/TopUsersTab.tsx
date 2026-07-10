'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Eye } from 'lucide-react';
import { Avatar, Card, CardContent, CardHeader } from '@/components/ui';
import type { TopUsersResult, TopGmEntry, TopPlayerEntry } from '@/lib/admin';
import { AdminTable, AdminTh, AdminEmptyRow } from './AdminTable';

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

export function TopUsersTab({ topUsers }: { topUsers: TopUsersResult }) {
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
          <AdminTable data-testid="top-gms-table">
            <thead>
              <tr className="border-b border-border">
                <AdminTh>#</AdminTh>
                <AdminTh>GM</AdminTh>
                <AdminTh align="center">Games</AdminTh>
                <AdminTh align="center">Sessions</AdminTh>
                <AdminTh align="center">Upcoming</AdminTh>
                <AdminTh align="center">Players</AdminTh>
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
                <AdminEmptyRow colSpan={6} message="No GMs with games yet" />
              )}
            </tbody>
          </AdminTable>
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
          <AdminTable data-testid="top-players-table">
            <thead>
              <tr className="border-b border-border">
                <AdminTh>#</AdminTh>
                <AdminTh>Player</AdminTh>
                <AdminTh align="center">Games</AdminTh>
                <AdminTh align="center">Sessions</AdminTh>
                <AdminTh align="center">Dates Marked</AdminTh>
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
                <AdminEmptyRow colSpan={5} message="No players have joined games yet" />
              )}
            </tbody>
          </AdminTable>
        </CardContent>
      </Card>
    </div>
  );
}
