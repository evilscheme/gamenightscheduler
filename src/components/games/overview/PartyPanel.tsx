'use client';

import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { Avatar, Button, EyebrowLabel, useToast } from '@/components/ui';
import type { User, MemberWithRole } from '@/types';

interface PartyPanelProps {
  allPlayers: (User | MemberWithRole)[];
  gmId: string;
  isGm: boolean;
  isCoGm: boolean;
  members: MemberWithRole[];
  completionByUserId: Map<string, { answered: number; total: number }>;
  inviteCode: string;
  onToggleCoGm: (playerId: string, makeCoGm: boolean) => Promise<void>;
  onRemovePlayer: (player: User) => void;
}

function fillClass(pct: number): string {
  if (pct >= 80) return 'bg-success';
  if (pct >= 50) return 'bg-warning';
  return 'bg-danger';
}

export function PartyPanel({
  allPlayers,
  gmId,
  isGm,
  isCoGm,
  members,
  completionByUserId,
  inviteCode,
  onToggleCoGm,
  onRemovePlayer,
}: PartyPanelProps) {
  const [openPlayerMenu, setOpenPlayerMenu] = useState<string | null>(null);
  const toast = useToast();

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/games/join/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.show('Invite link copied to clipboard.');
    } catch {
      toast.show('Could not copy. Select the URL manually.', 'danger');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <EyebrowLabel>Players ({allPlayers.length})</EyebrowLabel>
      <ul className="mt-3 space-y-3" data-testid="players-list">
        {allPlayers.map((player) => {
          const memberData = members.find((m) => m.id === player.id);
          const playerIsCoGm = memberData?.is_co_gm ?? false;
          const isOriginalGm = player.id === gmId;
          const canRemovePlayer = isGm || (isCoGm && !playerIsCoGm && !isOriginalGm);
          const showMenu = (isGm || canRemovePlayer) && !isOriginalGm;
          const c = completionByUserId.get(player.id) ?? { answered: 0, total: 0 };
          const pct = c.total > 0 ? Math.round((c.answered / c.total) * 100) : 0;

          return (
            <li
              key={player.id}
              className="grid grid-cols-[30px_minmax(0,1fr)_auto_28px] items-center gap-3"
            >
              <Avatar
                userId={player.id}
                name={player.name}
                avatarUrl={player.avatar_url}
                size={30}
              />
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm text-card-foreground">
                  <span className="truncate">{player.name}</span>
                  {isOriginalGm && (
                    <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">
                      GM
                    </span>
                  )}
                  {playerIsCoGm && (
                    <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">
                      CO-GM
                    </span>
                  )}
                </p>
                <div
                  className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted"
                  title="Availability filled in"
                >
                  <div className={`h-full ${fillClass(pct)}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                {c.answered}/{c.total}
              </span>
              {showMenu ? (
                <div className="relative">
                  <button
                    onClick={() =>
                      setOpenPlayerMenu(openPlayerMenu === player.id ? null : player.id)
                    }
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Player actions"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                  {openPlayerMenu === player.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenPlayerMenu(null)}
                      />
                      <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
                        {isGm && (
                          <button
                            onClick={() => {
                              onToggleCoGm(player.id, !playerIsCoGm);
                              setOpenPlayerMenu(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-card-foreground transition-colors hover:bg-secondary"
                          >
                            {playerIsCoGm ? 'Remove Co-GM' : 'Make Co-GM'}
                          </button>
                        )}
                        {canRemovePlayer && (
                          <button
                            onClick={() => {
                              onRemovePlayer(player);
                              setOpenPlayerMenu(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10"
                          >
                            Remove from Game
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <span aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      {allPlayers.length === 1 && (isGm || isCoGm) && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3">
          <p className="text-sm text-primary">
            Invite players by sharing the invite link. They&apos;ll be able to join and mark
            their availability.
          </p>
          <Button onClick={copyInviteLink} variant="secondary" size="sm" className="mt-2">
            Copy Share Link
          </Button>
        </div>
      )}
    </div>
  );
}
