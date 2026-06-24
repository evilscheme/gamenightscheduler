'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { DAY_LABELS } from '@/lib/constants';
import type { WeekdayDefault } from '@/lib/defaultAvailability';
import { fetchUserDefaults, upsertUserDefault, deleteUserDefault } from '@/lib/data';
import { DefaultDayRow } from './DefaultDayRow';

const supabase = createClient();

type DefaultsMap = Record<number, WeekdayDefault | undefined>;

export function DefaultAvailabilityEditor() {
  const { profile } = useAuth();
  const { weekStartDay, use24h } = useUserPreferences();
  const toast = useToast();
  const [defaults, setDefaults] = useState<DefaultsMap>({});
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleChange = async (dayOfWeek: number, next: WeekdayDefault | undefined) => {
    if (!userId) return;
    const prev = defaults[dayOfWeek];
    setDefaults((d) => ({ ...d, [dayOfWeek]: next }));
    setSaveState('saving');

    const { error } = next
      ? await upsertUserDefault(supabase, {
          user_id: userId,
          day_of_week: dayOfWeek,
          status: next.status,
          comment: next.comment,
          available_after: next.available_after,
          available_until: next.available_until,
        })
      : await deleteUserDefault(supabase, userId, dayOfWeek);

    if (error) {
      setDefaults((d) => ({ ...d, [dayOfWeek]: prev })); // rollback
      setSaveState('error');
      toast.show('Could not save your default. Please try again.', 'danger');
      return;
    }
    setSaveState('saved');
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
      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {saveState === 'saving'
          ? 'Saving…'
          : saveState === 'error'
            ? 'Last change failed to save.'
            : 'Changes are saved automatically.'}
      </p>
    </div>
  );
}
