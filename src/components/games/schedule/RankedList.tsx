'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DateSuggestion } from '@/types';
import { EyebrowLabel, EmptyState } from '@/components/ui';
import { useLocalStoragePref } from '@/hooks/useLocalStoragePref';
import { partitionByThreshold } from '@/lib/scheduleView';
import { sortSuggestionsChronologically } from '@/lib/suggestions';
import { RankedRow } from './RankedRow';

type SortMode = 'availability' | 'chronological';
const SORT_STORAGE_KEY = 'gns:schedule-sort';
const isSortMode = (v: unknown): v is SortMode =>
  v === 'availability' || v === 'chronological';

interface RankedListProps {
  suggestions: DateSuggestion[];
  isGm: boolean;
  gmId: string;
  coGmIds: Set<string>;
  use24h: boolean;
  minPlayersNeeded: number;
  playDateNotes?: Map<string, string>;
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
  playDateNotes,
  onLockIn,
  autoExpandDate,
}: RankedListProps) {
  const [showBelow, setShowBelow] = useState(false);
  const [sortMode, setSortMode] = useLocalStoragePref<SortMode>(
    SORT_STORAGE_KEY,
    'availability',
    isSortMode
  );

  const { viable, belowThreshold, chronological } = useMemo(() => {
    if (sortMode === 'chronological') {
      return {
        viable: [] as typeof suggestions,
        belowThreshold: [] as typeof suggestions,
        chronological: sortSuggestionsChronologically(suggestions),
      };
    }
    const { viable, belowThreshold } = partitionByThreshold(suggestions);
    return { viable, belowThreshold, chronological: [] as typeof suggestions };
  }, [suggestions, sortMode]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      sortMode === 'availability' &&
      autoExpandDate &&
      belowThreshold.some((s) => s.date === autoExpandDate)
    ) {
      setShowBelow(true);
    }
  }, [autoExpandDate, belowThreshold, sortMode]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <EyebrowLabel className="block">Suggested dates</EyebrowLabel>
        <div
          role="radiogroup"
          aria-label="Sort suggested dates"
          className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px] font-mono"
          data-testid="suggestions-sort-toggle"
        >
          <button
            type="button"
            role="radio"
            aria-checked={sortMode === 'availability'}
            onClick={() => setSortMode('availability')}
            className={`px-2 py-1 rounded-sm ${
              sortMode === 'availability'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="sort-by-availability"
          >
            Availability
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={sortMode === 'chronological'}
            onClick={() => setSortMode('chronological')}
            className={`px-2 py-1 rounded-sm ${
              sortMode === 'chronological'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="sort-by-date"
          >
            Date
          </button>
        </div>
      </div>

      {sortMode === 'chronological' ? (
        <ul className="space-y-3" data-testid="ranked-list">
          {chronological.map((s) => (
            <RankedRow
              key={s.date}
              rank={0}
              suggestion={s}
              isGm={isGm}
              gmId={gmId}
              coGmIds={coGmIds}
              use24h={use24h}
              belowThreshold={!s.meetsThreshold}
              defaultExpanded={false}
              minPlayersNeeded={minPlayersNeeded}
              playDateNote={playDateNotes?.get(s.date) ?? null}
              onLockIn={onLockIn}
              autoScrollTrigger={autoExpandDate}
              showRank={false}
            />
          ))}
        </ul>
      ) : (
        <>
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
                playDateNote={playDateNotes?.get(s.date) ?? null}
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
                title={showBelow ? "Hide dates that don't meet the minimum player threshold" : "Show dates that don't meet the minimum player threshold"}
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
                      playDateNote={playDateNotes?.get(s.date) ?? null}
                      onLockIn={onLockIn}
                      autoScrollTrigger={autoExpandDate}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
