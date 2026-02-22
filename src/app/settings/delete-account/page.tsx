'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Button, Card, CardContent, CardHeader, LoadingSpinner } from '@/components/ui';

interface OwnedGameMember {
  id: string;
  name: string;
}

interface OwnedGame {
  id: string;
  name: string;
  members: OwnedGameMember[];
}

interface PlayerMembershipGame {
  id: string;
  name: string;
}

interface DeletePreview {
  ownedGames: OwnedGame[];
  playerMembershipCount: number;
  playerMembershipGames: PlayerMembershipGame[];
}

type GameDecision =
  | { action: 'delete' }
  | { action: 'transfer'; newGmId: string };

type Step = 'loading' | 'decisions' | 'confirm' | 'deleting' | 'error';

const CONFIRM_WORD = 'DELETE';

export default function DeleteAccountPage() {
  const { isLoading, session, signOut } = useAuth();
  useAuthRedirect();

  const [step, setStep] = useState<Step>('loading');
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, GameDecision>>({});
  const [confirmText, setConfirmText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Only fetch when the step requires it. Including `step` in deps ensures
    // this runs again after "Try again" resets step to 'loading', while the
    // guard prevents re-fetching once the user has advanced past 'loading'.
    if (step !== 'loading') return;
    if (isLoading || !session) return;

    let cancelled = false;

    async function loadPreview() {
      try {
        const res = await fetch('/api/account/delete-preview');
        if (cancelled) return;
        if (!res.ok) {
          setErrorMessage('Failed to load account data. Please try again.');
          setStep('error');
          return;
        }
        const data: DeletePreview = await res.json();
        if (cancelled) return;
        setPreview(data);

        // If there are no multi-member games, skip the decisions step
        const hasMultiMemberGames = data.ownedGames.some((g) => g.members.length > 0);
        setStep(hasMultiMemberGames ? 'decisions' : 'confirm');
      } catch {
        if (cancelled) return;
        setErrorMessage('Failed to load account data. Please try again.');
        setStep('error');
      }
    }

    loadPreview();
    return () => { cancelled = true; };
  }, [isLoading, session, step]);

  function setDecision(gameId: string, decision: GameDecision) {
    setDecisions((prev) => ({ ...prev, [gameId]: decision }));
  }

  function setTransferTarget(gameId: string, newGmId: string) {
    setDecisions((prev) => ({ ...prev, [gameId]: { action: 'transfer', newGmId } }));
  }

  const multiMemberGames = preview?.ownedGames.filter((g) => g.members.length > 0) ?? [];
  const soloGames = preview?.ownedGames.filter((g) => g.members.length === 0) ?? [];

  const allDecisionsMade =
    multiMemberGames.length > 0 &&
    multiMemberGames.every((g) => {
      const d = decisions[g.id];
      if (!d) return false;
      if (d.action === 'transfer') return !!d.newGmId;
      return true;
    });

  const gamesBeingDeleted = preview
    ? soloGames.length +
      multiMemberGames.filter((g) => decisions[g.id]?.action === 'delete').length
    : 0;
  const gamesBeingTransferred = multiMemberGames.filter(
    (g) => decisions[g.id]?.action === 'transfer'
  ).length;

  async function handleConfirmDeletion() {
    if (confirmText !== CONFIRM_WORD) return;

    setStep('deleting');

    const gameActions = Object.entries(decisions).map(([gameId, d]) => ({
      gameId,
      ...d,
    }));

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameActions }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setErrorMessage(data.error ?? 'Deletion failed. Please try again.');
        setStep('error');
        return;
      }

      // Account is deleted — sign out; useAuthRedirect will redirect to /login
      await signOut();
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setStep('error');
    }
  }

  if (isLoading || step === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive font-medium">{errorMessage}</p>
            <div className="flex justify-center gap-4">
              <Button variant="secondary" onClick={() => { setStep('loading'); setErrorMessage(''); }}>
                Try again
              </Button>
              <Link href="/settings">
                <Button variant="ghost">Back to Settings</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'deleting') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground">Deleting your account&hellip;</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Settings
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">Delete Account</h1>
      <p className="text-muted-foreground mb-8">
        This action is permanent and cannot be undone.
      </p>

      {step === 'decisions' && (
        <div className="space-y-6">
          {soloGames.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-card-foreground">
                  Games that will be deleted
                </h2>
                <p className="text-sm text-muted-foreground">
                  You are the only member of these games.
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {soloGames.map((g) => (
                    <li key={g.id} className="text-sm text-muted-foreground">
                      {g.name}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-card-foreground">
                Games with other players
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose what to do with each game before deleting your account.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {multiMemberGames.map((game) => (
                <GameDecisionCard
                  key={game.id}
                  game={game}
                  decision={decisions[game.id] ?? null}
                  onDelete={() => setDecision(game.id, { action: 'delete' })}
                  onTransferSelect={(newGmId) => setDecision(game.id, { action: 'transfer', newGmId })}
                  onSetTransferTarget={(newGmId) => setTransferTarget(game.id, newGmId)}
                />
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/settings">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button
              variant="danger"
              disabled={!allDecisionsMade}
              onClick={() => setStep('confirm')}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-card-foreground">
                What will be deleted
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 text-sm">
                {gamesBeingDeleted > 0 && (
                  <li className="text-foreground">
                    <p className="font-medium">
                      {gamesBeingDeleted} {gamesBeingDeleted === 1 ? 'game' : 'games'} will be
                      permanently deleted, including all sessions, availability, and player data:
                    </p>
                    <ul className="mt-1.5 ml-4 space-y-0.5 text-muted-foreground">
                      {[
                        ...soloGames.map((g) => g.name),
                        ...multiMemberGames
                          .filter((g) => decisions[g.id]?.action === 'delete')
                          .map((g) => g.name),
                      ].map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </li>
                )}
                {gamesBeingTransferred > 0 && (
                  <li className="text-foreground">
                    <p className="font-medium">
                      {gamesBeingTransferred} {gamesBeingTransferred === 1 ? 'game' : 'games'} will
                      be transferred to a new GM:
                    </p>
                    <ul className="mt-1.5 ml-4 space-y-0.5 text-muted-foreground">
                      {multiMemberGames
                        .filter((g) => decisions[g.id]?.action === 'transfer')
                        .map((g) => {
                          const d = decisions[g.id];
                          const newGm = d?.action === 'transfer'
                            ? g.members.find((m) => m.id === d.newGmId)
                            : null;
                          return (
                            <li key={g.id}>
                              {g.name} → {newGm?.name ?? 'Unknown'}
                            </li>
                          );
                        })}
                    </ul>
                  </li>
                )}
                {(preview?.playerMembershipGames?.length ?? 0) > 0 && (
                  <li className="text-foreground">
                    <p className="font-medium">
                      You will be removed from{' '}
                      {preview!.playerMembershipGames.length}{' '}
                      {preview!.playerMembershipGames.length === 1 ? 'game' : 'games'} as a player:
                    </p>
                    <ul className="mt-1.5 ml-4 space-y-0.5 text-muted-foreground">
                      {preview!.playerMembershipGames.map((g) => (
                        <li key={g.id}>{g.name}</li>
                      ))}
                    </ul>
                  </li>
                )}
                <li className="text-foreground font-medium">
                  Your account and all personal data will be permanently deleted.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm font-medium text-foreground">
                Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to confirm
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-destructive focus:border-destructive"
                autoComplete="off"
                aria-label="Type DELETE to confirm"
              />
              <div className="flex justify-end gap-3 pt-2">
                <Link href="/settings">
                  <Button variant="secondary">Cancel</Button>
                </Link>
                {multiMemberGames.length > 0 && (
                  <Button variant="ghost" onClick={() => setStep('decisions')}>
                    Back
                  </Button>
                )}
                <Button
                  variant="danger"
                  disabled={confirmText !== CONFIRM_WORD}
                  onClick={handleConfirmDeletion}
                >
                  Permanently Delete My Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function GameDecisionCard({
  game,
  decision,
  onDelete,
  onTransferSelect,
  onSetTransferTarget,
}: {
  game: OwnedGame;
  decision: GameDecision | null;
  onDelete: () => void;
  onTransferSelect: (newGmId: string) => void;
  onSetTransferTarget: (newGmId: string) => void;
}) {
  return (
    <div data-testid={`game-decision-${game.id}`} className="border border-border rounded-lg p-4 space-y-3">
      <div>
        <p className="font-medium text-foreground">{game.name}</p>
        <p className="text-sm text-muted-foreground">
          {game.members.length} {game.members.length === 1 ? 'player' : 'players'}
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`game-${game.id}`}
            checked={decision?.action === 'delete'}
            onChange={onDelete}
          />
          <span className="text-sm text-foreground">
            Delete this game and remove all player data
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`game-${game.id}`}
            checked={decision?.action === 'transfer'}
            onChange={() => {
              const firstMember = game.members[0];
              if (firstMember) onTransferSelect(firstMember.id);
            }}
          />
          <span className="text-sm text-foreground">Transfer to another player</span>
        </label>
      </div>

      {decision?.action === 'transfer' && (
        <div className="ml-6">
          <select
            value={decision.newGmId}
            onChange={(e) => onSetTransferTarget(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={`Select new GM for ${game.name}`}
          >
            {game.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
