'use client';

import { Avatar, Card, CardContent, CardHeader } from '@/components/ui';
import type { AdminStats } from '@/types/api';

export function ActivityTab({ stats }: { stats: AdminStats }) {
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
