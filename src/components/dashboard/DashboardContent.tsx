"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  LoadingSpinner,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { GameWithGM } from "@/types";
import { DAY_LABELS } from "@/lib/constants";
import { WelcomeEmptyState } from "./WelcomeEmptyState";

interface GameWithGMAndCount extends GameWithGM {
  member_count: number;
  is_co_gm: boolean;
}

export function DashboardContent() {
  const { profile, isLoading, session } = useAuth();
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
      const { data: memberships } = await supabase
        .from("game_memberships")
        .select("game_id, is_co_gm")
        .eq("user_id", profile.id);

      const memberGameIds = memberships?.map((m) => m.game_id) || [];
      const coGmGameIds = new Set(
        memberships?.filter((m) => m.is_co_gm).map((m) => m.game_id) || []
      );

      const { data: gmGames } = await supabase
        .from("games")
        .select("*, gm:users!games_gm_id_fkey(*)")
        .eq("gm_id", profile.id);

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
          const { count } = await supabase
            .from("game_memberships")
            .select("*", { count: "exact", head: true })
            .eq("game_id", game.id);

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
    } else if (!isLoading) {
      // Auth finished but no profile - stop loading
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [profile?.id, isLoading]);

  // Show spinner while auth is loading, data is loading, or profile hasn't loaded yet
  if (isLoading || loading || (session && !profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Games</h1>
          <p className="text-muted-foreground mt-1">
            Manage your games and sessions
          </p>
        </div>
        {profile?.is_gm && games.length > 0 && (
          <Link href="/games/new">
            <Button>Create New Game</Button>
          </Link>
        )}
      </div>

      {games.length === 0 ? (
        <WelcomeEmptyState />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link key={game.id} href={`/games/${game.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="py-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-card-foreground">
                        {game.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        GM: {game.gm.name}
                        {game.gm_id === profile?.id && " (You)"}
                      </p>
                    </div>
                    {game.gm_id === profile?.id && (
                      <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded">
                        GM
                      </span>
                    )}
                    {game.is_co_gm && (
                      <span className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded">
                        Co-GM
                      </span>
                    )}
                  </div>

                  {game.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {game.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span>👥</span>
                      {game.member_count} player
                      {game.member_count !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <span>📅</span>
                      {game.play_days
                        .map((d) => DAY_LABELS.short[d])
                        .join(", ")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
