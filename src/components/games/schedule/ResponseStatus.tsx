'use client';

import type { MemberWithRole } from '@/types';
import { Avatar, EyebrowLabel } from '@/components/ui';

interface ResponseStatusProps {
  members: MemberWithRole[];
  completionByUserId: Map<string, { answered: number; total: number }>;
  embedded?: boolean;
}

function fillClass(pct: number): string {
  if (pct >= 80) return 'bg-success';
  if (pct >= 50) return 'bg-warning';
  return 'bg-danger';
}

export function ResponseStatus({ members, completionByUserId, embedded = false }: ResponseStatusProps) {
  const list = (
    <ul className={embedded ? 'space-y-2' : 'mt-3 space-y-2'}>
        {members.map((m) => {
          const c = completionByUserId.get(m.id) ?? { answered: 0, total: 0 };
          const pct = c.total > 0 ? Math.round((c.answered / c.total) * 100) : 0;
          return (
            <li key={m.id} className="flex items-center gap-3">
              <Avatar userId={m.id} name={m.name} avatarUrl={m.avatar_url} size={22} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-card-foreground truncate">{m.name}</p>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${fillClass(pct)}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                {c.answered}/{c.total}
              </span>
            </li>
          );
        })}
    </ul>
  );

  if (embedded) return list;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <EyebrowLabel>Response status</EyebrowLabel>
      {list}
    </div>
  );
}
