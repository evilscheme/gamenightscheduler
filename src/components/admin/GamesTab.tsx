'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui';
import type { HealthBreakdown, HealthGrade } from '@/lib/schedule';
import type { GameWithEngagement } from '@/types/api';
import { AdminTable, AdminTh, AdminEmptyRow } from './AdminTable';

type SortField = 'health' | 'name' | 'created' | 'lastActivity';

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

export function GamesTab({ games }: { games: GameWithEngagement[] }) {
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
        <AdminTable>
          <thead>
            <tr className="border-b border-border">
              <SortableHeader field="health" label="Health" currentSort={sortBy} sortDesc={sortDesc} onSort={handleSortChange} align="center" />
              <SortableHeader field="name" label="Game" currentSort={sortBy} sortDesc={sortDesc} onSort={handleSortChange} />
              <AdminTh>GM</AdminTh>
              <AdminTh align="center">Players</AdminTh>
              <AdminTh align="center">Total Sessions</AdminTh>
              <AdminTh align="center">Upcoming Sessions</AdminTh>
              <AdminTh align="center">Fill Rate</AdminTh>
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
              <AdminEmptyRow colSpan={9} message={hideUnhealthy ? 'No healthy games found' : 'No games found'} />
            )}
          </tbody>
        </AdminTable>
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
