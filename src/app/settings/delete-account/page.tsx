'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, Input, LoadingSpinner } from '@/components/ui';
import Link from 'next/link';
import { getDeletePreview, deleteAccount } from '@/app/settings/actions';
import type { GameAction } from '@/app/settings/actions';

interface GameDecision {
  gameId: string;
  gameName: string;
  members: { id: string; name: string }[];
  action: 'delete' | 'transfer';
  transferToUserId: string | null;
  isSolo: boolean;
}

type Step = 'loading' | 'decisions' | 'confirmation' | 'executing' | 'error';

export default function DeleteAccountPage() {
  const { profile, isLoading, signOut, session } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('loading');
  const [games, setGames] = useState<GameDecision[]>([]);
  const [memberGameCount, setMemberGameCount] = useState(0);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Manual auth redirect — skip during/after deletion to avoid racing with signOut
  useEffect(() => {
    if (!isLoading && !session && step !== 'executing') {
      router.push('/login');
    }
  }, [isLoading, session, step, router]);

  const loadPreview = useCallback(async () => {
    setStep('loading');
    const result = await getDeletePreview();
    if (!result.success || !result.data) {
      setError(result.error || 'Failed to load account data.');
      setStep('error');
      return;
    }

    const { gmGames, memberGameCount: count } = result.data;
    setMemberGameCount(count);

    const decisions: GameDecision[] = gmGames.map((g) => ({
      gameId: g.gameId,
      gameName: g.gameName,
      members: g.members,
      action: 'delete' as const,
      transferToUserId: null,
      isSolo: g.members.length === 0,
    }));
    setGames(decisions);

    if (decisions.length === 0) {
      setStep('confirmation');
    } else {
      setStep('decisions');
    }
  }, []);

  // Load preview data once auth is ready — valid pattern for async data fetching on mount
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isLoading && session && profile) {
      loadPreview();
    }
  }, [isLoading, session, profile, loadPreview]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleGameActionChange = (gameId: string, value: string) => {
    setGames((prev) =>
      prev.map((g) => {
        if (g.gameId !== gameId) return g;
        if (value === 'delete') {
          return { ...g, action: 'delete' as const, transferToUserId: null };
        }
        return { ...g, action: 'transfer' as const, transferToUserId: value };
      })
    );
  };

  const canContinue = games.every(
    (g) => g.isSolo || g.action === 'delete' || (g.action === 'transfer' && g.transferToUserId)
  );

  const handleExecuteDelete = useCallback(async () => {
    setStep('executing');

    const gameActions: GameAction[] = games
      .filter((g) => !g.isSolo)
      .map((g) =>
        g.action === 'transfer'
          ? { gameId: g.gameId, action: 'transfer' as const, newGmId: g.transferToUserId! }
          : { gameId: g.gameId, action: 'delete' as const }
      );

    const result = await deleteAccount(gameActions);
    if (!result.success) {
      setError(result.error || 'Failed to delete account.');
      setStep('error');
      return;
    }

    // Navigate first, then sign out — avoids race with auth redirect
    router.push('/');
    await signOut();
  }, [games, signOut, router]);

  // Show spinner while auth is loading OR while we have a session but profile hasn't loaded yet
  if (isLoading || (session && !profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/settings"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to Settings
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-2 mt-4">Delete Account</h1>
      <p className="text-muted-foreground mb-8">
        This action is permanent and cannot be undone.
      </p>

      {step === 'loading' && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {step === 'decisions' && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Your Games</h2>
          <p className="text-muted-foreground mb-4">
            You are the GM of the following games. Choose what happens to each one.
          </p>

          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.gameId}
                className="border border-border rounded-lg p-4"
              >
                {game.isSolo ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{game.gameName}</span>
                    <span className="text-sm text-muted-foreground">(only you — will be deleted)</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="font-medium text-foreground">{game.gameName}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({game.members.length} {game.members.length === 1 ? 'member' : 'members'})
                      </span>
                    </div>
                    <select
                      value={game.action === 'transfer' ? game.transferToUserId || '' : 'delete'}
                      onChange={(e) => handleGameActionChange(game.gameId, e.target.value)}
                      className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="delete">Delete this game</option>
                      {game.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          Transfer to {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {memberGameCount > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              You will also be removed from {memberGameCount} other game(s).
            </p>
          )}

          <div className="flex justify-end mt-6">
            <Button
              onClick={() => setStep('confirmation')}
              disabled={!canContinue}
              variant="danger"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'confirmation' && (
        <div>
          <Card>
            <CardContent className="space-y-4 py-4">
              {games.filter((g) => g.action === 'delete').length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Games that will be deleted:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {games
                      .filter((g) => g.action === 'delete')
                      .map((g) => (
                        <li key={g.gameId}>{g.gameName}</li>
                      ))}
                  </ul>
                </div>
              )}

              {games.filter((g) => g.action === 'transfer').length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Games that will be transferred:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {games
                      .filter((g) => g.action === 'transfer')
                      .map((g) => {
                        const newGm = g.members.find((m) => m.id === g.transferToUserId);
                        return (
                          <li key={g.gameId}>
                            {g.gameName} &rarr; {newGm?.name}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}

              {memberGameCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  You will be removed from {memberGameCount} other game(s).
                </p>
              )}

              <p className="text-sm text-destructive font-medium">
                All your availability data, sessions, and profile will be permanently deleted.
              </p>
            </CardContent>
          </Card>

          <div className="mt-6">
            <p className="text-sm text-foreground mb-2">
              Type your email to confirm: <strong>{profile?.email}</strong>
            </p>
            <Input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <div className="flex justify-between mt-6">
            <Button
              variant="secondary"
              onClick={() => {
                if (games.length > 0) {
                  setStep('decisions');
                } else {
                  loadPreview();
                }
              }}
            >
              Back
            </Button>
            <Button
              variant="danger"
              disabled={
                !profile?.email ||
                confirmEmail.toLowerCase() !== profile.email.toLowerCase()
              }
              onClick={handleExecuteDelete}
            >
              Delete My Account
            </Button>
          </div>
        </div>
      )}

      {step === 'executing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Deleting your account...</p>
        </div>
      )}

      {step === 'error' && (
        <div>
          <Card>
            <CardContent className="py-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>

          <div className="flex gap-3 mt-6">
            <Button variant="danger" onClick={handleExecuteDelete}>
              Try Again
            </Button>
            <Link href="/settings">
              <Button variant="secondary">Back to Settings</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
