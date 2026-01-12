'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Game, User } from '@/types';

interface GameWithGM extends Game {
  gm: User;
  member_count: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [games, setGames] = useState<GameWithGM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchGames() {
      if (!session?.user?.id) return;

      // Fetch games where user is GM or member
      const { data: memberships } = await supabase
        .from('game_memberships')
        .select('game_id')
        .eq('user_id', session.user.id);

      const memberGameIds = memberships?.map((m) => m.game_id) || [];

      const { data: gmGames } = await supabase
        .from('games')
        .select('*, gm:users!games_gm_id_fkey(*)')
        .eq('gm_id', session.user.id);

      const { data: memberGames } = await supabase
        .from('games')
        .select('*, gm:users!games_gm_id_fkey(*)')
        .in('id', memberGameIds.length > 0 ? memberGameIds : ['none']);

      // Combine and dedupe
      const allGames = [...(gmGames || []), ...(memberGames || [])];
      const uniqueGames = Array.from(new Map(allGames.map((g) => [g.id, g])).values());

      // Get member counts
      const gamesWithCounts = await Promise.all(
        uniqueGames.map(async (game) => {
          const { count } = await supabase
            .from('game_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id);

          return { ...game, member_count: (count || 0) + 1 }; // +1 for GM
        })
      );

      setGames(gamesWithCounts as GameWithGM[]);
      setLoading(false);
    }

    if (session?.user?.id) {
      fetchGames();
    }
  }, [session?.user?.id]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Games</h1>
          <p className="text-muted-foreground mt-1">Manage your campaigns and game sessions</p>
        </div>
        {session?.user?.isGm && (
          <Link href="/games/new">
            <Button>Create New Game</Button>
          </Link>
        )}
      </div>

      {games.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="text-5xl mb-4 block">🎲</span>
            <h2 className="text-xl font-semibold text-card-foreground mb-2">No games yet</h2>
            <p className="text-muted-foreground mb-6">
              {session?.user?.isGm
                ? "Create your first game to start scheduling sessions with your group."
                : "Join a game using an invite link from your GM, or request GM status in settings to create your own."}
            </p>
            {session?.user?.isGm ? (
              <Link href="/games/new">
                <Button>Create Your First Game</Button>
              </Link>
            ) : (
              <Link href="/settings">
                <Button variant="secondary">Go to Settings</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link key={game.id} href={`/games/${game.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="py-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-card-foreground">{game.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        GM: {game.gm.name}
                        {game.gm_id === session?.user?.id && ' (You)'}
                      </p>
                    </div>
                    {game.gm_id === session?.user?.id && (
                      <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded">
                        GM
                      </span>
                    )}
                  </div>

                  {game.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{game.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span>👥</span>
                      {game.member_count} player{game.member_count !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <span>📅</span>
                      {game.play_days.map((d) => DAYS[d]).join(', ')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!session?.user?.isGm && (
        <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-amber-700 dark:text-amber-400 text-sm">
            <strong>Want to create your own games?</strong> Go to{' '}
            <Link href="/settings" className="underline">
              Settings
            </Link>{' '}
            to enable GM mode.
          </p>
        </div>
      )}
    </div>
  );
}
