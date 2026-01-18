'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Button, Card, CardContent, CardHeader, LoadingSpinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { User, Availability, AvailabilityStatus, GameSession, DateSuggestion, GameWithMembers } from '@/types';
import { AvailabilityCalendar, AvailabilityEntry } from '@/components/calendar/AvailabilityCalendar';
import { SchedulingSuggestions } from '@/components/games/SchedulingSuggestions';
import {
  addMonths,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isAfter,
  startOfDay,
  parseISO,
} from 'date-fns';
import { DAY_LABELS, TIMEOUTS } from '@/lib/constants';

type Tab = 'overview' | 'availability' | 'schedule';

export default function GameDetailPage() {
  const { profile, isLoading, session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;
  const supabase = createClient();

  const [game, setGame] = useState<GameWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [availability, setAvailability] = useState<Record<string, AvailabilityEntry>>({});
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
  const isMember = game?.members.some((m) => m.id === profile?.id);

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  useAuthRedirect();

  const fetchData = useCallback(async () => {
    if (!gameId || !profile?.id) return;

    // Fetch game with GM
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*, gm:users!games_gm_id_fkey(*)')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      router.push('/dashboard');
      return;
    }

    // Fetch members
    const { data: memberships } = await supabase
      .from('game_memberships')
      .select('user_id, users(*)')
      .eq('game_id', gameId);

    const members = memberships?.map((m) => m.users as unknown as User) || [];

    setGame({ ...gameData, members } as GameWithMembers);

    // Fetch user's availability
    const { data: userAvail } = await supabase
      .from('availability')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', profile.id);

    const availMap: Record<string, AvailabilityEntry> = {};
    userAvail?.forEach((a) => {
      availMap[a.date] = { status: a.status, comment: a.comment };
    });
    setAvailability(availMap);

    // Fetch all availability for suggestions
    const { data: allAvail } = await supabase.from('availability').select('*').eq('game_id', gameId);

    setAllAvailability(allAvail || []);

    // Fetch sessions
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('*')
      .eq('game_id', gameId)
      .order('date', { ascending: true });

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

    const playDates = eachDayOfInterval({ start: today, end: endDate }).filter((date) =>
      game.play_days.includes(getDay(date))
    );

    const suggestionList: DateSuggestion[] = playDates
      .filter((date) => isAfter(date, today) || format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'))
      .map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const availablePlayers: { user: User; comment: string | null }[] = [];
        const maybePlayers: { user: User; comment: string | null }[] = [];
        const unavailablePlayers: { user: User; comment: string | null }[] = [];
        const pendingPlayers: User[] = [];

        allPlayers.forEach((player) => {
          const playerAvail = allAvailability.find(
            (a) => a.user_id === player.id && a.date === dateStr
          );
          // No record = pending (hasn't responded yet)
          if (!playerAvail) {
            pendingPlayers.push(player);
          } else if (playerAvail.status === 'available') {
            availablePlayers.push({ user: player, comment: playerAvail.comment });
          } else if (playerAvail.status === 'maybe') {
            maybePlayers.push({ user: player, comment: playerAvail.comment });
          } else {
            unavailablePlayers.push({ user: player, comment: playerAvail.comment });
          }
        });

        return {
          date: dateStr,
          dayOfWeek: getDay(date),
          availableCount: availablePlayers.length,
          maybeCount: maybePlayers.length,
          unavailableCount: unavailablePlayers.length,
          pendingCount: pendingPlayers.length,
          totalPlayers: allPlayers.length,
          availablePlayers,
          maybePlayers,
          unavailablePlayers,
          pendingPlayers,
        };
      })
      .sort((a, b) => {
        // Sort by available count (descending), then by maybe count, then by pending count (ascending), then by date
        if (b.availableCount !== a.availableCount) {
          return b.availableCount - a.availableCount;
        }
        if (b.maybeCount !== a.maybeCount) {
          return b.maybeCount - a.maybeCount;
        }
        if (a.pendingCount !== b.pendingCount) {
          return a.pendingCount - b.pendingCount;
        }
        return a.date.localeCompare(b.date);
      });

    setSuggestions(suggestionList);
  }, [game, allAvailability]);

  const handleAvailabilityChange = async (date: string, status: AvailabilityStatus, comment: string | null) => {
    if (!profile?.id || !gameId) return;

    // Optimistic update
    setAvailability((prev) => ({ ...prev, [date]: { status, comment } }));

    const { error } = await supabase.from('availability').upsert(
      {
        user_id: profile.id,
        game_id: gameId,
        date,
        status,
        comment,
      },
      { onConflict: 'user_id,game_id,date' }
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
          updated[existing] = { ...updated[existing], status, comment };
          return updated;
        }
        return [
          ...prev,
          {
            id: 'temp',
            user_id: profile.id,
            game_id: gameId,
            date,
            status,
            comment,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      });
    }
  };

  const handleConfirmSession = async (date: string, startTime: string, endTime: string) => {
    if (!profile?.id || !gameId) return;

    const { data, error } = await supabase
      .from('sessions')
      .upsert(
        {
          game_id: gameId,
          date,
          start_time: startTime,
          end_time: endTime,
          status: 'confirmed',
          confirmed_by: profile.id,
        },
        { onConflict: 'game_id,date' }
      )
      .select()
      .single();

    if (!error && data) {
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
  };

  const handleCancelSession = async (date: string) => {
    if (!profile?.id || !gameId) return;

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('game_id', gameId)
      .eq('date', date);

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
      .from('game_memberships')
      .delete()
      .eq('game_id', gameId)
      .eq('user_id', profile.id);

    if (!error) {
      router.push('/dashboard');
    } else {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!gameId) return;

    const { error } = await supabase
      .from('game_memberships')
      .delete()
      .eq('game_id', gameId)
      .eq('user_id', playerId);

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
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (!error) {
      router.push('/dashboard');
    } else {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Show spinner while auth is loading, data is loading, or profile hasn't loaded yet
  if (isLoading || loading || (session && !profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!game) return null;

  const allPlayers = [game.gm, ...game.members];
  const confirmedSessions = sessions.filter((s) => s.status === 'confirmed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{game.name}</h1>
            <p className="text-muted-foreground mt-1">
              GM: {game.gm.name}
              {isGm && ' (You)'}
            </p>
          </div>
          <div className="flex gap-2">
            {isGm && (
              <>
                <Button onClick={() => router.push(`/games/${gameId}/edit`)} variant="secondary">
                  Edit
                </Button>
                <Button onClick={copyInviteLink} variant="secondary">
                  {copied ? 'Copied!' : 'Copy Invite Link'}
                </Button>
                <Button onClick={() => setShowDeleteConfirm(true)} variant="danger">
                  Delete Game
                </Button>
              </>
            )}
            {isMember && !isGm && (
              <Button onClick={() => setShowLeaveConfirm(true)} variant="danger">
                Leave Game
              </Button>
            )}
          </div>
        </div>
        {game.description && <p className="text-muted-foreground mt-4">{game.description}</p>}
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex gap-6">
          {(['overview', 'availability', 'schedule'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-card-foreground">Players ({allPlayers.length})</h2>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {allPlayers.map((player) => (
                  <li key={player.id} className="py-3 flex items-center gap-3">
                    {player.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external avatar URL
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
                    <span className="flex-1 text-card-foreground">{player.name}</span>
                    {player.id === game.gm_id && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        GM
                      </span>
                    )}
                    {isGm && player.id !== game.gm_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlayerToRemove(player)}
                        className="text-danger hover:text-danger hover:bg-danger/10"
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-card-foreground">Game Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Play Days</p>
                <p className="text-card-foreground">{game.play_days.map((d) => DAY_LABELS.full[d]).join(', ')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scheduling Window</p>
                <p className="text-card-foreground">{game.scheduling_window_months} month(s) ahead</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Default Session Time</p>
                <p className="text-card-foreground">
                  {formatTime(game.default_start_time)} - {formatTime(game.default_end_time)}
                </p>
              </div>
              {confirmedSessions.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming Sessions</p>
                  <ul className="mt-1 space-y-1">
                    {confirmedSessions.slice(0, 3).map((s) => (
                      <li key={s.id} className="text-card-foreground">
                        {format(parseISO(s.date), 'EEEE, MMMM d, yyyy')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'availability' && (
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Mark Your Availability</h2>
            <p className="text-muted-foreground">
              Click on dates to cycle through: unavailable (red) → maybe (yellow) → available (green) → unavailable.
              For &quot;maybe&quot; dates, you can add an optional note. Gray days are not play days for this game.
            </p>
          </div>
          <AvailabilityCalendar
            playDays={game.play_days}
            windowMonths={game.scheduling_window_months}
            availability={availability}
            onToggle={handleAvailabilityChange}
            confirmedSessions={confirmedSessions}
          />
        </div>
      )}

      {activeTab === 'schedule' && (
        <SchedulingSuggestions
          suggestions={suggestions}
          sessions={sessions}
          isGm={isGm}
          gameName={game.name}
          defaultStartTime={game.default_start_time}
          defaultEndTime={game.default_end_time}
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
              Are you sure you want to leave <strong>{game.name}</strong>? Your availability data will be removed.
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
                {isLeaving ? 'Leaving...' : 'Leave Game'}
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
              Are you sure you want to remove <strong>{playerToRemove.name}</strong> from this game? Their availability data will be deleted.
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
              Are you sure you want to permanently delete <strong>{game.name}</strong>? This will remove all players, availability data, and scheduled sessions. This action cannot be undone.
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
                {isDeleting ? 'Deleting...' : 'Delete Game'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
