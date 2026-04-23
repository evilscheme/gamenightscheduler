'use client';

import { useState } from 'react';
import type { DateSuggestion } from '@/types';
import { EyebrowLabel, EmptyState } from '@/components/ui';
import { partitionByThreshold } from '@/lib/scheduleView';
import { RankedRow } from './RankedRow';

interface RankedListProps {
  suggestions: DateSuggestion[];
  isGm: boolean;
  gmId: string;
  coGmIds: Set<string>;
  use24h: boolean;
  minPlayersNeeded: number;
  onLockIn: (date: string) => void;
  autoExpandDate: string | null;
}

export function RankedList({
  suggestions,
  isGm,
  gmId,
  coGmIds,
  use24h,
  minPlayersNeeded,
  onLockIn,
  autoExpandDate,
}: RankedListProps) {
  const [showBelow, setShowBelow] = useState(false);
  const { viable, belowThreshold } = partitionByThreshold(suggestions);

  if (suggestions.length === 0) {
    return (
      <EmptyState
        title="No available dates"
        description="No available dates in the scheduling window."
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3" data-testid="ranked-list">
        {viable.map((s, idx) => (
          <RankedRow
            key={s.date}
            rank={idx + 1}
            suggestion={s}
            isGm={isGm}
            gmId={gmId}
            coGmIds={coGmIds}
            use24h={use24h}
            belowThreshold={false}
            defaultExpanded={idx === 0}
            minPlayersNeeded={minPlayersNeeded}
            onLockIn={onLockIn}
            autoScrollTrigger={autoExpandDate}
          />
        ))}
      </ul>

      {belowThreshold.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            aria-expanded={showBelow}
            onClick={() => setShowBelow((v) => !v)}
            className="flex w-full items-center justify-between py-2"
          >
            <EyebrowLabel variant="muted">Below threshold · {belowThreshold.length}</EyebrowLabel>
            <span className="font-mono text-[11px] text-muted-foreground">{showBelow ? 'Hide' : 'Show'}</span>
          </button>
          {showBelow && (
            <ul className="mt-2 space-y-3" data-testid="below-threshold-list">
              {belowThreshold.map((s, idx) => (
                <RankedRow
                  key={s.date}
                  rank={viable.length + idx + 1}
                  suggestion={s}
                  isGm={isGm}
                  gmId={gmId}
                  coGmIds={coGmIds}
                  use24h={use24h}
                  belowThreshold={true}
                  defaultExpanded={false}
                  minPlayersNeeded={minPlayersNeeded}
                  onLockIn={onLockIn}
                  autoScrollTrigger={autoExpandDate}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
