'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Button, Card, CardContent, CardHeader, Input, LoadingSpinner, Textarea } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { Game } from '@/types';
import { DAY_OPTIONS, SESSION_DEFAULTS, TIMEZONE_GROUPS, DEFAULT_TIMEZONE, USAGE_LIMITS, SCHEDULING_WINDOW_OPTIONS } from '@/lib/constants';
import { validateGameForm } from '@/lib/gameValidation';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export default function EditGamePage() {
  const { profile, authStatus } = useAuth();
  const { weekStartDay } = useUserPreferences();
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;
  const supabase = createClient();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [playDays, setPlayDays] = useState<number[]>([]);
  const [windowMonths, setWindowMonths] = useState(2);
  const [defaultStartTime, setDefaultStartTime] = useState<string>(SESSION_DEFAULTS.START_TIME);
  const [defaultEndTime, setDefaultEndTime] = useState<string>(SESSION_DEFAULTS.END_TIME);
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [minPlayersNeeded, setMinPlayersNeeded] = useState(0);
  const [adHocOnly, setAdHocOnly] = useState(false);
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [useCustomEnd, setUseCustomEnd] = useState(false);
  const [campaignStartDate, setCampaignStartDate] = useState<string>("");
  const [campaignEndDate, setCampaignEndDate] = useState<string>("");
  const [conversionMessage, setConversionMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useAuthRedirect();

  useEffect(() => {
    async function fetchGame() {
      if (!gameId || !profile?.id) return;

      const { data, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (fetchError || !data) {
        router.push('/dashboard');
        return;
      }

      // Check if user is GM or co-GM
      const isGm = data.gm_id === profile.id;

      if (!isGm) {
        // Check if user is a co-GM
        const { data: membership } = await supabase
          .from('game_memberships')
          .select('is_co_gm')
          .eq('game_id', gameId)
          .eq('user_id', profile.id)
          .single();

        if (!membership?.is_co_gm) {
          router.push(`/games/${gameId}`);
          return;
        }
      }

      setGame(data);
      setName(data.name);
      setDescription(data.description || '');
      setPlayDays(data.play_days);
      setWindowMonths(data.scheduling_window_months);
      setDefaultStartTime(data.default_start_time?.slice(0, 5) || SESSION_DEFAULTS.START_TIME);
      setDefaultEndTime(data.default_end_time?.slice(0, 5) || SESSION_DEFAULTS.END_TIME);
      setTimezone(data.timezone || DEFAULT_TIMEZONE);
      setMinPlayersNeeded(data.min_players_needed || 0);
      setAdHocOnly(data.ad_hoc_only || false);
      setCampaignStartDate(data.campaign_start_date || "");
      setCampaignEndDate(data.campaign_end_date || "");
      setUseCustomStart(!!data.campaign_start_date);
      setUseCustomEnd(!!data.campaign_end_date);
      setLoading(false);
    }

    if (profile?.id) {
      fetchGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is stable
  }, [gameId, profile?.id, router]);

  const toggleDay = (day: number) => {
    setPlayDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  // Reorder day options based on user's week start preference
  const orderedDayOptions = weekStartDay === 0
    ? DAY_OPTIONS
    : [...DAY_OPTIONS.slice(weekStartDay), ...DAY_OPTIONS.slice(0, weekStartDay)];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !game) return;

    const validation = validateGameForm({
      name,
      playDays,
      adHocOnly,
      campaignStartDate: campaignStartDate || null,
      campaignEndDate: campaignEndDate || null,
    });
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    setSaving(true);
    setError('');
    setConversionMessage(null);

    // When switching to ad-hoc mode, preserve confirmed session dates as special play dates
    if (adHocOnly && !game.ad_hoc_only) {
      const { data: futureSessions } = await supabase
        .from('sessions')
        .select('date')
        .eq('game_id', gameId)
        .gte('date', new Date().toISOString().split('T')[0]);

      if (futureSessions && futureSessions.length > 0) {
        const sessionDates = futureSessions.map((s) => s.date);
        for (const date of sessionDates) {
          await supabase
            .from('game_play_dates')
            .upsert({ game_id: gameId, date }, { onConflict: 'game_id,date' });
        }
        setConversionMessage(
          `${sessionDates.length} confirmed session date${sessionDates.length !== 1 ? 's were' : ' was'} preserved as play dates.`
        );
      }
    }

    const { error: updateError } = await supabase
      .from('games')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        play_days: adHocOnly ? [] : playDays.sort((a, b) => a - b),
        scheduling_window_months: windowMonths,
        campaign_start_date: campaignStartDate || null,
        campaign_end_date: campaignEndDate || null,
        default_start_time: defaultStartTime,
        default_end_time: defaultEndTime,
        timezone: timezone || null,
        min_players_needed: minPlayersNeeded,
        ad_hoc_only: adHocOnly,
      })
      .eq('id', gameId);

    if (updateError) {
      setError('Failed to save changes. Please try again.');
      setSaving(false);
      return;
    }

    router.push(`/games/${gameId}`);
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!game) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">Edit Game</h1>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Game Settings</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <Input
              label="Game Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Friday Night Board Games"
              required
            />

            <Textarea
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your game..."
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
                  With ad-hoc scheduling, players mark availability on specific dates added by the GM from the calendar. No recurring play days are needed.
                </p>
              </div>
            )}

            {conversionMessage && (
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <p className="text-sm text-primary">
                  {conversionMessage}
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
                Players mark availability on these days. You can add special one-off dates from the calendar.
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

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Minimum Players Needed
              </label>
              <input
                type="number"
                min="0"
                max={USAGE_LIMITS.MAX_PLAYERS_PER_GAME}
                value={minPlayersNeeded}
                onChange={(e) => setMinPlayersNeeded(Math.max(0, Math.min(USAGE_LIMITS.MAX_PLAYERS_PER_GAME, parseInt(e.target.value) || 0)))}
                className="w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Dates with fewer available players will be ranked lower. Set to 0 to disable.
              </p>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/games/${gameId}`)}
                disabled={saving}
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
