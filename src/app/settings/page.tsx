'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { profile, isLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [isGm, setIsGm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (!isLoading && !profile) {
      router.push('/login');
    }
  }, [isLoading, profile, router]);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setIsGm(profile.is_gm || false);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.id) return;

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('users')
      .update({ name, is_gm: isGm })
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

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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

          <div className="border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Game Master Mode</h3>
                <p className="text-sm text-muted-foreground">
                  Enable this to create and manage your own games
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGm(!isGm)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
                  isGm ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isGm ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {message && (
            <p
              className={`text-sm ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}
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
