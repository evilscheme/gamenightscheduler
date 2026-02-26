'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Button, Card, CardContent, CardHeader, Input, LoadingSpinner, Textarea } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import { DAY_OPTIONS, SESSION_DEFAULTS, USAGE_LIMITS, TEXT_LIMITS, TIMEZONE_GROUPS, DEFAULT_TIMEZONE, SCHEDULING_WINDOW_OPTIONS } from '@/lib/constants';
import { getBrowserTimezone, isValidTimezone } from '@/lib/timezone';
import { validateGameForm } from '@/lib/gameValidation';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export default function NewGamePage() {
  const { profile, authStatus } = useAuth();
  const { weekStartDay, timezone: userTimezone } = useUserPreferences();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [playDays, setPlayDays] = useState<number[]>([]);
  const [adHocOnly, setAdHocOnly] = useState(false);
  const [windowMonths, setWindowMonths] = useState(2);
  const [defaultStartTime, setDefaultStartTime] = useState<string>(SESSION_DEFAULTS.START_TIME);
  const [defaultEndTime, setDefaultEndTime] = useState<string>(SESSION_DEFAULTS.END_TIME);
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [tzInitialized, setTzInitialized] = useState(false);
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [useCustomEnd, setUseCustomEnd] = useState(false);
  const [campaignStartDate, setCampaignStartDate] = useState<string>("");
  const [campaignEndDate, setCampaignEndDate] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [gameCount, setGameCount] = useState<number | null>(null);

  useAuthRedirect({ requireGM: true });

  // Initialize timezone: user preference > browser detection > default
  // This is a valid pattern for form initialization from async profile data
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!tzInitialized) {
      if (userTimezone && isValidTimezone(userTimezone)) {
        setTimezone(userTimezone);
        setTzInitialized(true);
      } else {
        const browserTz = getBrowserTimezone();
        if (browserTz && isValidTimezone(browserTz)) {
          setTimezone(browserTz);
        }
        setTzInitialized(true);
      }
    }
  }, [userTimezone, tzInitialized]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reorder day options based on user's week start preference
  const orderedDayOptions = weekStartDay === 0
    ? DAY_OPTIONS
    : [...DAY_OPTIONS.slice(weekStartDay), ...DAY_OPTIONS.slice(0, weekStartDay)];

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

    const validation = validateGameForm({
      name,
      description,
      playDays,
      adHocOnly,
      campaignStartDate: campaignStartDate || null,
      campaignEndDate: campaignEndDate || null,
    });
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
        ad_hoc_only: adHocOnly,
        invite_code: inviteCode,
        scheduling_window_months: windowMonths,
        campaign_start_date: campaignStartDate || null,
        campaign_end_date: campaignEndDate || null,
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

  if (authStatus === 'loading') {
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

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-label="Ad-hoc scheduling only"
                aria-checked={adHocOnly}
                onClick={() => {
                  const next = !adHocOnly;
                  setAdHocOnly(next);
                  if (next) setPlayDays([]);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                  adHocOnly ? 'bg-primary' : 'bg-secondary'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    adHocOnly ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Ad-hoc scheduling only
                </label>
                <p className="text-sm text-muted-foreground">
                  No fixed play days &mdash; schedule sessions on any date
                </p>
              </div>
            </div>

            {adHocOnly && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="text-sm text-warning">
                  No dates will appear on the calendar automatically. You&apos;ll need to add each potential play date manually from the game calendar using the + button.
                </p>
              </div>
            )}

            {!adHocOnly && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Which days can your group play?
                </label>
                <div className="flex flex-wrap gap-2">
                  {orderedDayOptions.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={playDays.includes(day.value)}
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
            )}

            <div>
              <label htmlFor="scheduling-window" className="block text-sm font-medium text-foreground mb-1">
                Scheduling Window
              </label>
              <select
                id="scheduling-window"
                value={windowMonths}
                onChange={(e) => setWindowMonths(Number(e.target.value))}
                className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              >
                {SCHEDULING_WINDOW_OPTIONS.map((months) => (
                  <option key={months} value={months}>
                    {months} {months === 1 ? "month" : "months"} ahead
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground mt-1">
                How far in advance players can mark their availability
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Campaign Dates
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-label="Custom start date"
                  aria-checked={useCustomStart}
                  onClick={() => {
                    const next = !useCustomStart;
                    setUseCustomStart(next);
                    if (!next) setCampaignStartDate("");
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                    useCustomStart ? 'bg-primary' : 'bg-secondary'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useCustomStart ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div>
                  <label className="text-sm text-foreground">Custom start date</label>
                  <p className="text-xs text-muted-foreground">
                    {useCustomStart ? "Calendar starts on this date" : "Starts immediately"}
                  </p>
                </div>
              </div>
              {useCustomStart && (
                <input
                  type="date"
                  id="campaign-start"
                  value={campaignStartDate}
                  onChange={(e) => setCampaignStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                />
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-label="Custom end date"
                  aria-checked={useCustomEnd}
                  onClick={() => {
                    const next = !useCustomEnd;
                    setUseCustomEnd(next);
                    if (!next) setCampaignEndDate("");
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                    useCustomEnd ? 'bg-primary' : 'bg-secondary'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useCustomEnd ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div>
                  <label className="text-sm text-foreground">Custom end date</label>
                  <p className="text-xs text-muted-foreground">
                    {useCustomEnd ? "Calendar ends on this date" : "Runs indefinitely"}
                  </p>
                </div>
              </div>
              {useCustomEnd && (
                <input
                  type="date"
                  id="campaign-end"
                  value={campaignEndDate}
                  min={campaignStartDate || undefined}
                  onChange={(e) => setCampaignEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Default Session Time
              </label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="default-start-time" className="block text-sm text-muted-foreground mb-1">
                    Start Time
                  </label>
                  <input
                    id="default-start-time"
                    type="time"
                    value={defaultStartTime}
                    onChange={(e) => setDefaultStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="default-end-time" className="block text-sm text-muted-foreground mb-1">
                    End Time
                  </label>
                  <input
                    id="default-end-time"
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
              <label htmlFor="timezone" className="block text-sm font-medium text-foreground mb-1">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              >
                {TIMEZONE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </optgroup>
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
