'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import Link from 'next/link';
import { Button, EyebrowLabel, Input, LoadingSpinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { TEXT_LIMITS, TIMEZONE_GROUPS } from '@/lib/constants';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { getBrowserTimezone, isValidTimezone } from '@/lib/timezone';

export default function SettingsPage() {
  const { profile, authStatus, refreshProfile } = useAuth();
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
      if (error.code === '23514') {
        setMessage(`Display name must be ${TEXT_LIMITS.USER_DISPLAY_NAME} characters or less.`);
      } else {
        setMessage('Error saving settings. Please try again.');
      }
    } else {
      setMessage('Settings saved successfully!');
      await refreshProfile();
    }

    setSaving(false);
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
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your profile, display preferences, and theme.
        </p>
      </div>

      <div className="space-y-5">
        {/* ── Profile ──────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <EyebrowLabel className="mb-4 block">Profile</EyebrowLabel>
          <div className="space-y-6">
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
          </div>
        </section>

        {/* ── Preferences ──────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <EyebrowLabel className="mb-4 block">Preferences</EyebrowLabel>
          <div className="space-y-6">
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-foreground mb-1">
                Timezone
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <select
                  id="timezone"
                  value={userTimezone}
                  onChange={(e) => setUserTimezone(e.target.value)}
                  className="w-full min-w-0 sm:flex-1 px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
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
                  className="shrink-0 sm:w-auto"
                >
                  Detect
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Used as default when creating games and for converting session times
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Week starts on
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 0, label: 'Sunday' },
                  { value: 1, label: 'Monday' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={weekStartDay === opt.value}
                    onClick={() => setWeekStartDay(opt.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      weekStartDay === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Time format
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '12h', label: '12-hour (2:30 PM)' },
                  { value: '24h', label: '24-hour (14:30)' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={timeFormat === opt.value}
                    onClick={() => setTimeFormat(opt.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      timeFormat === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Appearance ───────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <EyebrowLabel className="mb-4 block">Appearance</EyebrowLabel>
          <ThemePicker />
        </section>

        {message && (
          <p
            className={`text-sm ${message.includes('Error') ? 'text-danger' : 'text-success'}`}
          >
            {message}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* ── Danger Zone ──────────────────────────────────────────────── */}
        <section className="mt-2 rounded-xl border border-destructive/40 bg-card p-4 sm:p-6">
          <EyebrowLabel variant="danger" className="mb-4 block">Danger Zone</EyebrowLabel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="sm:max-w-md">
              <p className="text-sm font-medium text-foreground">Delete Account</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently delete your account and all data associated with it.
              </p>
            </div>
            <Link href="/settings/delete-account" className="shrink-0">
              <Button variant="danger">Delete Account</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
