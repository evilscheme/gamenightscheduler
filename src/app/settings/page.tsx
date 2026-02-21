'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Button, Card, CardContent, CardHeader, Input, LoadingSpinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { TEXT_LIMITS, TIMEZONE_GROUPS } from '@/lib/constants';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { DeleteAccountSection } from '@/components/settings/DeleteAccountSection';
import { getBrowserTimezone, isValidTimezone } from '@/lib/timezone';

export default function SettingsPage() {
  const { profile, isLoading, refreshProfile, session } = useAuth();
  const [name, setName] = useState('');
  const [userTimezone, setUserTimezone] = useState('');
  const [weekStartDay, setWeekStartDay] = useState(0);
  const [timeFormat, setTimeFormat] = useState('12h');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClient();

  useAuthRedirect();

  // Sync local state with profile - this is a valid pattern for form initialization
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setUserTimezone(profile.timezone || '');
      setWeekStartDay(profile.week_start_day ?? 0);
      setTimeFormat(profile.time_format || '12h');
    }
  }, [profile]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDetectTimezone = () => {
    const browserTz = getBrowserTimezone();
    if (browserTz && isValidTimezone(browserTz)) {
      setUserTimezone(browserTz);
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    // Validate name length
    if (!name.trim()) {
      setMessage('Display name cannot be empty.');
      return;
    }
    if (name.length > TEXT_LIMITS.USER_DISPLAY_NAME) {
      setMessage(`Display name must be ${TEXT_LIMITS.USER_DISPLAY_NAME} characters or less.`);
      return;
    }

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('users')
      .update({
        name: name.trim(),
        timezone: userTimezone || null,
        week_start_day: weekStartDay,
        time_format: timeFormat,
      })
      .eq('id', profile.id);

    if (error) {
      // Check if it's a constraint violation
      if (error.code === '23514') {
        setMessage(`Display name must be ${TEXT_LIMITS.USER_DISPLAY_NAME} characters or less.`);
      } else {
        setMessage('Error saving settings. Please try again.');
      }
    } else {
      setMessage('Settings saved successfully!');
      // Refresh profile data
      await refreshProfile();
    }

    setSaving(false);
  };

  // Show spinner while auth is loading OR while we have a session but profile hasn't loaded yet
  if (isLoading || (session && !profile)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">Settings</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-card-foreground">Profile</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
            <p className="text-foreground">{profile?.email}</p>
            <p className="text-sm text-muted-foreground mt-1">Email cannot be changed</p>
          </div>

          <Input
            label="Display Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={TEXT_LIMITS.USER_DISPLAY_NAME}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-card-foreground">Preferences</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Timezone
            </label>
            <div className="flex gap-2">
              <select
                value={userTimezone}
                onChange={(e) => setUserTimezone(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              >
                <option value="">Not set (use browser default)</option>
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
              <Button
                type="button"
                variant="secondary"
                onClick={handleDetectTimezone}
                className="shrink-0"
              >
                Detect
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Used as default when creating games and for converting session times
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Week starts on
            </label>
            <div className="flex rounded-lg border border-border overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => setWeekStartDay(0)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  weekStartDay === 0
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Sunday
              </button>
              <button
                type="button"
                onClick={() => setWeekStartDay(1)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  weekStartDay === 1
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Monday
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Time format
            </label>
            <div className="flex rounded-lg border border-border overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => setTimeFormat('12h')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  timeFormat === '12h'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                12-hour (2:30 PM)
              </button>
              <button
                type="button"
                onClick={() => setTimeFormat('24h')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  timeFormat === '24h'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                24-hour (14:30)
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {message && (
        <p
          className={`text-sm mt-4 ${message.includes('Error') ? 'text-danger' : 'text-success'}`}
        >
          {message}
        </p>
      )}

      <div className="flex justify-end mt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-card-foreground">Appearance</h2>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>

      <DeleteAccountSection />
    </div>
  );
}
