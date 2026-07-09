'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateGamesLists, queryKeys } from '@/lib/queryKeys';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import {
  Button,
  EyebrowLabel,
  LoadingSpinner,
  Modal,
  useToast,
} from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { Game } from '@/types';
import {
  fetchGameWithGM,
  checkCoGmStatus,
  fetchFutureSessions,
  upsertPlayDate,
  updateGame,
  regenerateInviteCode,
  deleteGame as deleteGameQuery,
} from '@/lib/data';
import { SESSION_DEFAULTS, DEFAULT_TIMEZONE } from '@/lib/constants';
import { validateGameForm } from '@/lib/gameValidation';
import { nanoid } from 'nanoid';
import { GameForm, type GameFormState } from '@/components/games/forms/GameForm';

function gameToFormState(game: Game): GameFormState {
  return {
    name: game.name,
    description: game.description || '',
    playDays: game.play_days,
    adHocOnly: game.ad_hoc_only || false,
    windowMonths: game.scheduling_window_months,
    defaultStartTime: game.default_start_time?.slice(0, 5) || SESSION_DEFAULTS.START_TIME,
    defaultEndTime: game.default_end_time?.slice(0, 5) || SESSION_DEFAULTS.END_TIME,
    timezone: game.timezone || DEFAULT_TIMEZONE,
    useCustomStart: !!game.campaign_start_date,
    useCustomEnd: !!game.campaign_end_date,
    campaignStartDate: game.campaign_start_date || '',
    campaignEndDate: game.campaign_end_date || '',
    minPlayersNeeded: game.min_players_needed || 0,
  };
}

export default function EditGamePage() {
  const { profile, authStatus } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversionMessage, setConversionMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toast = useToast();
  useAuthRedirect();

  useEffect(() => {
    async function fetchGame() {
      if (!gameId || !profile?.id) return;

      const { data, error: fetchError } = await fetchGameWithGM(supabase, gameId);
      if (fetchError || !data) {
        router.push('/dashboard');
        return;
      }

      const isGm = data.gm_id === profile.id;
      if (!isGm) {
        const { data: isCoGm } = await checkCoGmStatus(supabase, gameId, profile.id);
        if (!isCoGm) {
          router.push(`/games/${gameId}`);
          return;
        }
      }

      setGame(data);
      setLoading(false);
    }

    if (profile?.id) {
      fetchGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [gameId, profile?.id, router]);

  const handleSave = async (state: GameFormState) => {
    if (!profile?.id || !game) return;

    const validation = validateGameForm({
      name: state.name,
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

    setSaving(true);
    setError('');
    setConversionMessage(null);

    if (state.adHocOnly && !game.ad_hoc_only) {
      const today = new Date().toISOString().split('T')[0];
      const { data: futureSessions } = await fetchFutureSessions(supabase, gameId, today);
      if (futureSessions && futureSessions.length > 0) {
        const sessionDates = futureSessions.map((s) => s.date);
        for (const date of sessionDates) {
          await upsertPlayDate(supabase, gameId, date, null);
        }
        setConversionMessage(
          `${sessionDates.length} confirmed session date${sessionDates.length !== 1 ? 's were' : ' was'} preserved as play dates.`,
        );
      }
    }

    const { error: updateError } = await updateGame(supabase, gameId, {
      name: state.name.trim(),
      description: state.description.trim() || null,
      play_days: state.adHocOnly ? [] : state.playDays.sort((a, b) => a - b),
      scheduling_window_months: state.windowMonths,
      campaign_start_date: state.campaignStartDate || null,
      campaign_end_date: state.campaignEndDate || null,
      default_start_time: state.defaultStartTime,
      default_end_time: state.defaultEndTime,
      timezone: state.timezone || null,
      min_players_needed: state.minPlayersNeeded,
      ad_hoc_only: state.adHocOnly,
    });

    if (updateError) {
      setError('Failed to save changes. Please try again.');
      setSaving(false);
      return;
    }

    // The game page and games lists hold cached copies of this game's settings;
    // the ad-hoc conversion above may also have added play dates.
    queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.playDates(gameId) });
    invalidateGamesLists(queryClient);

    router.push(`/games/${gameId}`);
  };

  const handleRegenerateInvite = async () => {
    if (!game) return;
    setIsRegenerating(true);
    const newCode = nanoid(10);
    const { error: regenError } = await regenerateInviteCode(supabase, gameId, newCode);
    setIsRegenerating(false);
    setShowRegenerateConfirm(false);
    if (regenError) {
      toast.show('Could not regenerate invite code. Please try again.', 'danger');
      return;
    }
    setGame({ ...game, invite_code: newCode });
    queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
    toast.show('Invite code regenerated. The old link no longer works.');
  };

  const handleDeleteGame = async () => {
    setIsDeleting(true);
    const { error: deleteError } = await deleteGameQuery(supabase, gameId);
    if (deleteError) {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      toast.show('Could not delete the game. Please try again.', 'danger');
      return;
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
    invalidateGamesLists(queryClient);
    router.push('/dashboard');
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!game) return null;

  const isOwner = game.gm_id === profile?.id;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Edit Game</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update {game.name}&apos;s settings, schedule, or session defaults.
        </p>
      </div>

      <GameForm
        mode="edit"
        initial={gameToFormState(game)}
        busy={saving}
        error={error}
        noticeMessage={conversionMessage}
        onSubmit={handleSave}
        onCancel={() => router.push(`/games/${gameId}`)}
      />

      <section className="mt-6 rounded-xl border border-danger/40 bg-card p-4 sm:p-6">
        <EyebrowLabel variant="danger" className="mb-4 block">Danger Zone</EyebrowLabel>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="sm:max-w-md">
              <p className="text-sm font-medium text-foreground">Regenerate invite code</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this if the invite link has been shared somewhere it shouldn&apos;t be. The
                old link stops working immediately. Players already in the game keep access,
                but anyone holding the old link will be cut off, and calendar subscribers will
                need to re-subscribe with the new URL.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowRegenerateConfirm(true)}
              className="shrink-0"
            >
              Regenerate invite code
            </Button>
          </div>

          {isOwner && (
            <>
              <div className="border-t border-danger/20" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="sm:max-w-md">
                  <p className="text-sm font-medium text-foreground">Delete game</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Permanently delete this game and all of its players, availability data,
                    and scheduled sessions. This cannot be undone.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="shrink-0"
                >
                  Delete game
                </Button>
              </div>
            </>
          )}
        </div>
      </section>

      <Modal
        open={showRegenerateConfirm}
        onClose={() => !isRegenerating && setShowRegenerateConfirm(false)}
        title="Regenerate invite code?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowRegenerateConfirm(false)}
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRegenerateInvite} disabled={isRegenerating}>
              {isRegenerating ? 'Regenerating...' : 'Regenerate'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This will invalidate the current invite link and calendar subscription URL. Anyone
          using the old link will no longer be able to join, and calendar apps will need to
          re-subscribe with the new URL.
        </p>
      </Modal>

      <Modal
        open={showDeleteConfirm}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
        title="Delete game?"
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
              {isDeleting ? 'Deleting...' : 'Delete game'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to permanently delete <strong>{game.name}</strong>? This will
          remove all players, availability data, and scheduled sessions. This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
