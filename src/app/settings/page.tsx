'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import Link from 'next/link';
import { Button, EyebrowLabel, Input, Panel, PageLoading } from '@/components/ui';
import { getSupabaseClient } from '@/lib/supabase/client';
import { updateUserProfile } from '@/lib/data/users';
import { TEXT_LIMITS, TIMEZONE_GROUPS } from '@/lib/constants';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { getBrowserTimezone, isValidTimezone } from '@/lib/timezone';
import type { User } from '@/types';

interface ProfileSettingsFormProps {
  profile: User;
  refreshProfile: () => Promise<void>;
  supabase: SupabaseClient;
}

// Seeded once from `profile` via lazy initial state. The parent mounts a
// fresh instance of this component (keyed by profile.id) whenever a new
// profile arrives, so there's no need for an effect to resync form state -
// that pattern breaks when `profile` gets a new object identity (e.g. a
// React Query refetch) mid-edit, silently wiping unsaved input.
function ProfileSettingsForm({ profile, refreshProfile, supabase }: ProfileSettingsFormProps) {
  const [name, setName] = useState(() => profile.name || '');
  const [userTimezone, setUserTimezone] = useState(() => profile.timezone || '');
  const [weekStartDay, setWeekStartDay] = useState(() => profile.week_start_day ?? 0);
  const [timeFormat, setTimeFormat] = useState(() => profile.time_format || '12h');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(
    null
  );

  const handleDetectTimezone = () => {
    const browserTz = getBrowserTimezone();
    if (browserTz && isValidTimezone(browserTz)) {
      setUserTimezone(browserTz);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setMessage({ text: 'Display name cannot be empty.', tone: 'danger' });
      return;
    }
    if (name.length > TEXT_LIMITS.USER_DISPLAY_NAME) {
      setMessage({
        text: `Display name must be ${TEXT_LIMITS.USER_DISPLAY_NAME} characters or less.`,
        tone: 'danger',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    const trimmedName = name.trim();
    const { error } = await updateUserProfile(supabase, profile.id, {
      name: trimmedName,
      timezone: userTimezone || null,
      week_start_day: weekStartDay,
      time_format: timeFormat,
    });

    if (error) {
      if (error.code === '23514') {
        setMessage({
          text: `Display name must be ${TEXT_LIMITS.USER_DISPLAY_NAME} characters or less.`,
          tone: 'danger',
        });
      } else {
        setMessage({ text: 'Error saving settings. Please try again.', tone: 'danger' });
      }
    } else {
      setMessage({ text: 'Settings saved successfully!', tone: 'success' });
      // Mirror the trim server-side saved, from this event handler (not an
      // effect) - safe because it's a direct response to the user's action.
      setName(trimmedName);
      await refreshProfile();
    }

    setSaving(false);
  };

  return (
    <>
      {/* ── Profile ──────────────────────────────────────────────────── */}
      <Panel as="section" padded="md">
        <EyebrowLabel className="mb-4 block">Profile</EyebrowLabel>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
            <p className="text-foreground">{profile.email}</p>
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
      </Panel>

      {/* ── Preferences ──────────────────────────────────────────────── */}
      <Panel as="section" padded="md">
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
      </Panel>

      {/* ── Appearance ───────────────────────────────────────────────── */}
      <Panel as="section" padded="md">
        <EyebrowLabel className="mb-4 block">Appearance</EyebrowLabel>
        <ThemePicker />
      </Panel>

      {message && (
        <p className={`text-sm ${message.tone === 'danger' ? 'text-danger' : 'text-success'}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </>
  );
}

export default function SettingsPage() {
  const { profile, authStatus, refreshProfile } = useAuth();
  const supabase = getSupabaseClient();

  useAuthRedirect();

  if (authStatus === 'loading') {
    return (
      <PageLoading />
    );
  }

  // `deriveAuthStatus` guarantees authenticated <=> profile non-null, but the
  // unauthenticated branch can render for one frame before useAuthRedirect
  // fires - so this guard is required, not optional.
  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your profile, display preferences, and theme.
        </p>
      </div>

      <div className="space-y-5">
        <ProfileSettingsForm
          key={profile.id}
          profile={profile}
          refreshProfile={refreshProfile}
          supabase={supabase}
        />

        {/* ── Default availability ─────────────────────────────────────── */}
        <Panel as="section" padded="md">
          <EyebrowLabel className="mb-4 block">Default availability</EyebrowLabel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="sm:max-w-md">
              <p className="text-sm font-medium text-foreground">Your usual weekly availability</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Define a recurring pattern once, then apply it to fill in any game&apos;s calendar.
              </p>
            </div>
            <Link href="/settings/default-availability" className="shrink-0">
              <Button variant="secondary">Set default availability</Button>
            </Link>
          </div>
        </Panel>

        {/* ── Danger Zone ──────────────────────────────────────────────── */}
        <section className="mt-2 rounded-xl border border-danger/40 bg-card p-4 sm:p-6">
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
