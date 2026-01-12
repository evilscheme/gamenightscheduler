'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button, Card, CardContent, CardHeader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Game, User, Availability, GameSession, DateSuggestion } from '@/types';
import { AvailabilityCalendar } from '@/components/calendar/AvailabilityCalendar';
import { SchedulingSuggestions } from '@/components/games/SchedulingSuggestions';
import {
  addMonths,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isAfter,
  startOfDay,
} from 'date-fns';

interface GameWithMembers extends Game {
  gm: User;
  members: User[];
}

type Tab = 'overview' | 'availability' | 'schedule';

export default function GameDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<GameWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [allAvailability, setAllAvailability] = useState<Availability[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [suggestions, setSuggestions] = useState<DateSuggestion[]>([]);
  const [copied, setCopied] = useState(false);

  const isGm = game?.gm_id === session?.user?.id;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchData = useCallback(async () => {
    if (!gameId || !session?.user?.id) return;

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
      .eq('user_id', session.user.id);

    const availMap: Record<string, boolean> = {};
    userAvail?.forEach((a) => {
      availMap[a.date] = a.is_available;
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
  }, [gameId, session?.user?.id, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchData();
    }
  }, [session?.user?.id, fetchData]);

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
        const availablePlayers: User[] = [];
        const unavailablePlayers: User[] = [];

        allPlayers.forEach((player) => {
          const playerAvail = allAvailability.find(
            (a) => a.user_id === player.id && a.date === dateStr
          );
          // If no record, treat as available (optimistic default)
          if (!playerAvail || playerAvail.is_available) {
            availablePlayers.push(player);
          } else {
            unavailablePlayers.push(player);
          }
        });

        return {
          date: dateStr,
          dayOfWeek: getDay(date),
          availableCount: availablePlayers.length,
          totalPlayers: allPlayers.length,
          availablePlayers,
          unavailablePlayers,
        };
      })
      .sort((a, b) => {
        // Sort by availability count (descending), then by date (ascending)
        if (b.availableCount !== a.availableCount) {
          return b.availableCount - a.availableCount;
        }
        return a.date.localeCompare(b.date);
      });

    setSuggestions(suggestionList);
  }, [game, allAvailability]);

  const handleAvailabilityChange = async (date: string, isAvailable: boolean) => {
    if (!session?.user?.id || !gameId) return;

    // Optimistic update
    setAvailability((prev) => ({ ...prev, [date]: isAvailable }));

    const { error } = await supabase.from('availability').upsert(
      {
        user_id: session.user.id,
        game_id: gameId,
        date,
        is_available: isAvailable,
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
          (a) => a.user_id === session.user.id && a.date === date
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], is_available: isAvailable };
          return updated;
        }
        return [
          ...prev,
          {
            id: 'temp',
            user_id: session.user.id,
            game_id: gameId,
            date,
            is_available: isAvailable,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      });
    }
  };

  const handleConfirmSession = async (date: string) => {
    if (!session?.user?.id || !gameId) return;

    const { data, error } = await supabase
      .from('sessions')
      .upsert(
        {
          game_id: gameId,
          date,
          status: 'confirmed',
          confirmed_by: session.user.id,
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
    if (!session?.user?.id || !gameId) return;

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
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!game) return null;

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
          {isGm && (
            <Button onClick={copyInviteLink} variant="secondary">
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </Button>
          )}
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
                    <span className="text-card-foreground">{player.name}</span>
                    {player.id === game.gm_id && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        GM
                      </span>
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
                <p className="text-card-foreground">{game.play_days.map((d) => DAYS[d]).join(', ')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scheduling Window</p>
                <p className="text-card-foreground">{game.scheduling_window_months} month(s) ahead</p>
              </div>
              {confirmedSessions.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming Sessions</p>
                  <ul className="mt-1 space-y-1">
                    {confirmedSessions.slice(0, 3).map((s) => (
                      <li key={s.id} className="text-card-foreground">
                        {format(new Date(s.date), 'EEEE, MMMM d, yyyy')}
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
              Click on dates to toggle your availability. Green means you're available, red means
              you're not. Gray days are not play days for this game.
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
          onConfirm={handleConfirmSession}
          onCancel={handleCancelSession}
          gameId={gameId}
        />
      )}
    </div>
  );
}
