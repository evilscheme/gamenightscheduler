'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';
import { DAY_LABELS } from '@/lib/constants';
import { queryKeys } from '@/lib/queryKeys';
import type { WeekdayDefault } from '@/lib/defaultAvailability';
import { fetchUserDefaults, upsertUserDefault, deleteUserDefault } from '@/lib/data';
import { DefaultDayRow } from './DefaultDayRow';

const supabase = createClient();

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

type DefaultsMap = Record<number, WeekdayDefault | undefined>;

function sameDefault(a: WeekdayDefault | undefined, b: WeekdayDefault | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.status === b.status &&
    a.comment === b.comment &&
    a.available_after === b.available_after &&
    a.available_until === b.available_until
  );
}

export function DefaultAvailabilityEditor() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { weekStartDay, use24h } = useUserPreferences();
  const [defaults, setDefaults] = useState<DefaultsMap>({});
  const [saved, setSaved] = useState<DefaultsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const userId = profile?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await fetchUserDefaults(supabase, userId);
      if (cancelled) return;
      const map: DefaultsMap = {};
      data?.forEach((d) => {
        map[d.day_of_week] = {
          status: d.status,
          comment: d.comment,
          available_after: d.available_after,
          available_until: d.available_until,
        };
      });
      setDefaults(map);
      setSaved(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Edits only update local state; changes are persisted on Save.
  const handleChange = (dayOfWeek: number, next: WeekdayDefault | undefined) => {
    setDefaults((d) => ({ ...d, [dayOfWeek]: next }));
    setMessage('');
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setMessage('');

    let failed = false;
    for (const dow of WEEKDAYS) {
      if (sameDefault(defaults[dow], saved[dow])) continue;
      const next = defaults[dow];
      const { error } = next
        ? await upsertUserDefault(supabase, {
            user_id: userId,
            day_of_week: dow,
            status: next.status,
            comment: next.comment,
            available_after: next.available_after,
            available_until: next.available_until,
          })
        : await deleteUserDefault(supabase, userId, dow);
      if (error) {
        failed = true;
        break;
      }
    }

    if (failed) {
      setMessage('Error saving default availability. Please try again.');
    } else {
      setSaved(defaults);
      setMessage('Default availability saved!');
    }
    // Game pages cache the defaults (for the "Apply defaults" button); refresh
    // even on partial failure since some rows may have been written.
    if (userId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.userDefaults(userId) });
    }
    setSaving(false);
  };

  // Order the week per the user's preference (Sunday- or Monday-first).
  const order = weekStartDay === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div>
      <div className="rounded-xl border border-border bg-card px-4 sm:px-6">
        {order.map((dow) => (
          <DefaultDayRow
            key={dow}
            dayLabel={DAY_LABELS.full[dow]}
            value={defaults[dow]}
            use24h={use24h}
            onChange={(next) => handleChange(dow, next)}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        {message && (
          <p className={`text-sm ${message.includes('Error') ? 'text-danger' : 'text-success'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
