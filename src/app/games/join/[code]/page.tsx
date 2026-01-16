'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, CardContent, LoadingSpinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { DAY_LABELS } from '@/lib/constants';

interface GamePreview {
  id: string;
  name: string;
  description: string | null;
  play_days: number[];
  gm: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export default function JoinGamePage() {
  const { profile, isLoading, session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const supabase = createClient();

  const [game, setGame] = useState<GamePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    // Only redirect if auth is done loading AND there's no session
    if (!isLoading && !session) {
      router.push(`/login?callbackUrl=/games/join/${code}`);
    }
  }, [isLoading, session, router, code]);

  useEffect(() => {
    async function fetchGame() {
      if (!code || !profile?.id) return;

      // Use API route to fetch game by invite code (bypasses RLS)
      const response = await fetch(`/api/games/invite/${code}`);

      if (!response.ok) {
        setError('Game not found. Please check the invite link.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setGame(data.game);
      setAlreadyMember(data.isMember);
      setLoading(false);
    }

    if (profile?.id) {
      fetchGame();
    }
  }, [code, profile?.id]);

  const handleJoin = async () => {
    if (!game || !profile?.id) return;

    setJoining(true);

    const { error: joinError } = await supabase.from('game_memberships').insert({
      game_id: game.id,
      user_id: profile.id,
    });

    if (joinError) {
      setError('Failed to join game. Please try again.');
      setJoining(false);
      return;
    }

    router.push(`/games/${game.id}`);
  };

  // Show spinner while auth is loading OR while we have a session but profile hasn't loaded yet
  if (isLoading || loading || (session && !profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="text-5xl mb-4 block">😕</span>
            <h2 className="text-xl font-semibold text-card-foreground mb-2">Invite Not Found</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      ) : game ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center mb-6">
              <span className="text-5xl mb-4 block">🎲</span>
              <h1 className="text-2xl font-bold text-card-foreground">
                {alreadyMember ? "You're already in this game!" : "You've been invited!"}
              </h1>
            </div>

            <div className="bg-secondary rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-card-foreground mb-1">{game.name}</h2>
              <p className="text-sm text-muted-foreground mb-2">Game Master: {game.gm.name}</p>
              {game.description && <p className="text-sm text-muted-foreground mb-2">{game.description}</p>}
              <p className="text-sm text-muted-foreground">
                Plays on: {game.play_days.map((d) => DAY_LABELS.short[d]).join(', ')}
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
