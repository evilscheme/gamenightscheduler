'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Button, Card, CardContent, CardHeader, Input, LoadingSpinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { profile, isLoading, refreshProfile, session } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClient();

  useAuthRedirect();

  // Sync local state with profile - this is a valid pattern for form initialization
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
    }
  }, [profile]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = async () => {
    if (!profile?.id) return;

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('users')
      .update({ name })
      .eq('id', profile.id);

    if (error) {
      setMessage('Error saving settings. Please try again.');
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
        <LoadingSpinner />
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
          />

          {message && (
            <p
              className={`text-sm ${message.includes('Error') ? 'text-danger' : 'text-success'}`}
            >
              {message}
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
