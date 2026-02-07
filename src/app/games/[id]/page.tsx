"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { Button, LoadingSpinner } from "@/components/ui";
import { PlayersCard } from "@/components/games/PlayersCard";
import { GameDetailsCard } from "@/components/games/GameDetailsCard";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Availability,
  AvailabilityStatus,
  GameSession,
  DateSuggestion,
  GameWithMembers,
  MemberWithRole,
  MembershipWithUser,
} from "@/types";
import {
  AvailabilityCalendar,
  AvailabilityEntry,
} from "@/components/calendar/AvailabilityCalendar";
import { SchedulingSuggestions } from "@/components/games/SchedulingSuggestions";
import {
  addMonths,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isAfter,
  startOfDay,
  parseISO,
} from "date-fns";
import { TIMEOUTS, USAGE_LIMITS } from "@/lib/constants";
import { calculatePlayerCompletionPercentages } from "@/lib/availability";
import { calculateDateSuggestions } from "@/lib/suggestions";

type Tab = "overview" | "availability" | "schedule";

export default function GameDetailPage() {
  const { profile, isLoading, session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;
  const supabase = createClient();

  const [game, setGame] = useState<GameWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [availability, setAvailability] = useState<
    Record<string, AvailabilityEntry>
  >({});
  const [allAvailability, setAllAvailability] = useState<Availability[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [suggestions, setSuggestions] = useState<DateSuggestion[]>([]);
  const [copied, setCopied] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<User | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isGm = game?.gm_id === profile?.id;
  const isCoGm =
    game?.members.some((m) => m.id === profile?.id && m.is_co_gm) ?? false;
  const canDoGmActions = !!(isGm || isCoGm);
  const isMember = game?.members.some((m) => m.id === profile?.id);

  // Calculate availability completion percentage per player
  const playerCompletionPercentages = useMemo(() => {
    if (!game) return {};

    const allPlayers = [game.gm, ...game.members];
    return calculatePlayerCompletionPercentages({
      playerIds: allPlayers.map((p) => p.id),
      playDays: game.play_days,
      schedulingWindowMonths: game.scheduling_window_months,
      specialPlayDates: game.special_play_dates || [],
      availabilityRecords: allAvailability,
    });
  }, [game, allAvailability]);

  useAuthRedirect();

  const fetchData = useCallback(async () => {
    if (!gameId || !profile?.id) return;

    // Fetch game with GM
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("*, gm:users!games_gm_id_fkey(*)")
      .eq("id", gameId)
      .single();

    if (gameError || !gameData) {
      router.push("/dashboard");
      return;
    }

    // Fetch members with co-GM status
    const { data: memberships } = await supabase
      .from("game_memberships")
      .select("user_id, is_co_gm, users(*)")
      .eq("game_id", gameId);

    // Type the memberships properly and map to MemberWithRole
    const typedMemberships = memberships as MembershipWithUser[] | null;
    const members: MemberWithRole[] = typedMemberships
      ?.filter((m) => m.users !== null)
      .map((m) => ({
        ...m.users!,
        is_co_gm: m.is_co_gm,
      })) || [];

    setGame({ ...gameData, members } as GameWithMembers);

    // Fetch user's availability
    const { data: userAvail } = await supabase
      .from("availability")
      .select("*")
      .eq("game_id", gameId)
      .eq("user_id", profile.id);

    const availMap: Record<string, AvailabilityEntry> = {};
    userAvail?.forEach((a) => {
      availMap[a.date] = {
        status: a.status,
        comment: a.comment,
        available_after: a.available_after,
        available_until: a.available_until,
      };
    });
    setAvailability(availMap);

    // Fetch all availability for suggestions
    const { data: allAvail } = await supabase
      .from("availability")
      .select("*")
      .eq("game_id", gameId);

    setAllAvailability(allAvail || []);

    // Fetch sessions
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("*")
      .eq("game_id", gameId)
      .order("date", { ascending: true });

    setSessions(sessionData || []);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [gameId, profile?.id, router]);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id, fetchData]);

  // Calculate suggestions when availability changes
  useEffect(() => {
    if (!game) return;

    const allPlayers = [game.gm, ...game.members];
    const today = startOfDay(new Date());
    const endDate = endOfMonth(addMonths(today, game.scheduling_window_months));
    const specialDates = game.special_play_dates || [];

    // Get play dates within the scheduling window
    const playDates = eachDayOfInterval({ start: today, end: endDate })
      .filter((date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        return game.play_days.includes(getDay(date)) || specialDates.includes(dateStr);
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
  }, [game, allAvailability]);

  const handleAvailabilityChange = async (
    date: string,
    status: AvailabilityStatus,
    comment: string | null,
    availableAfter: string | null,
    availableUntil: string | null
  ) => {
    if (!profile?.id || !gameId) return;

    // Optimistic update
    setAvailability((prev) => ({
      ...prev,
      [date]: {
        status,
        comment,
        available_after: availableAfter,
        available_until: availableUntil,
      },
    }));

    const { error } = await supabase.from("availability").upsert(
      {
        user_id: profile.id,
        game_id: gameId,
        date,
        status,
        comment,
        available_after: availableAfter,
        available_until: availableUntil,
      },
      { onConflict: "user_id,game_id,date" }
    );

    if (error) {
      // Revert on error
      setAvailability((prev) => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
    } else {
      // Update all availability for suggestions
      setAllAvailability((prev) => {
        const existing = prev.findIndex(
          (a) => a.user_id === profile.id && a.date === date
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = {
            ...updated[existing],
            status,
            comment,
            available_after: availableAfter,
            available_until: availableUntil,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: "temp",
            user_id: profile.id,
            game_id: gameId,
            date,
            status,
            comment,
            available_after: availableAfter,
            available_until: availableUntil,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      });
    }
  };

  const handleConfirmSession = async (
    date: string,
    startTime: string,
    endTime: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile?.id || !gameId) return { success: false, error: "Not authenticated" };

    // Validate date is not in the past
    const sessionDate = parseISO(date);
    const today = startOfDay(new Date());
    if (sessionDate < today) {
      return { success: false, error: "Cannot schedule sessions in the past." };
    }

    // Check if we're updating an existing session or creating a new one
    const existingSession = sessions.find((s) => s.date === date);
    if (!existingSession) {
      // Count future sessions (only for new sessions)
      const futureSessionCount = sessions.filter(
        (s) => parseISO(s.date) >= today
      ).length;

      if (futureSessionCount >= USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME) {
        return { success: false, error: `Cannot have more than ${USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME} future sessions. Please cancel some sessions first.` };
      }
    }

    const { data, error } = await supabase
      .from("sessions")
      .upsert(
        {
          game_id: gameId,
          date,
          start_time: startTime,
          end_time: endTime,
          status: "confirmed",
          confirmed_by: profile.id,
        },
        { onConflict: "game_id,date" }
      )
      .select()
      .single();

    if (error) {
      // Check for RLS policy violation
      if (error.code === "42501") {
        // Could be past date or session limit
        return { success: false, error: "Cannot schedule this session. It may be in the past or the game has reached the session limit." };
      }
      return { success: false, error: "Failed to confirm session. Please try again." };
    }

    if (data) {
      setSessions((prev) => {
        const existing = prev.findIndex((s) => s.date === date);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data;
          return updated;
        }
        return [...prev, data].sort((a, b) => a.date.localeCompare(b.date));
      });
    }

    return { success: true };
  };

  const handleCancelSession = async (date: string) => {
    if (!profile?.id || !gameId) return;

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("game_id", gameId)
      .eq("date", date);

    if (!error) {
      setSessions((prev) => prev.filter((s) => s.date !== date));
    }
  };

  const copyInviteLink = () => {
    if (!game) return;
    const link = `${window.location.origin}/games/join/${game.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), TIMEOUTS.NOTIFICATION);
  };

  const handleLeaveGame = async () => {
    if (!profile?.id || !gameId) return;

    setIsLeaving(true);
    const { error } = await supabase
      .from("game_memberships")
      .delete()
      .eq("game_id", gameId)
      .eq("user_id", profile.id);

    if (!error) {
      router.push("/dashboard");
    } else {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!gameId) return;

    const { error } = await supabase
      .from("game_memberships")
      .delete()
      .eq("game_id", gameId)
      .eq("user_id", playerId);

    if (!error) {
      setGame((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.filter((m) => m.id !== playerId),
        };
      });
      // Also remove their availability from allAvailability
      setAllAvailability((prev) => prev.filter((a) => a.user_id !== playerId));
    }
    setPlayerToRemove(null);
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;

    setIsDeleting(true);
    const { error } = await supabase.from("games").delete().eq("id", gameId);

    if (!error) {
      router.push("/dashboard");
    } else {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleToggleCoGm = async (playerId: string, makeCoGm: boolean) => {
    if (!gameId) return;

    const { error } = await supabase
      .from("game_memberships")
      .update({ is_co_gm: makeCoGm })
      .eq("game_id", gameId)
      .eq("user_id", playerId);

    if (!error) {
      setGame((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === playerId ? { ...m, is_co_gm: makeCoGm } : m
          ),
        };
      });
    }
  };

  const handleToggleSpecialDate = async (date: string) => {
    if (!gameId || !game) return;

    const currentSpecialDates = game.special_play_dates || [];
    const isCurrentlySpecial = currentSpecialDates.includes(date);

    let newSpecialDates: string[];
    if (isCurrentlySpecial) {
      // Remove the date
      newSpecialDates = currentSpecialDates.filter((d) => d !== date);
    } else {
      // Add the date
      newSpecialDates = [...currentSpecialDates, date].sort();
    }

    // Optimistic update
    setGame((prev) => {
      if (!prev) return prev;
      return { ...prev, special_play_dates: newSpecialDates };
    });

    const { error } = await supabase
      .from("games")
      .update({ special_play_dates: newSpecialDates })
      .eq("id", gameId);

    if (error) {
      // Revert on error
      setGame((prev) => {
        if (!prev) return prev;
        return { ...prev, special_play_dates: currentSpecialDates };
      });
    }
  };

  // Show spinner while auth is loading, data is loading, or profile hasn't loaded yet
  if (isLoading || loading || (session && !profile)) {
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
          <div className="flex flex-wrap gap-2">
            {canDoGmActions && (
              <>
                <Button
                  onClick={() => router.push(`/games/${gameId}/edit`)}
                  variant="secondary"
                >
                  Edit
                </Button>
                <Button onClick={copyInviteLink} variant="secondary">
                  {copied ? "Copied!" : "Copy Invite Link"}
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
        <div className="grid gap-6 lg:grid-cols-2">
          <PlayersCard
            allPlayers={allPlayers}
            gmId={game.gm_id}
            isGm={isGm}
            isCoGm={isCoGm}
            members={game.members}
            playerCompletionPercentages={playerCompletionPercentages}
            inviteCode={game.invite_code}
            onToggleCoGm={handleToggleCoGm}
            onRemovePlayer={(player) => setPlayerToRemove(player)}
          />
          <GameDetailsCard
            playDays={game.play_days}
            schedulingWindowMonths={game.scheduling_window_months}
            defaultStartTime={game.default_start_time}
            defaultEndTime={game.default_end_time}
            timezone={game.timezone}
            minPlayersNeeded={game.min_players_needed || 0}
            confirmedSessions={confirmedSessions}
            inviteCode={game.invite_code}
          />
        </div>
      )}

      {activeTab === "availability" && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Mark Your Availability
            </h2>
            <p className="text-muted-foreground">
              Click on dates to cycle through: available → unavailable → maybe.
              Add notes or time constraints by hovering and clicking the pencil icon (or long-press
              on mobile).
            </p>
          </div>
          <AvailabilityCalendar
            playDays={game.play_days}
            windowMonths={game.scheduling_window_months}
            availability={availability}
            onToggle={handleAvailabilityChange}
            confirmedSessions={confirmedSessions}
            specialPlayDates={game.special_play_dates || []}
            isGmOrCoGm={canDoGmActions}
            onToggleSpecialDate={handleToggleSpecialDate}
          />
        </div>
      )}

      {activeTab === "schedule" && (
        <SchedulingSuggestions
          suggestions={suggestions}
          sessions={sessions}
          isGm={canDoGmActions}
          gameName={game.name}
          defaultStartTime={game.default_start_time}
          defaultEndTime={game.default_end_time}
          timezone={game.timezone}
          minPlayersNeeded={game.min_players_needed || 0}
          onConfirm={handleConfirmSession}
          onCancel={handleCancelSession}
        />
      )}

      {/* Leave Game Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-card-foreground mb-2">
              Leave Game?
            </h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to leave <strong>{game.name}</strong>? Your
              availability data will be removed.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={isLeaving}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleLeaveGame}
                disabled={isLeaving}
              >
                {isLeaving ? "Leaving..." : "Leave Game"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Player Confirmation Modal */}
      {playerToRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-card-foreground mb-2">
              Remove Player?
            </h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to remove{" "}
              <strong>{playerToRemove.name}</strong> from this game? Their
              availability data will be deleted.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setPlayerToRemove(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => handleRemovePlayer(playerToRemove.id)}
              >
                Remove Player
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Game Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-card-foreground mb-2">
              Delete Game?
            </h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to permanently delete{" "}
              <strong>{game.name}</strong>? This will remove all players,
              availability data, and scheduled sessions. This action cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleDeleteGame}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Game"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
