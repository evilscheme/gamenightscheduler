'use client';

import { useState } from 'react';
import Link from 'next/link';
import { parseISO } from 'date-fns';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { Button, Card, CardContent, CardHeader, EmptyState, LoadingSpinner } from '@/components/ui';
import { buildSessionTimeRange } from '@/lib/formatting';
import { getBrowserTimezone } from '@/lib/timezone';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminUpcomingSessionRow } from '@/types';
import { AdminTable, AdminTh } from './AdminTable';

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

export function UpcomingGamesTab() {
  const { use24h, timezone: profileTimezone } = useUserPreferences();
  // The route needs the viewer's zone to date the Today/Tomorrow badge; it runs
  // on a UTC server, so its own clock is not the admin's. Prefer the saved
  // preference, fall back to whatever the browser reports.
  const viewerTimezone = profileTimezone ?? getBrowserTimezone();
  const [page, setPage] = useState(1);
  const { data, isPending: loading, error } = useQuery({
    queryKey: queryKeys.adminUpcomingSessions(page, viewerTimezone),
    queryFn: async (): Promise<UpcomingSessionsResponse> => {
      const tzParam = viewerTimezone ? `&tz=${encodeURIComponent(viewerTimezone)}` : '';
      const url = `/api/admin/upcoming-sessions?page=${page}${tzParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <div className="text-danger text-center py-12">{error.message}</div>;
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
        <AdminTable>
          <thead>
            <tr className="border-b border-border">
              <AdminTh>Date</AdminTh>
              <AdminTh>Time</AdminTh>
              <AdminTh>Game</AdminTh>
              <AdminTh>GM</AdminTh>
              <AdminTh>Location</AdminTh>
            </tr>
          </thead>
          <tbody>
            {data.sessions.map((row) => {
              const timeRange = buildSessionTimeRange(
                row.session.date,
                row.session.start_time,
                row.session.end_time,
                row.gameTimezone,
                viewerTimezone,
                use24h
              );
              return (
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
                {/*
                  Rows are ordered by absolute instant across every game's
                  timezone, so a bare wall clock reads as mis-sorted (8:30am in
                  Tokyo really does precede 6pm the previous day in LA). The
                  abbreviation and the viewer conversion are what make the order
                  legible.
                */}
                <td className="py-3 px-2 text-muted-foreground">
                  {timeRange ? (
                    <>
                      <span className="whitespace-nowrap">
                        {timeRange.gameTime}
                        {timeRange.gameTzAbbrev && (
                          <span className="ml-1 text-xs">{timeRange.gameTzAbbrev}</span>
                        )}
                      </span>
                      {timeRange.viewerTime && (
                        <span className="block whitespace-nowrap text-xs text-muted-foreground/70">
                          {timeRange.viewerTime} {timeRange.viewerTzAbbrev} for you
                        </span>
                      )}
                    </>
                  ) : (
                    'TBD'
                  )}
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
              );
            })}
          </tbody>
        </AdminTable>

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
