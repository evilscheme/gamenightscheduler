"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { Button, LoadingSpinner, Modal, useToast } from "@/components/ui";
import { OverviewTabContent } from "@/components/games/overview/OverviewTabContent";
import {
  User,
  DateSuggestion,
} from "@/types";
import { AvailabilityTabContent } from "@/components/games/availability/AvailabilityTabContent";
import { ScheduleTabContent } from "@/components/games/schedule/ScheduleTabContent";
import {
  addMonths,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isAfter,
  isBefore,
  startOfDay,
  parseISO,
} from "date-fns";
import { getPlayDatesInWindow } from "@/lib/availability";
import { calculateDateSuggestions } from "@/lib/suggestions";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useGameDetail } from "@/hooks/useGameDetail";
import { getSchedulingWindow } from "@/lib/scheduling";

type Tab = "overview" | "availability" | "schedule";

export default function GameDetailPage() {
  const { profile, authStatus } = useAuth();
  const { weekStartDay, use24h, timezone: userTimezone } = useUserPreferences();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  // Data layer via hook
  const {
    game,
    loading,
    refreshing,
    availability,
    allAvailability,
    sessions,
    gamePlayDates,
    otherGames,
    refresh,
    changeAvailability,
    copyFromGame,
    confirmSession,
    cancelSession,
    regenerateInvite,
    leaveGame,
    removePlayer,
    deleteGame,
    toggleCoGm,
    toggleExtraDate,
    updatePlayDateNote,
  } = useGameDetail(gameId, profile?.id ?? "");

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [suggestions, setSuggestions] = useState<DateSuggestion[]>([]);
  const [playerToRemove, setPlayerToRemove] = useState<User | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const isGm = game?.gm_id === profile?.id;
  const isCoGm =
    game?.members.some((m) => m.id === profile?.id && m.is_co_gm) ?? false;
  const canDoGmActions = !!(isGm || isCoGm);
  const isMember = game?.members.some((m) => m.id === profile?.id);

  const playDateEntries = useMemo(() => {
    return gamePlayDates
      .map((r) => ({ date: r.date, note: r.note }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [gamePlayDates]);

  // Only dates that are true extra dates (not regular play days with notes)
  const extraDateStrings = useMemo(() => {
    const regularDays = new Set(game?.play_days ?? []);
    return playDateEntries
      .filter((d) => !regularDays.has(getDay(parseISO(d.date))))
      .map((d) => d.date);
  }, [playDateEntries, game?.play_days]);

  const playDateNotes = useMemo(
    () =>
      new Map(
        playDateEntries
          .filter((d) => d.note)
          .map((d) => [d.date, d.note!])
      ),
    [playDateEntries]
  );

  const { start: windowStart, end: windowEnd } = useMemo(
    () =>
      game
        ? getSchedulingWindow(game)
        : { start: startOfDay(new Date()), end: endOfMonth(addMonths(new Date(), 2)) },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally depends on specific fields, not the full game object, to prevent re-render loops
    [game?.scheduling_window_months, game?.campaign_start_date, game?.campaign_end_date]
  );

  const specialPlayDatesSet = useMemo(
    () => new Set(extraDateStrings),
    [extraDateStrings]
  );

  const completionByUserId = useMemo(() => {
    const map = new Map<string, { answered: number; total: number }>();
    if (!game) return map;
    const playDates = getPlayDatesInWindow({
      playDays: game.play_days,
      schedulingWindowMonths: game.scheduling_window_months,
      extraPlayDates: extraDateStrings,
      windowStart,
      windowEnd,
    });
    const total = playDates.length;
    const playDateSet = new Set(playDates);
    const allPlayers = [game.gm, ...game.members];
    for (const p of allPlayers) {
      const answered = allAvailability.filter(
        (a) => a.user_id === p.id && playDateSet.has(a.date)
      ).length;
      map.set(p.id, { answered, total });
    }
    return map;
  }, [game, allAvailability, extraDateStrings, windowStart, windowEnd]);

  const [subscribeUrl, setSubscribeUrl] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined' && game?.invite_code) {
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

  // Calculate suggestions when availability changes
  useEffect(() => {
    if (!game) return;

    const allPlayers = [game.gm, ...game.members];
    const today = startOfDay(new Date());

    // Get play dates within the scheduling window
    const playDates = isBefore(windowEnd, windowStart)
      ? []
      : eachDayOfInterval({ start: windowStart, end: windowEnd })
          .filter((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            return game.play_days.includes(getDay(date)) || extraDateStrings.includes(dateStr);
          })
          .filter(
            (date) =>
              isAfter(date, today) ||
              format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
          );

    // Use the shared utility function to calculate suggestions
    const suggestionList = calculateDateSuggestions({
      playDates,
      players: allPlayers,
      availability: allAvailability,
      getDayOfWeek: getDay,
      formatDate: (date) => format(date, "yyyy-MM-dd"),
      minPlayersNeeded: game.min_players_needed || 0,
    });

    setSuggestions(suggestionList);
  }, [game, allAvailability, extraDateStrings, windowStart, windowEnd]);

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

  const handleDeleteGame = async () => {
    setIsDeleting(true);
    const success = await deleteGame();
    if (success) {
      router.push("/dashboard");
    } else {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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

  const handleRegenerateInvite = async () => {
    setIsRegenerating(true);
    await regenerateInvite();
    setIsRegenerating(false);
    setShowRegenerateConfirm(false);
  };

  const handleRemovePlayer = async (playerId: string) => {
    await removePlayer(playerId);
    setPlayerToRemove(null);
  };

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
                <Button
                  onClick={() => setShowRegenerateConfirm(true)}
                  variant="secondary"
                >
                  Regenerate Invite
                </Button>
              </>
            )}
            {isGm && (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="danger"
              >
                Delete Game
              </Button>
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
              {tab}
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

      <Modal
        open={showRegenerateConfirm}
        onClose={() => !isRegenerating && setShowRegenerateConfirm(false)}
        title="Regenerate Invite Code?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowRegenerateConfirm(false)}
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRegenerateInvite}
              disabled={isRegenerating}
            >
              {isRegenerating ? "Regenerating..." : "Regenerate"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This will invalidate the current invite link and calendar subscription
          URL. Anyone using the old link will no longer be able to join, and
          calendar apps will need to re-subscribe with the new URL.
        </p>
      </Modal>

      <Modal
        open={showDeleteConfirm}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
        title="Delete Game?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteGame} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Game"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to permanently delete{" "}
          <strong>{game.name}</strong>? This will remove all players,
          availability data, and scheduled sessions. This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
