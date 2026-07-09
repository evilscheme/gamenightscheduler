'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useGameDerivedState } from '@/hooks/useGameDerivedState';
import { PageLoading } from '@/components/ui';
import { OverviewTabContent } from '@/components/games/overview/OverviewTabContent';
import { AvailabilityTabContent } from '@/components/games/availability/AvailabilityTabContent';
import { ScheduleTabContent } from '@/components/games/schedule/ScheduleTabContent';
import type { AvailabilityEntry } from '@/components/calendar/AvailabilityCalendar';
import type {
  Availability,
  GamePlayDate,
  GameSession,
  GameWithMembers,
} from '@/types';

type Tab = 'overview' | 'availability' | 'schedule';

interface GameSnapshot {
  game: GameWithMembers;
  availability: Availability[];
  sessions: GameSession[];
  playDates: GamePlayDate[];
}

// Read-only admin peek at any game. All data comes from a GET-only admin API
// and every mutation callback is a no-op, so nothing here can modify the game.
const READ_ONLY_ERROR = { success: false as const, error: 'Read-only admin view' };
const noopAsync = async () => {};
const noopMutation = async () => READ_ONLY_ERROR;

export default function AdminGamePeekPage() {
  const { authStatus, profile } = useAuth();
  const { weekStartDay, use24h, timezone: userTimezone } = useUserPreferences();
  const params = useParams();
  const gameId = params.id as string;

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [viewAsUserId, setViewAsUserId] = useState<string>('');

  useAuthRedirect({ requireAdmin: true });

  useEffect(() => {
    async function fetchSnapshot() {
      if (!profile?.is_admin || !gameId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/games/${gameId}`);
        if (res.status === 404) {
          setError('Game not found');
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to fetch game');
        }
        const data: GameSnapshot = await res.json();
        setSnapshot(data);
        setViewAsUserId(data.game.gm_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchSnapshot();
  }, [profile?.is_admin, gameId]);

  const game = snapshot?.game ?? null;
  const allAvailability = useMemo(() => snapshot?.availability ?? [], [snapshot]);
  const sessions = useMemo(() => snapshot?.sessions ?? [], [snapshot]);
  const playDates = useMemo(() => snapshot?.playDates ?? [], [snapshot]);

  const {
    extraDateStrings,
    playDateNotes,
    specialPlayDatesSet,
    windowStart,
    windowEnd,
    completionByUserId,
    suggestions,
  } = useGameDerivedState(game, allAvailability, playDates);

  // The calendar shows one player's availability at a time, keyed by date.
  const viewAsAvailability = useMemo(() => {
    const map: Record<string, AvailabilityEntry> = {};
    for (const a of allAvailability) {
      if (a.user_id !== viewAsUserId) continue;
      map[a.date] = {
        status: a.status,
        comment: a.comment,
        available_after: a.available_after,
        available_until: a.available_until,
      };
    }
    return map;
  }, [allAvailability, viewAsUserId]);

  if (authStatus === 'loading' || !profile?.is_admin) {
    return (
      <PageLoading />
    );
  }

  if (loading) {
    return (
      <PageLoading />
    );
  }

  if (error || !game) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-muted-foreground">{error ?? 'Game not found'}</p>
        <Link href="/admin" className="text-primary hover:underline text-sm mt-2 inline-block">
          ← Back to admin dashboard
        </Link>
      </div>
    );
  }

  const allPlayers = [game.gm, ...game.members];
  const confirmedSessions = sessions.filter((s) => s.status === 'confirmed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Read-only banner */}
      <div
        className="mb-6 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3"
        data-testid="admin-peek-banner"
      >
        <Eye className="size-4 shrink-0 text-primary" />
        <p className="text-sm text-primary">
          Admin read-only view — you can inspect this game, but all actions are disabled.
        </p>
      </div>

      {/* Header */}
      <div className="mb-8">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to admin dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">{game.name}</h1>
        <p className="text-muted-foreground mt-1">GM: {game.gm.name}</p>
        {game.description && (
          <p className="text-muted-foreground mt-4">{game.description}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex gap-4 sm:gap-6">
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

      {activeTab === 'overview' && (
        <OverviewTabContent
          playDays={game.play_days}
          windowStart={windowStart}
          windowEnd={windowEnd}
          allPlayers={allPlayers}
          members={game.members}
          gmId={game.gm_id}
          isGm={false}
          isCoGm={false}
          completionByUserId={completionByUserId}
          inviteCode={game.invite_code}
          onToggleCoGm={noopAsync}
          onRemovePlayer={() => {}}
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
          subscribeUrl=""
        />
      )}

      {activeTab === 'availability' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <label htmlFor="view-as-player" className="text-sm text-muted-foreground">
              Viewing availability for
            </label>
            <select
              id="view-as-player"
              value={viewAsUserId}
              onChange={(e) => setViewAsUserId(e.target.value)}
              className="h-8 px-2 rounded-md border border-border bg-card text-card-foreground text-sm"
              data-testid="peek-view-as-select"
            >
              {allPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === game.gm_id ? ' (GM)' : ''}
                </option>
              ))}
            </select>
          </div>

          <AvailabilityTabContent
            windowStart={windowStart}
            windowEnd={windowEnd}
            currentUserId={viewAsUserId}
            completionByUserId={completionByUserId}
            playDays={game.play_days}
            availability={viewAsAvailability}
            onToggle={() => {}}
            onBulkSet={() => {}}
            confirmedSessions={confirmedSessions}
            extraPlayDates={extraDateStrings}
            isGmOrCoGm={false}
            onToggleExtraDate={() => {}}
            weekStartDay={weekStartDay}
            use24h={use24h}
            otherGames={[]}
            otherGameSessionsByDate={new Map()}
            onCopyFromGame={async () => ({ copied: 0, overridden: 0 })}
            playDateNotes={playDateNotes}
            onUpdatePlayDateNote={() => {}}
            hasCampaignDates={!!(game.campaign_start_date || game.campaign_end_date)}
            adHocOnly={game.ad_hoc_only}
            readOnly
          />
        </div>
      )}

      {activeTab === 'schedule' && (
        <ScheduleTabContent
          suggestions={suggestions}
          sessions={sessions}
          members={[{ ...game.gm, is_co_gm: false }, ...game.members]}
          gmId={game.gm_id}
          isGm={false}
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
          subscribeUrl=""
          onConfirm={noopMutation}
          onUpdateSession={noopMutation}
          onCancel={noopMutation}
        />
      )}
    </div>
  );
}
