'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, CardContent } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Game, User } from '@/types';

interface GameWithGM extends Game {
  gm: User;
}

export default function JoinGamePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [game, setGame] = useState<GameWithGM | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/games/join/${code}`);
    }
  }, [status, router, code]);

  useEffect(() => {
    async function fetchGame() {
      if (!code || !session?.user?.id) return;

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*, gm:users!games_gm_id_fkey(*)')
        .eq('invite_code', code)
        .single();

      if (gameError || !gameData) {
        setError('Game not found. Please check the invite link.');
        setLoading(false);
        return;
      }

      setGame(gameData as GameWithGM);

      // Check if already a member or GM
      if (gameData.gm_id === session.user.id) {
        setAlreadyMember(true);
      } else {
        const { data: membership } = await supabase
          .from('game_memberships')
          .select('id')
          .eq('game_id', gameData.id)
          .eq('user_id', session.user.id)
          .single();

        if (membership) {
          setAlreadyMember(true);
        }
      }

      setLoading(false);
    }

    if (session?.user?.id) {
      fetchGame();
    }
  }, [code, session?.user?.id]);

  const handleJoin = async () => {
    if (!game || !session?.user?.id) return;

    setJoining(true);

    const { error: joinError } = await supabase.from('game_memberships').insert({
      game_id: game.id,
      user_id: session.user.id,
    });

    if (joinError) {
      setError('Failed to join game. Please try again.');
      setJoining(false);
      return;
    }

    router.push(`/games/${game.id}`);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="text-5xl mb-4 block">😕</span>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invite Not Found</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      ) : game ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center mb-6">
              <span className="text-5xl mb-4 block">🎲</span>
              <h1 className="text-2xl font-bold text-gray-900">
                {alreadyMember ? "You're already in this game!" : "You've been invited!"}
              </h1>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{game.name}</h2>
              <p className="text-sm text-gray-500 mb-2">Game Master: {game.gm.name}</p>
              {game.description && <p className="text-sm text-gray-600 mb-2">{game.description}</p>}
              <p className="text-sm text-gray-500">
                Plays on: {game.play_days.map((d) => DAYS[d]).join(', ')}
              </p>
            </div>

            {alreadyMember ? (
              <Button onClick={() => router.push(`/games/${game.id}`)} className="w-full">
                Go to Game
              </Button>
            ) : (
              <div className="space-y-3">
                <Button onClick={handleJoin} disabled={joining} className="w-full">
                  {joining ? 'Joining...' : 'Join Game'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push('/dashboard')}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
