'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Button, Card, CardContent, CardHeader, Input, LoadingSpinner, Textarea } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { Game } from '@/types';
import { DAY_OPTIONS, SESSION_DEFAULTS } from '@/lib/constants';

export default function EditGamePage() {
  const { profile, isLoading, session } = useAuth();
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !game) return;

    if (!name.trim()) {
      setError('Please enter a game name');
      return;
    }

    if (playDays.length === 0) {
      setError('Please select at least one play day');
      return;
    }

    setSaving(true);
    setError('');

    const { error: updateError } = await supabase
      .from('games')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        play_days: playDays.sort((a, b) => a - b),
        scheduling_window_months: windowMonths,
        default_start_time: defaultStartTime,
        default_end_time: defaultEndTime,
      })
      .eq('id', gameId);

    if (updateError) {
      setError('Failed to save changes. Please try again.');
      setSaving(false);
      return;
    }

    router.push(`/games/${gameId}`);
  };

  if (isLoading || loading || (session && !profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner />
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
                Players will only be able to mark availability on these days
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
