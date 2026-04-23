'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { DateSuggestion } from '@/types';
import { Avatar, Button, EyebrowLabel, RankCircle } from '@/components/ui';
import { formatTimeWindow } from '@/lib/scheduleView';
import { PartyBreakdown } from './PartyBreakdown';
import { useHoverSync } from './HoverSyncContext';

interface RankedRowProps {
  rank: number;
  suggestion: DateSuggestion;
  isGm: boolean;
  gmId: string;
  coGmIds: Set<string>;
  use24h: boolean;
  belowThreshold: boolean;
  defaultExpanded: boolean;
  minPlayersNeeded: number;
  onLockIn: (date: string) => void;
  autoScrollTrigger?: string | null;
}

export function RankedRow({
  rank,
  suggestion,
  isGm,
  gmId,
  coGmIds,
  use24h,
  belowThreshold,
  defaultExpanded,
  minPlayersNeeded,
  onLockIn,
  autoScrollTrigger,
}: RankedRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rootRef = useRef<HTMLLIElement | null>(null);
  const { hoveredDate, setHoveredDate } = useHoverSync();
  const isHovered = hoveredDate === suggestion.date;

  useEffect(() => {
    if (autoScrollTrigger && autoScrollTrigger === suggestion.date) {
      setExpanded(true);
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [autoScrollTrigger, suggestion.date]);

  const groupYesPct = Math.round(
    (suggestion.availableCount / Math.max(1, suggestion.totalPlayers)) * 100
  );
  const windowLabel = formatTimeWindow(suggestion.earliestStartTime, suggestion.latestEndTime, use24h);
  const highlighted = rank === 1 && !belowThreshold;

  const visibleAvatars = [
    ...suggestion.availablePlayers.map((p) => ({ state: 'available' as const, user: p.user })),
    ...suggestion.maybePlayers.map((p) => ({ state: 'maybe' as const, user: p.user })),
    ...suggestion.unavailablePlayers.map((p) => ({ state: 'unavailable' as const, user: p.user })),
    ...suggestion.pendingPlayers.map((u) => ({ state: 'unset' as const, user: u })),
  ].slice(0, 8);

  return (
    <li
      ref={rootRef}
      data-testid="ranked-row"
      data-date={suggestion.date}
      onMouseEnter={() => setHoveredDate(suggestion.date)}
      onMouseLeave={() => setHoveredDate(null)}
      className={`rounded-xl border p-4 transition-colors ${
        highlighted
          ? 'border-primary/40 bg-card ring-1 ring-primary/15'
          : 'border-border bg-card'
      } ${isHovered ? 'ring-2 ring-primary/30' : ''}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-left"
      >
        <RankCircle rank={rank} highlighted={highlighted} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-card-foreground">
              {format(parseISO(suggestion.date), 'EEE, MMM d')}
            </span>
            {belowThreshold && (
              <span className="rounded-sm bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                Below threshold
              </span>
            )}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex -space-x-1">
              {visibleAvatars.map((a) => (
                <Avatar key={a.user.id} userId={a.user.id} name={a.user.name} size={18} ring={a.state} />
              ))}
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {minPlayersNeeded > 0 ? (
                <>{suggestion.availableCount}/{minPlayersNeeded} needed · </>
              ) : null}
              {suggestion.availableCount}✓ · {suggestion.maybeCount}? · {suggestion.unavailableCount}✕ · {suggestion.pendingCount} pending
            </span>
          </div>
          {windowLabel && (
            <p className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <Clock className="size-3" /> {windowLabel}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={`font-mono leading-none ${highlighted ? 'text-2xl text-primary' : 'text-xl text-card-foreground'} font-bold`}>
            {groupYesPct}%
          </p>
          <EyebrowLabel variant="muted">group yes</EyebrowLabel>
        </div>
        <ChevronRight className={`size-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-3 border-t border-border pt-3">
          <EyebrowLabel variant="muted" className="mb-2 block">Party breakdown</EyebrowLabel>
          <PartyBreakdown suggestion={suggestion} gmId={gmId} coGmIds={coGmIds} use24h={use24h} />
          {isGm && (
            <div className="mt-3 flex items-center justify-end gap-3">
              <span className="font-mono text-[11px] text-muted-foreground">Score: {suggestion.availableCount * 10 + suggestion.maybeCount}</span>
              <Button size="sm" onClick={() => onLockIn(suggestion.date)}>
                ★ Lock in this night
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
