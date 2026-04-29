"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Calendar } from "lucide-react";
import { Button, LoadingSpinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { GameWithGM } from "@/types";
import { DAY_LABELS } from "@/lib/constants";
import { fetchUserMemberships, fetchUserGmGames, fetchMembershipCount } from "@/lib/data";
import { WelcomeEmptyState } from "./WelcomeEmptyState";

interface GameWithGMAndCount extends GameWithGM {
  member_count: number;
  is_co_gm: boolean;
}

export function DashboardContent() {
  const { profile, authStatus } = useAuth();
  const [games, setGames] = useState<GameWithGMAndCount[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchGames() {
      if (!profile?.id) {
        // No profile, nothing to fetch
        setLoading(false);
        return;
      }

      // Fetch games where user is GM or member, including co-GM status
      const { data: memberships } = await fetchUserMemberships(supabase, profile.id);

      const memberGameIds = memberships?.map((m) => m.game_id) || [];
      const coGmGameIds = new Set(
        memberships?.filter((m) => m.is_co_gm).map((m) => m.game_id) || []
      );

      const { data: gmGames } = await fetchUserGmGames(supabase, profile.id);

      // Only query for member games if user has memberships
      const memberGames =
        memberGameIds.length > 0
          ? (
              await supabase
                .from("games")
                .select("*, gm:users!games_gm_id_fkey(*)")
                .in("id", memberGameIds)
            ).data
          : [];

      // Combine and dedupe
      const allGames = [...(gmGames || []), ...(memberGames || [])];
      const uniqueGames = Array.from(
        new Map(allGames.map((g) => [g.id, g])).values()
      );

      // Get member counts and add co-GM status
      const gamesWithCounts = await Promise.all(
        uniqueGames.map(async (game) => {
          const { count } = await fetchMembershipCount(supabase, game.id);

          return {
            ...game,
            member_count: (count || 0) + 1, // +1 for GM
            is_co_gm: coGmGameIds.has(game.id),
          };
        })
      );

      setGames(gamesWithCounts as GameWithGMAndCount[]);
      setLoading(false);
    }

    if (profile?.id) {
      fetchGames();
    } else if (authStatus !== 'loading') {
      // Auth finished but no profile - stop loading
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [profile?.id, authStatus]);

  if (authStatus === 'loading' || loading) {
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
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => {
            const isOwner = game.gm_id === profile?.id;
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
      )}
    </div>
  );
}
