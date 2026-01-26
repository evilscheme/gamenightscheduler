"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { User, MemberWithRole } from "@/types";

interface PlayersCardProps {
  allPlayers: (User | MemberWithRole)[];
  gmId: string;
  isGm: boolean;
  isCoGm: boolean;
  members: MemberWithRole[];
  playerCompletionPercentages: Record<string, number>;
  onToggleCoGm: (playerId: string, makeCoGm: boolean) => Promise<void>;
  onRemovePlayer: (player: User) => void;
}

export function PlayersCard({
  allPlayers,
  gmId,
  isGm,
  isCoGm,
  members,
  playerCompletionPercentages,
  onToggleCoGm,
  onRemovePlayer,
}: PlayersCardProps) {
  const [openPlayerMenu, setOpenPlayerMenu] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-card-foreground">
          Players ({allPlayers.length})
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {allPlayers.map((player) => {
            const memberData = members.find((m) => m.id === player.id);
            const playerIsCoGm = memberData?.is_co_gm ?? false;
            const isOriginalGm = player.id === gmId;
            // Co-GMs can only remove non-co-GM members
            const canRemovePlayer =
              isGm || (isCoGm && !playerIsCoGm && !isOriginalGm);
            const showMenu = (isGm || canRemovePlayer) && !isOriginalGm;

            return (
              <li key={player.id} className="py-3 flex items-center gap-3">
                {player.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external avatar URL from OAuth provider
                  <img
                    src={player.avatar_url}
                    alt={player.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                    {player.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-card-foreground">{player.name}</span>
                  {playerCompletionPercentages[player.id] !== undefined && (
                    <span
                      className={`ml-2 text-xs ${
                        playerCompletionPercentages[player.id] === 100
                          ? "text-success"
                          : playerCompletionPercentages[player.id] >= 50
                            ? "text-warning"
                            : "text-muted-foreground"
                      }`}
                      title="Availability filled in"
                    >
                      {playerCompletionPercentages[player.id]}% filled
                    </span>
                  )}
                </div>
                {isOriginalGm && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    GM
                  </span>
                )}
                {playerIsCoGm && (
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                    Co-GM
                  </span>
                )}
                {showMenu && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setOpenPlayerMenu(
                          openPlayerMenu === player.id ? null : player.id
                        )
                      }
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      aria-label="Player actions"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    {openPlayerMenu === player.id && (
                      <>
                        {/* Backdrop to close menu on click outside */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenPlayerMenu(null)}
                        />
                        <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
                          {isGm && (
                            <button
                              onClick={() => {
                                onToggleCoGm(player.id, !playerIsCoGm);
                                setOpenPlayerMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-card-foreground hover:bg-secondary transition-colors"
                            >
                              {playerIsCoGm ? "Remove Co-GM" : "Make Co-GM"}
                            </button>
                          )}
                          {canRemovePlayer && (
                            <button
                              onClick={() => {
                                onRemovePlayer(player);
                                setOpenPlayerMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 transition-colors"
                            >
                              Remove from Game
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
