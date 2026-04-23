'use client';

import type { DateSuggestion } from '@/types';
import { Avatar, StatePill } from '@/components/ui';
import { formatTimeShort } from '@/lib/formatting';

interface PartyBreakdownProps {
  suggestion: DateSuggestion;
  gmId: string;
  coGmIds: Set<string>;
  use24h: boolean;
}

type Row = {
  userId: string;
  name: string;
  roleChip: 'GM' | 'CO-GM' | null;
  state: 'available' | 'maybe' | 'unavailable' | 'unset';
  subline: string | null;
  comment: string | null;
};

function subline(availableAfter: string | null, availableUntil: string | null, use24h: boolean): string | null {
  const parts: string[] = [];
  if (availableAfter) parts.push(`from ${formatTimeShort(availableAfter, use24h)}`);
  if (availableUntil) parts.push(`until ${formatTimeShort(availableUntil, use24h)}`);
  return parts.length ? parts.join(', ') : null;
}

export function PartyBreakdown({ suggestion, gmId, coGmIds, use24h }: PartyBreakdownProps) {
  const rows: Row[] = [
    ...suggestion.availablePlayers.map<Row>((p) => ({
      userId: p.user.id,
      name: p.user.name,
      roleChip: p.user.id === gmId ? 'GM' : coGmIds.has(p.user.id) ? 'CO-GM' : null,
      state: 'available',
      subline: subline(p.availableAfter, p.availableUntil, use24h),
      comment: p.comment,
    })),
    ...suggestion.maybePlayers.map<Row>((p) => ({
      userId: p.user.id,
      name: p.user.name,
      roleChip: p.user.id === gmId ? 'GM' : coGmIds.has(p.user.id) ? 'CO-GM' : null,
      state: 'maybe',
      subline: subline(p.availableAfter, p.availableUntil, use24h),
      comment: p.comment,
    })),
    ...suggestion.unavailablePlayers.map<Row>((p) => ({
      userId: p.user.id,
      name: p.user.name,
      roleChip: p.user.id === gmId ? 'GM' : coGmIds.has(p.user.id) ? 'CO-GM' : null,
      state: 'unavailable',
      subline: null,
      comment: p.comment,
    })),
    ...suggestion.pendingPlayers.map<Row>((u) => ({
      userId: u.id,
      name: u.name,
      roleChip: u.id === gmId ? 'GM' : coGmIds.has(u.id) ? 'CO-GM' : null,
      state: 'unset',
      subline: null,
      comment: null,
    })),
  ];

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.userId} className="grid grid-cols-[22px_1fr_auto] items-center gap-3">
          <Avatar userId={r.userId} name={r.name} size={22} ring={r.state} />
          <div className="min-w-0">
            <p className="text-sm text-card-foreground flex items-center gap-2">
              <span className="truncate">{r.name}</span>
              {r.roleChip && (
                <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-wide bg-primary/15 text-primary">
                  {r.roleChip}
                </span>
              )}
            </p>
            {r.subline && <p className="font-mono text-[11px] text-muted-foreground">{r.subline}</p>}
            {r.comment && (
              <p className="mt-1 rounded-r border-l-2 border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] italic text-muted-foreground">
                “{r.comment}”
              </p>
            )}
          </div>
          <StatePill state={r.state} size="sm" />
        </li>
      ))}
    </ul>
  );
}
