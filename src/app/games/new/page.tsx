'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, Input, LoadingSpinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import { DAY_OPTIONS } from '@/lib/constants';

export default function NewGamePage() {
  const { profile, isLoading, session } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [playDays, setPlayDays] = useState<number[]>([]);
  const [windowMonths, setWindowMonths] = useState(2);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Only redirect if auth is done loading AND there's no session
    if (!isLoading && !session) {
      router.push('/login');
    } else if (!isLoading && profile && !profile.is_gm) {
      // If profile loaded but not a GM, redirect to dashboard
      router.push('/dashboard');
    }
  }, [isLoading, session, profile, router]);

  const toggleDay = (day: number) => {
    setPlayDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    if (!name.trim()) {
      setError('Please enter a game name');
      return;
    }

    if (playDays.length === 0) {
      setError('Please select at least one play day');
      return;
    }

    setCreating(true);
    setError('');

    const inviteCode = nanoid(10);

    const { data, error: insertError } = await supabase
      .from('games')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        gm_id: profile.id,
        play_days: playDays.sort((a, b) => a - b),
        invite_code: inviteCode,
        scheduling_window_months: windowMonths,
      })
      .select()
      .single();

    if (insertError) {
      setError('Failed to create game. Please try again.');
      setCreating(false);
      return;
    }

    router.push(`/games/${data.id}`);
  };

  // Show spinner while auth is loading OR while we have a session but profile hasn't loaded yet
  if (isLoading || (session && !profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Create New Game</h1>

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
              placeholder="e.g., Curse of Strahd Campaign"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your campaign..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
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
              <p className="text-sm text-gray-500 mt-2">
                Players will only be able to mark availability on these days
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduling Window
              </label>
              <select
                value={windowMonths}
                onChange={(e) => setWindowMonths(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={1}>1 month ahead</option>
                <option value={2}>2 months ahead</option>
                <option value={3}>3 months ahead</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                How far in advance players can mark their availability
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={creating} className="flex-1">
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
