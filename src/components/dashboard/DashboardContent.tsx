"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Users, Calendar } from "lucide-react";
import { Button, LoadingSpinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { DAY_LABELS } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchDashboardData, type DashboardGame } from "@/lib/dashboardData";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { buildUpcomingSessionRows } from "@/lib/upcomingSessions";
import { WelcomeEmptyState } from "./WelcomeEmptyState";
import { UpcomingSessionsPanel } from "./UpcomingSessionsPanel";

export function DashboardContent() {
  const { user, profile, authStatus } = useAuth();
  const { use24h, timezone: userTimezone } = useUserPreferences();
  const supabase = createClient();
  const userId = user?.id ?? '';

  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.dashboard(userId),
    queryFn: () => fetchDashboardData(supabase, userId),
    enabled: !!userId,
  });

  // The dashboard result already contains every game's id and name, so seed
  // the my-games cache: the common dashboard -> game navigation then skips
  // fetchMyGamesLite's two round trips entirely.
  useEffect(() => {
    if (!data || !userId) return;
    queryClient.setQueryData(
      queryKeys.myGamesLite(userId),
      data.games.map((g) => ({ id: g.id, name: g.name }))
    );
  }, [data, userId, queryClient]);

  const games: DashboardGame[] = data?.games ?? [];

  // The clock comes from the queryFn (see DashboardData.fetchedAtMs) — reading
  // it here would be an impure render (react-hooks/purity). staleTime plus
  // refetch-on-focus keep the fetch-time clock close enough for day-granularity
  // highlighting.
  const sessionRows = useMemo(() => {
    if (!data) return [];
    const gameInfo = new Map<string, { name: string; timezone: string | null }>(
      data.games.map((g) => [g.id, { name: g.name, timezone: g.timezone }])
    );
    return buildUpcomingSessionRows(data.upcoming, gameInfo, data.fetchedToday, data.fetchedAtMs);
  }, [data]);

  if (authStatus === 'loading' || (!!userId && isPending)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Your Games</h1>
          {games.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{games.length}</span>{' '}
              {games.length === 1 ? 'game' : 'games'}
            </p>
          )}
        </div>
        {profile?.is_gm && games.length > 0 && (
          <Link href="/games/new" className="shrink-0">
            <Button>Create New Game</Button>
          </Link>
        )}
      </div>

      {games.length === 0 ? (
        <WelcomeEmptyState />
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="order-last lg:order-first lg:flex-1">
            <ul className="grid gap-5 md:grid-cols-2">
              {games.map((game) => {
            const isOwner = game.gm_id === userId;
            const cadence = game.ad_hoc_only
              ? 'Ad-hoc'
              : game.play_days.map((d) => DAY_LABELS.short[d]).join(', ');

            return (
              <li key={game.id} className="contents">
                <Link
                  href={`/games/${game.id}`}
                  className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:ring-2 hover:ring-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-card-foreground">
                        {game.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        GM: {game.gm.name}
                        {isOwner && " (You)"}
                      </p>
                    </div>
                    {isOwner && (
                      <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">
                        GM
                      </span>
                    )}
                    {game.is_co_gm && (
                      <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">
                        CO-GM
                      </span>
                    )}
                  </div>

                  {game.description && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                      {game.description}
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-3 pt-3 font-mono text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3" />
                      {game.member_count} player{game.member_count !== 1 ? 's' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="size-3" />
                      {cadence}
                    </span>
                  </div>
                </Link>
              </li>
                );
              })}
            </ul>
          </div>

          <div className="order-first lg:order-last lg:w-80 lg:shrink-0">
            <UpcomingSessionsPanel
              rows={sessionRows}
              use24h={use24h}
              userTimezone={userTimezone}
            />
          </div>
        </div>
      )}
    </div>
  );
}
