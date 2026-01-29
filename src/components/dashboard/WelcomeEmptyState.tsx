"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button, Card, CardContent, Input } from "@/components/ui";

function extractInviteCode(input: string): string {
  const trimmed = input.trim();

  // Check if it's a URL containing /games/join/
  const joinPathMatch = trimmed.match(/\/games\/join\/([^/?#]+)/);
  if (joinPathMatch) {
    return joinPathMatch[1];
  }

  // Otherwise treat the whole input as the code
  return trimmed;
}

export function WelcomeEmptyState() {
  const router = useRouter();
  const [inviteInput, setInviteInput] = useState("");
  const [error, setError] = useState("");

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractInviteCode(inviteInput);
    if (!code) {
      setError("Please enter an invite code or link");
      return;
    }
    router.push(`/games/join/${code}`);
  };

  return (
    <div className="text-center mb-8">
      <div className="mb-8">
        <Image
          src="/logo.png"
          alt="Can We Play?"
          width={80}
          height={80}
          className="mx-auto mb-4"
        />
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Can We Play?
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Schedule game nights with your group. Create a new game or join an
          existing one with an invite code.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
        <Card className="text-left">
          <CardContent className="py-6">
            <div className="text-center mb-4">
              <span className="text-4xl block mb-2">🎯</span>
              <h3 className="text-lg font-semibold text-card-foreground">
                Create a Game
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Start a new game as the Game Master. Invite players and schedule
              your sessions.
            </p>
            <Link href="/games/new" className="block">
              <Button className="w-full">Create New Game</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="text-left">
          <CardContent className="py-6">
            <div className="text-center mb-4">
              <span className="text-4xl block mb-2">🎫</span>
              <h3 className="text-lg font-semibold text-card-foreground">
                Join a Game
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Have an invite link from your GM? Paste it below to join their
              game.
            </p>
            <form onSubmit={handleJoinGame}>
              <div className="space-y-3">
                <Input
                  placeholder="Paste invite link or code"
                  value={inviteInput}
                  onChange={(e) => {
                    setInviteInput(e.target.value);
                    setError("");
                  }}
                  error={error}
                />
                <Button type="submit" variant="secondary" className="w-full">
                  Join Game
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
