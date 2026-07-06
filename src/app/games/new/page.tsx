'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { LoadingSpinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import { fetchUserGameCount, createGame } from '@/lib/data';
import { invalidateGamesLists } from '@/lib/queryKeys';
import {
  SESSION_DEFAULTS,
  USAGE_LIMITS,
  DEFAULT_TIMEZONE,
} from '@/lib/constants';
import { getBrowserTimezone, isValidTimezone } from '@/lib/timezone';
import { validateGameForm } from '@/lib/gameValidation';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { GameForm, type GameFormState } from '@/components/games/forms/GameForm';

function resolveInitialTimezone(userTimezone: string | null | undefined): string {
  if (userTimezone && isValidTimezone(userTimezone)) return userTimezone;
  const browserTz = getBrowserTimezone();
  if (browserTz && isValidTimezone(browserTz)) return browserTz;
  return DEFAULT_TIMEZONE;
}

export default function NewGamePage() {
  const { profile, authStatus } = useAuth();
  const { timezone: userTimezone } = useUserPreferences();
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [gameCount, setGameCount] = useState<number | null>(null);

  useAuthRedirect({ requireGM: true });

  useEffect(() => {
    async function fetchGameCount() {
      if (!profile?.id) return;
      const { count } = await fetchUserGameCount(supabase, profile.id);
      setGameCount(count ?? 0);
    }
    fetchGameCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [profile?.id]);

  const initial: GameFormState = {
    name: '',
    description: '',
    playDays: [],
    adHocOnly: false,
    windowMonths: 2,
    defaultStartTime: SESSION_DEFAULTS.START_TIME,
    defaultEndTime: SESSION_DEFAULTS.END_TIME,
    timezone: resolveInitialTimezone(userTimezone),
    useCustomStart: false,
    useCustomEnd: false,
    campaignStartDate: '',
    campaignEndDate: '',
    minPlayersNeeded: 0,
  };

  const atGameLimit = gameCount !== null && gameCount >= USAGE_LIMITS.MAX_GAMES_PER_USER;

  const handleCreate = async (state: GameFormState) => {
    if (!profile?.id) return;

    const validation = validateGameForm({
      name: state.name,
      description: state.description,
      playDays: state.playDays,
      adHocOnly: state.adHocOnly,
      campaignStartDate: state.campaignStartDate || null,
      campaignEndDate: state.campaignEndDate || null,
      useCustomStart: state.useCustomStart,
      useCustomEnd: state.useCustomEnd,
    });
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    if (atGameLimit) {
      setError(
        `You have reached the maximum of ${USAGE_LIMITS.MAX_GAMES_PER_USER} games. Please delete an existing game to create a new one.`,
      );
      return;
    }

    setCreating(true);
    setError('');

    const inviteCode = nanoid(10);
    const { data: createdGame, error: insertError } = await createGame(supabase, {
      name: state.name.trim(),
      description: state.description.trim() || null,
      gm_id: profile.id,
      play_days: state.playDays.sort((a, b) => a - b),
      ad_hoc_only: state.adHocOnly,
      invite_code: inviteCode,
      scheduling_window_months: state.windowMonths,
      campaign_start_date: state.campaignStartDate || null,
      campaign_end_date: state.campaignEndDate || null,
      default_start_time: state.defaultStartTime,
      default_end_time: state.defaultEndTime,
      timezone: state.timezone || null,
    });

    if (insertError) {
      if (insertError.code === '42501') {
        setError(
          `You have reached the maximum of ${USAGE_LIMITS.MAX_GAMES_PER_USER} games. Please delete an existing game to create a new one.`,
        );
      } else {
        setError('Failed to create game. Please try again.');
      }
      setCreating(false);
      return;
    }

    // The cached games lists don't include the new game yet.
    invalidateGamesLists(queryClient);

    router.push(`/games/${createdGame?.id || '/dashboard'}`);
  };

  if (authStatus === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Create New Game</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a new game so your party can mark availability and schedule sessions.
        </p>
      </div>

      {atGameLimit && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <p className="text-sm text-danger">
            You have reached the maximum of {USAGE_LIMITS.MAX_GAMES_PER_USER} games. Please delete
            an existing game before creating a new one.
          </p>
        </div>
      )}

      <GameForm
        mode="create"
        initial={initial}
        busy={creating}
        error={error}
        disabledReason={
          atGameLimit
            ? 'Game limit reached — remove a game to unlock this.'
            : null
        }
        onSubmit={handleCreate}
        onCancel={() => router.back()}
      />
    </div>
  );
}
