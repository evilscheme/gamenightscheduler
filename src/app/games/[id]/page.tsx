"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { Button, LoadingSpinner, Modal, OnboardingBanner, useToast } from "@/components/ui";
import { shouldShowAvailabilityNudge } from "@/lib/onboarding";
import { OverviewTabContent } from "@/components/games/overview/OverviewTabContent";
import { User } from "@/types";
import { AvailabilityTabContent } from "@/components/games/availability/AvailabilityTabContent";
import { ScheduleTabContent } from "@/components/games/schedule/ScheduleTabContent";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useGameMeta } from "@/hooks/useGameMeta";
import { useAvailability } from "@/hooks/useAvailability";
import { useSessions } from "@/hooks/useSessions";
import { usePlayDates } from "@/hooks/usePlayDates";
import { useGameDerivedState } from "@/hooks/useGameDerivedState";

type Tab = "overview" | "availability" | "schedule";

export default function GameDetailPage() {
  const { profile, authStatus } = useAuth();
  const { weekStartDay, use24h, timezone: userTimezone } = useUserPreferences();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const userId = profile?.id ?? "";

  // Data layer via focused hooks
  const meta = useGameMeta(gameId, userId);
  const { game, otherGames, refreshing, leaveGame, removePlayer, toggleCoGm } = meta;

  const ready = !!game;
  const availabilityHook = useAvailability(gameId, userId, game);
  const { availability, allAvailability, changeAvailability, copyFromGame: copyFromGameRaw, removePlayerData } = availabilityHook;

  const sessionsHook = useSessions(gameId, ready);
  const { sessions, confirmSession: confirmSessionRaw, updateSession, cancelSession } = sessionsHook;

  const playDatesHook = usePlayDates(gameId, ready);
  const { gamePlayDates, toggleExtraDate: toggleExtraDateRaw, updatePlayDateNote } = playDatesHook;

  // Loading is driven by meta until the game resolves; only then do we wait
  // on downstream hooks. Without the `!game` short-circuit, a non-member
  // request leaves downstream loading=true forever (their fetches never run).
  const loading =
    meta.loading ||
    (!!game &&
      (availabilityHook.loading || sessionsHook.loading || playDatesHook.loading));

  const refresh = async () => {
    await Promise.all([
      meta.refresh(),
      availabilityHook.refresh(),
      sessionsHook.refresh(),
      playDatesHook.refresh(),
    ]);
  };

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [playerToRemove, setPlayerToRemove] = useState<User | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const isGm = game?.gm_id === profile?.id;
  const isCoGm =
    game?.members.some((m) => m.id === profile?.id && m.is_co_gm) ?? false;
  const canDoGmActions = !!(isGm || isCoGm);
  const isMember = game?.members.some((m) => m.id === profile?.id);

  const hasAnyAvailability = Object.keys(availability).length > 0;
  const showAvailabilityNudge = shouldShowAvailabilityNudge({
    hasAnyAvailability,
    activeTab,
    isParticipant: !!isMember,
  });

  const {
    extraDateStrings,
    playDateNotes,
    specialPlayDatesSet,
    windowStart,
    windowEnd,
    completionByUserId,
    suggestions,
  } = useGameDerivedState(game, allAvailability, gamePlayDates);

  const [subscribeUrl, setSubscribeUrl] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined' && game?.invite_code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- window.location is only known client-side
      setSubscribeUrl(`webcal://${window.location.host}/api/games/calendar/${game.invite_code}`);
    }
  }, [game?.invite_code]);

  useAuthRedirect();

  // Redirect to dashboard if game not found after loading
  useEffect(() => {
    if (!loading && !game && profile?.id) {
      router.push("/dashboard");
    }
  }, [loading, game, profile?.id, router]);

  const toast = useToast();

  // UI action wrappers
  const copyInviteLink = async () => {
    if (!game) return;
    const link = `${window.location.origin}/games/join/${game.invite_code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.show('Invite link copied to clipboard.');
    } catch {
      toast.show('Could not copy. Select the URL manually.', 'danger');
    }
  };

  const handleLeaveGame = async () => {
    setIsLeaving(true);
    const success = await leaveGame();
    if (success) {
      router.push("/dashboard");
    } else {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    const ok = await removePlayer(playerId);
    if (ok) removePlayerData(playerId);
    setPlayerToRemove(null);
  };

  const toggleExtraDate = (date: string) =>
    toggleExtraDateRaw(date, extraDateStrings.includes(date));

  const copyFromGame = (sourceGameId: string) =>
    copyFromGameRaw(sourceGameId, extraDateStrings);

  const confirmSession = (
    date: string,
    startTime: string,
    endTime: string,
    location: string | null,
    notes: string | null,
  ) => confirmSessionRaw(date, startTime, endTime, profile?.id ?? "", location, notes);

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!game) return null;

  const allPlayers = [game.gm, ...game.members];
  const confirmedSessions = sessions.filter((s) => s.status === "confirmed");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{game.name}</h1>
            <p className="text-muted-foreground mt-1">
              GM: {game.gm.name}
              {isGm && " (You)"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={refreshing ? "animate-spin" : ""}
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
            {canDoGmActions && (
              <>
                <Button
                  onClick={() => router.push(`/games/${gameId}/edit`)}
                  variant="secondary"
                >
                  Edit
                </Button>
                <Button onClick={copyInviteLink} variant="secondary">
                  Copy Invite Link
                </Button>
              </>
            )}
            {isMember && !isGm && (
              <Button
                onClick={() => setShowLeaveConfirm(true)}
                variant="danger"
              >
                Leave Game
              </Button>
            )}
          </div>
        </div>
        {game.description && (
          <p className="text-muted-foreground mt-4">{game.description}</p>
        )}
      </div>

      {showAvailabilityNudge && (
        <OnboardingBanner
          title="You're in the party! 🎉"
          description="Add your availability so the GM can find a night that works for everyone."
          ctaLabel="Add availability"
          onCta={() => setActiveTab("availability")}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex gap-4 sm:gap-6">
          {(["overview", "availability", "schedule"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <span className="relative inline-flex items-center">
                {tab}
                {tab === "availability" && showAvailabilityNudge && (
                  <span
                    aria-hidden
                    className="absolute -right-2.5 -top-1 size-1.5 rounded-full bg-primary motion-safe:animate-ping"
                  />
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTabContent
          playDays={game.play_days}
          windowStart={windowStart}
          windowEnd={windowEnd}
          allPlayers={allPlayers}
          members={game.members}
          gmId={game.gm_id}
          isGm={isGm}
          isCoGm={isCoGm}
          completionByUserId={completionByUserId}
          inviteCode={game.invite_code}
          onToggleCoGm={async (playerId, makeCoGm) => { await toggleCoGm(playerId, makeCoGm); }}
          onRemovePlayer={(player) => setPlayerToRemove(player)}
          schedulingWindowMonths={game.scheduling_window_months}
          defaultStartTime={game.default_start_time}
          defaultEndTime={game.default_end_time}
          timezone={game.timezone}
          minPlayersNeeded={game.min_players_needed || 0}
          confirmedSessions={confirmedSessions}
          use24h={use24h}
          adHocOnly={game.ad_hoc_only}
          campaignStartDate={game.campaign_start_date}
          campaignEndDate={game.campaign_end_date}
          gameName={game.name}
          subscribeUrl={subscribeUrl}
        />
      )}

      {activeTab === "availability" && profile && (
        <AvailabilityTabContent
          windowStart={windowStart}
          windowEnd={windowEnd}
          currentUserId={profile.id}
          completionByUserId={completionByUserId}
          playDays={game.play_days}
          availability={availability}
          onToggle={changeAvailability}
          confirmedSessions={confirmedSessions}
          extraPlayDates={extraDateStrings}
          isGmOrCoGm={canDoGmActions}
          onToggleExtraDate={toggleExtraDate}
          weekStartDay={weekStartDay}
          use24h={use24h}
          otherGames={otherGames}
          onCopyFromGame={copyFromGame}
          playDateNotes={playDateNotes}
          onUpdatePlayDateNote={updatePlayDateNote}
          hasCampaignDates={!!(game.campaign_start_date || game.campaign_end_date)}
          adHocOnly={game.ad_hoc_only}
        />
      )}

      {activeTab === "schedule" && (
        <ScheduleTabContent
          suggestions={suggestions}
          sessions={sessions}
          members={[{ ...game.gm, is_co_gm: false }, ...game.members]}
          gmId={game.gm_id}
          isGm={canDoGmActions}
          gameName={game.name}
          gameDescription={game.description}
          playDays={game.play_days}
          windowStart={windowStart}
          windowEnd={windowEnd}
          specialPlayDates={specialPlayDatesSet}
          playDateNotes={playDateNotes}
          defaultStartTime={game.default_start_time}
          defaultEndTime={game.default_end_time}
          timezone={game.timezone}
          userTimezone={userTimezone}
          use24h={use24h}
          weekStartDay={weekStartDay}
          minPlayersNeeded={game.min_players_needed || 0}
          completionByUserId={completionByUserId}
          subscribeUrl={subscribeUrl}
          onConfirm={confirmSession}
          onUpdateSession={updateSession}
          onCancel={cancelSession}
        />
      )}

      <Modal
        open={showLeaveConfirm}
        onClose={() => !isLeaving && setShowLeaveConfirm(false)}
        title="Leave Game?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowLeaveConfirm(false)}
              disabled={isLeaving}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleLeaveGame} disabled={isLeaving}>
              {isLeaving ? "Leaving..." : "Leave Game"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to leave <strong>{game.name}</strong>? Your
          availability data will be removed.
        </p>
      </Modal>

      <Modal
        open={!!playerToRemove}
        onClose={() => setPlayerToRemove(null)}
        title="Remove Player?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlayerToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => playerToRemove && handleRemovePlayer(playerToRemove.id)}
            >
              Remove Player
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to remove{" "}
          <strong>{playerToRemove?.name}</strong> from this game? Their
          availability data will be deleted.
        </p>
      </Modal>

    </div>
  );
}
