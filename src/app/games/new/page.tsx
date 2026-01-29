'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Button, Card, CardContent, CardHeader, Input, LoadingSpinner, Textarea } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import { DAY_OPTIONS, SESSION_DEFAULTS, USAGE_LIMITS, TEXT_LIMITS, TIMEZONE_OPTIONS, DEFAULT_TIMEZONE } from '@/lib/constants';
import { getBrowserTimezone, isValidTimezone } from '@/lib/timezone';
import { validateGameForm } from '@/lib/gameValidation';

export default function NewGamePage() {
  const { profile, isLoading, session } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [playDays, setPlayDays] = useState<number[]>([]);
  const [windowMonths, setWindowMonths] = useState(2);
  const [defaultStartTime, setDefaultStartTime] = useState<string>(SESSION_DEFAULTS.START_TIME);
  const [defaultEndTime, setDefaultEndTime] = useState<string>(SESSION_DEFAULTS.END_TIME);
  const [timezone, setTimezone] = useState<string>(() => {
    const browserTz = getBrowserTimezone();
    return browserTz && isValidTimezone(browserTz) ? browserTz : DEFAULT_TIMEZONE;
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [gameCount, setGameCount] = useState<number | null>(null);

  useAuthRedirect({ requireGM: true });

  // Fetch the user's current game count to check limits
  useEffect(() => {
    async function fetchGameCount() {
      if (!profile?.id) return;
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('gm_id', profile.id);
      setGameCount(count ?? 0);
    }
    fetchGameCount();
  }, [profile?.id, supabase]);

  const toggleDay = (day: number) => {
    setPlayDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    const validation = validateGameForm({ name, description, playDays });
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    // Check game limit
    if (gameCount !== null && gameCount >= USAGE_LIMITS.MAX_GAMES_PER_USER) {
      setError(`You have reached the maximum of ${USAGE_LIMITS.MAX_GAMES_PER_USER} games. Please delete an existing game to create a new one.`);
      return;
    }

    setCreating(true);
    setError('');

    const inviteCode = nanoid(10);

    const { error: insertError } = await supabase
      .from('games')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        gm_id: profile.id,
        play_days: playDays.sort((a, b) => a - b),
        invite_code: inviteCode,
        scheduling_window_months: windowMonths,
        default_start_time: defaultStartTime,
        default_end_time: defaultEndTime,
        timezone: timezone || null,
      });

    if (insertError) {
      // Check if it's a policy violation (likely game limit exceeded)
      if (insertError.code === '42501') {
        setError(`You have reached the maximum of ${USAGE_LIMITS.MAX_GAMES_PER_USER} games. Please delete an existing game to create a new one.`);
      } else {
        setError('Failed to create game. Please try again.');
      }
      setCreating(false);
      return;
    }

    // Fetch the created game by invite code (we can't use .select() on insert due to RLS timing)
    const { data: createdGame } = await supabase
      .from('games')
      .select('id')
      .eq('invite_code', inviteCode)
      .single();

    router.push(`/games/${createdGame?.id || '/dashboard'}`);
  };

  // Show spinner while auth is loading OR while we have a session but profile hasn't loaded yet
  if (isLoading || (session && !profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const atGameLimit = gameCount !== null && gameCount >= USAGE_LIMITS.MAX_GAMES_PER_USER;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">Create New Game</h1>

      {atGameLimit && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg">
          <p className="text-sm text-danger">
            You have reached the maximum of {USAGE_LIMITS.MAX_GAMES_PER_USER} games.
            Please delete an existing game before creating a new one.
          </p>
        </div>
      )}

      <form onSubmit={handleCreate}>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Game Details</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <Input
              label="Game Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Friday Night Board Games"
              maxLength={TEXT_LIMITS.GAME_NAME}
              required
            />

            <Textarea
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your game..."
              maxLength={TEXT_LIMITS.GAME_DESCRIPTION}
              rows={3}
            />

            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Which days can your group play?
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      playDays.includes(day.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Players mark availability on these days. You can add special one-off dates later.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Scheduling Window
              </label>
              <select
                value={windowMonths}
                onChange={(e) => setWindowMonths(Number(e.target.value))}
                className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              >
                <option value={1}>1 month ahead</option>
                <option value={2}>2 months ahead</option>
                <option value={3}>3 months ahead</option>
              </select>
              <p className="text-sm text-muted-foreground mt-1">
                How far in advance players can mark their availability
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Default Session Time
              </label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-muted-foreground mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={defaultStartTime}
                    onChange={(e) => setDefaultStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-muted-foreground mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={defaultEndTime}
                    onChange={(e) => setDefaultEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Default times used when scheduling sessions
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground mt-1">
                Used for calendar exports so events appear at the correct time
              </p>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={creating || atGameLimit} className="flex-1">
                {creating ? 'Creating...' : 'Create Game'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
                disabled={creating}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
