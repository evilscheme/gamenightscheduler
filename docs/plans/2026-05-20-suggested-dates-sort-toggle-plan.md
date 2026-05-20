# Suggested Dates Sort Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional chronological sort to the "Suggested dates" list on the Schedule tab, persisted per-user via localStorage, alongside the existing availability-based ranking.

**Architecture:** Introduce a reusable `useLocalStoragePref<T>` hook (SSR-safe hydration on mount). In `RankedList`, branch on a `sortMode` state from that hook: availability mode keeps current `sortSuggestions` + `partitionByThreshold` behavior; chronological mode uses the already-exported `sortSuggestionsChronologically` to render a flat list with no partition and no rank badges. `RankedRow` gains a `showRank` prop so the ordinal collapses in chronological mode.

**Tech Stack:** Next.js 16 App Router, React (client components), Vitest + Testing Library for unit tests, Playwright for e2e, Tailwind with semantic theme classes.

**Spec:** [docs/plans/2026-05-20-suggested-dates-sort-toggle-design.md](2026-05-20-suggested-dates-sort-toggle-design.md)

---

## File Structure

| Change | File | Responsibility |
|--------|------|----------------|
| Create | `src/hooks/useLocalStoragePref.ts` | Generic SSR-safe localStorage-backed React state hook |
| Create | `src/hooks/useLocalStoragePref.test.ts` | Unit tests for the hook |
| Modify | `src/components/games/schedule/RankedRow.tsx` | Add `showRank` prop; hide `RankCircle` slot when false |
| Modify | `src/components/games/schedule/RankedList.tsx` | Read `sortMode` from hook; branch sort/partition; render segmented control |
| Modify | `src/components/games/schedule/RankedList.test.tsx` | Add tests for chronological mode + toggle visibility |
| Create | `e2e/tests/scheduling/suggestions-sort-toggle.spec.ts` | E2E: toggle reorders list and persists across reload |

---

## Task 1: `useLocalStoragePref` hook

**Files:**
- Create: `src/hooks/useLocalStoragePref.ts`
- Create: `src/hooks/useLocalStoragePref.test.ts`

- [ ] **Step 1.1: Write failing test for default value before hydration**

Create `src/hooks/useLocalStoragePref.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalStoragePref } from './useLocalStoragePref';

const isMode = (v: unknown): v is 'a' | 'b' => v === 'a' || v === 'b';

describe('useLocalStoragePref', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns the default value on first render and after hydration when storage is empty', () => {
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('a');
  });

  it('hydrates from localStorage when a valid value is stored', () => {
    window.localStorage.setItem('k', JSON.stringify('b'));
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('b');
  });

  it('ignores invalid stored values and uses the default', () => {
    window.localStorage.setItem('k', JSON.stringify('garbage'));
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('a');
  });

  it('persists through the setter', () => {
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    act(() => {
      result.current[1]('b');
    });
    expect(result.current[0]).toBe('b');
    expect(window.localStorage.getItem('k')).toBe(JSON.stringify('b'));
  });

  it('does not throw when localStorage access fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('a');
    spy.mockRestore();
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `npm run test:run -- src/hooks/useLocalStoragePref.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement the hook**

Create `src/hooks/useLocalStoragePref.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * SSR-safe localStorage-backed React state.
 *
 * Returns `defaultValue` on first render so the server and the initial client
 * render match. After mount, hydrates from `localStorage[key]` if the stored
 * value passes `isValid`. The setter updates both state and storage.
 */
export function useLocalStoragePref<T>(
  key: string,
  defaultValue: T,
  isValid: (v: unknown) => v is T
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) {
        setValue(parsed);
      }
    } catch {
      // Ignore: localStorage may be unavailable or contain invalid JSON.
    }
    // We intentionally read storage once on mount and don't track key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setPersisted = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Ignore write failures (private browsing, quota, etc.).
      }
    },
    [key]
  );

  return [value, setPersisted];
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `npm run test:run -- src/hooks/useLocalStoragePref.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 1.5: Commit**

```bash
git add src/hooks/useLocalStoragePref.ts src/hooks/useLocalStoragePref.test.ts
git commit -m "feat: add useLocalStoragePref hook"
```

---

## Task 2: `RankedRow` — optional rank badge

**Files:**
- Modify: `src/components/games/schedule/RankedRow.tsx`

- [ ] **Step 2.1: Add `showRank` prop with default `true`**

In `src/components/games/schedule/RankedRow.tsx`, update the `RankedRowProps` interface and destructure to include `showRank`. The badge is the `<RankCircle rank={rank} highlighted={highlighted} />` element on the inner grid; gate that and the "highlighted" treatment on `showRank`.

Replace the props interface block:

```tsx
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
  playDateNote?: string | null;
  onLockIn: (date: string) => void;
  autoScrollTrigger?: string | null;
  /** When false, the rank ordinal slot is hidden and no row is visually highlighted as "rank #1". */
  showRank?: boolean;
}
```

And the destructure:

```tsx
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
  playDateNote,
  onLockIn,
  autoScrollTrigger,
  showRank = true,
}: RankedRowProps) {
```

- [ ] **Step 2.2: Gate the highlight + RankCircle on `showRank`**

In the same file, update the `highlighted` calculation:

```tsx
const highlighted = showRank && rank === 1 && !belowThreshold;
```

And change the inner grid to a 3-column layout when the rank is hidden. Replace the `<button …>` opening tag and its first child:

```tsx
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className={`grid w-full items-center gap-3 text-left ${
          showRank ? 'grid-cols-[auto_1fr_auto_auto]' : 'grid-cols-[1fr_auto_auto]'
        }`}
      >
        {showRank && <RankCircle rank={rank} highlighted={highlighted} />}
```

- [ ] **Step 2.3: Verify the file still compiles**

Run: `npm run lint -- src/components/games/schedule/RankedRow.tsx`
Expected: no errors.

Also run the existing test suite for RankedList to confirm nothing regressed:

Run: `npm run test:run -- src/components/games/schedule/RankedList.test.tsx`
Expected: PASS (existing test still passes because default `showRank=true` preserves behavior).

- [ ] **Step 2.4: Commit**

```bash
git add src/components/games/schedule/RankedRow.tsx
git commit -m "feat: add optional showRank prop to RankedRow"
```

---

## Task 3: `RankedList` — sort-mode state + branched rendering

**Files:**
- Modify: `src/components/games/schedule/RankedList.tsx`

- [ ] **Step 3.1: Add the sort-mode type, storage key, and validator**

At the top of `src/components/games/schedule/RankedList.tsx`, beneath the existing imports, add:

```tsx
import { useLocalStoragePref } from '@/hooks/useLocalStoragePref';
import { sortSuggestionsChronologically } from '@/lib/suggestions';

type SortMode = 'availability' | 'chronological';
const SORT_STORAGE_KEY = 'gns:schedule-sort';
const isSortMode = (v: unknown): v is SortMode =>
  v === 'availability' || v === 'chronological';
```

- [ ] **Step 3.2: Read `sortMode` from the hook inside the component**

Inside `RankedList`, immediately above the existing `useState`/`useMemo`, add:

```tsx
const [sortMode, setSortMode] = useLocalStoragePref<SortMode>(
  SORT_STORAGE_KEY,
  'availability',
  isSortMode
);
```

- [ ] **Step 3.3: Replace the `useMemo` block to compute view rows from `sortMode`**

Replace the existing `useMemo` returning `{ viable, belowThreshold }` and the `useEffect` that auto-expands the below-threshold section with this combined block:

```tsx
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
```

(`suggestions` is already imported via the props; `sortSuggestionsChronologically` was imported in step 3.1.)

- [ ] **Step 3.4: Replace the JSX to add the segmented control and branched list**

Replace the entire `return (...)` block (the one starting `<div className="space-y-3">`) with:

```tsx
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
          className={`px-2 py-1 rounded ${
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
          className={`px-2 py-1 rounded ${
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
```

- [ ] **Step 3.5: Hide the toggle when there are no suggestions**

The early return `if (suggestions.length === 0)` already exits before any toggle is rendered, so no change is needed. Confirm by reading the file — the `EmptyState` branch must remain above the `return (...)` block.

- [ ] **Step 3.6: Run the existing test to confirm it still passes**

Run: `npm run test:run -- src/components/games/schedule/RankedList.test.tsx`
Expected: PASS (the existing test runs in default availability mode).

- [ ] **Step 3.7: Run lint on the file**

Run: `npm run lint -- src/components/games/schedule/RankedList.tsx`
Expected: no errors.

- [ ] **Step 3.8: Commit**

```bash
git add src/components/games/schedule/RankedList.tsx
git commit -m "feat: add chronological sort toggle to suggested dates"
```

---

## Task 4: Unit tests for chronological mode

**Files:**
- Modify: `src/components/games/schedule/RankedList.test.tsx`

- [ ] **Step 4.1: Extend the test file with chronological-mode cases**

Replace the entire contents of `src/components/games/schedule/RankedList.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankedList } from './RankedList';
import { HoverSyncProvider } from './HoverSyncContext';
import type { DateSuggestion } from '@/types';

const mk = (overrides: Partial<DateSuggestion>): DateSuggestion => ({
  date: '2026-05-01',
  dayOfWeek: 4,
  availableCount: 4,
  maybeCount: 0,
  unavailableCount: 0,
  pendingCount: 0,
  totalPlayers: 5,
  availablePlayers: [],
  maybePlayers: [],
  unavailablePlayers: [],
  pendingPlayers: [],
  earliestStartTime: null,
  latestEndTime: null,
  meetsThreshold: true,
  ...overrides,
});

const renderList = (suggestions: DateSuggestion[]) =>
  render(
    <HoverSyncProvider>
      <RankedList
        suggestions={suggestions}
        isGm={false}
        gmId="g"
        coGmIds={new Set()}
        use24h={false}
        minPlayersNeeded={3}
        onLockIn={() => {}}
        autoExpandDate={null}
      />
    </HoverSyncProvider>
  );

describe('RankedList', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders viable rows and hides below-threshold by default in availability mode', () => {
    const items = [
      mk({ date: '2026-05-01', meetsThreshold: true }),
      mk({ date: '2026-05-02', meetsThreshold: false }),
    ];
    renderList(items);
    expect(screen.getByTestId('ranked-list')).toBeInTheDocument();
    expect(screen.queryByTestId('below-threshold-list')).not.toBeInTheDocument();
    expect(screen.getByText(/Fri, May 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Sat, May 2/)).not.toBeInTheDocument();
  });

  it('switching to chronological mode shows all rows in date order with no below-threshold section', async () => {
    const user = userEvent.setup();
    const items = [
      mk({ date: '2026-05-03', availableCount: 4, meetsThreshold: true }),
      mk({ date: '2026-05-01', availableCount: 1, meetsThreshold: false }),
      mk({ date: '2026-05-02', availableCount: 5, meetsThreshold: true }),
    ];
    renderList(items);
    await user.click(screen.getByTestId('sort-by-date'));

    const rows = within(screen.getByTestId('ranked-list')).getAllByTestId('ranked-row');
    expect(rows.map((r) => r.getAttribute('data-date'))).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
    expect(screen.queryByTestId('below-threshold-list')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Below threshold/i })).not.toBeInTheDocument();
  });

  it('chronological mode preserves the below-threshold visual marker in-place', async () => {
    const user = userEvent.setup();
    const items = [
      mk({ date: '2026-05-01', meetsThreshold: false }),
      mk({ date: '2026-05-02', meetsThreshold: true }),
    ];
    renderList(items);
    await user.click(screen.getByTestId('sort-by-date'));

    const firstRow = within(screen.getByTestId('ranked-list')).getAllByTestId('ranked-row')[0];
    expect(firstRow).toHaveAttribute('data-date', '2026-05-01');
    expect(within(firstRow).getByText(/Below threshold/i)).toBeInTheDocument();
  });

  it('persists the selected sort mode in localStorage', async () => {
    const user = userEvent.setup();
    renderList([mk({ date: '2026-05-01' })]);
    await user.click(screen.getByTestId('sort-by-date'));
    expect(window.localStorage.getItem('gns:schedule-sort')).toBe(
      JSON.stringify('chronological')
    );
  });

  it('hydrates from localStorage on mount', () => {
    window.localStorage.setItem('gns:schedule-sort', JSON.stringify('chronological'));
    const items = [
      mk({ date: '2026-05-02', meetsThreshold: true }),
      mk({ date: '2026-05-01', meetsThreshold: false }),
    ];
    renderList(items);
    const rows = within(screen.getByTestId('ranked-list')).getAllByTestId('ranked-row');
    expect(rows.map((r) => r.getAttribute('data-date'))).toEqual([
      '2026-05-01',
      '2026-05-02',
    ]);
  });

  it('does not render the toggle when there are no suggestions', () => {
    renderList([]);
    expect(screen.queryByTestId('suggestions-sort-toggle')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2: Install the `user-event` testing dependency**

`@testing-library/user-event` is not yet in `package.json` (only `@testing-library/react` is). Install it:

```bash
npm install --save-dev @testing-library/user-event
```

- [ ] **Step 4.3: Run the tests to verify they pass**

Run: `npm run test:run -- src/components/games/schedule/RankedList.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 4.4: Commit**

```bash
git add src/components/games/schedule/RankedList.test.tsx package.json package-lock.json
git commit -m "test: cover chronological sort mode for RankedList"
```

---

## Task 5: E2E test

**Files:**
- Create: `e2e/tests/scheduling/suggestions-sort-toggle.spec.ts`

- [ ] **Step 5.1: Write the e2e test**

Create `e2e/tests/scheduling/suggestions-sort-toggle.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { loginTestUser, createTestUser } from '../../helpers/test-auth';
import {
  createTestGame,
  setAvailability,
  getPlayDates,
} from '../../helpers/seed';
import { TEST_TIMEOUTS } from '../../constants';

test.describe('Suggested dates sort toggle', () => {
  test('toggling to Date reorders chronologically and persists across reload', async ({ page, request }) => {
    const gm = await createTestUser(request, {
      email: `gm-sort-toggle-${Date.now()}@e2e.local`,
      name: 'Sort Toggle GM',
      is_gm: true,
    });

    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Sort Toggle Campaign',
      play_days: [5, 6],
    });

    // Mark the GM available on a few play dates so we get multiple suggestions.
    const playDates = getPlayDates([5, 6], 4);
    await setAvailability(
      gm.id,
      game.id,
      playDates.slice(0, 4).map((date) => ({ date, is_available: true }))
    );

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    await page.goto(`/games/${game.id}`);
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await page.getByRole('button', { name: /schedule/i }).click();

    await expect(page.locator('[data-testid="schedule-tab-content"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await expect(page.locator('[data-testid="ranked-list"]')).toBeVisible();

    // Toggle should be visible and default to availability.
    const toggle = page.locator('[data-testid="suggestions-sort-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(page.locator('[data-testid="sort-by-availability"]')).toHaveAttribute('aria-checked', 'true');

    // Switch to Date sort.
    await page.locator('[data-testid="sort-by-date"]').click();
    await expect(page.locator('[data-testid="sort-by-date"]')).toHaveAttribute('aria-checked', 'true');

    // Rows should be in ascending date order.
    const dates = await page.locator('[data-testid="ranked-row"]').evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('data-date'))
    );
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);

    // Reload — selection persists.
    await page.reload();
    await page.getByRole('button', { name: /schedule/i }).click();
    await expect(page.locator('[data-testid="ranked-list"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.LONG,
    });
    await expect(page.locator('[data-testid="sort-by-date"]')).toHaveAttribute('aria-checked', 'true');

    // Switching back to Availability works.
    await page.locator('[data-testid="sort-by-availability"]').click();
    await expect(page.locator('[data-testid="sort-by-availability"]')).toHaveAttribute('aria-checked', 'true');
  });
});
```

- [ ] **Step 5.2: Run the e2e test**

Run: `npx playwright test e2e/tests/scheduling/suggestions-sort-toggle.spec.ts --project=chromium`
Expected: PASS.

- [ ] **Step 5.3: Commit**

```bash
git add e2e/tests/scheduling/suggestions-sort-toggle.spec.ts
git commit -m "test(e2e): sort toggle reorders suggestions and persists"
```

---

## Task 6: Final verification

**Files:** (no source changes)

- [ ] **Step 6.1: Manual UI check at desktop + mobile**

Per CLAUDE.md, validate UI locally:

```bash
npm run db:start
npm run dev:local
```

Open http://localhost:3000/dev-login, log in as "Dev GM", create or open a game with a play-day schedule, mark some availability, then visit the Schedule tab. Verify at desktop and at a mobile viewport (e.g., Chrome devtools iPhone 12) that:

- The "Availability | Date" segmented control sits inline with "Suggested dates" and wraps cleanly on narrow screens.
- Clicking "Date" reorders the list chronologically, hides rank circles, removes the "Below threshold · N" collapsible.
- Below-threshold dates appear in-place with the "Below threshold" warning eyebrow.
- A page reload preserves the chosen mode.

- [ ] **Step 6.2: Run lint and build**

Per the project memory rule:

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: success.

- [ ] **Step 6.3: Run the full unit test suite**

Run: `npm run test:run`
Expected: all pass.

- [ ] **Step 6.4: Final commit (only if any cleanup was needed)**

If steps 6.1–6.3 surfaced no issues, no final commit is needed. If something was tweaked:

```bash
git add -A
git commit -m "chore: address lint/build/test fallout from sort toggle"
```

---

## Self-Review Notes

- **Spec coverage:** Hook (Task 1), `showRank` prop (Task 2), `RankedList` toggle + branched render (Task 3), unit tests including the persistence cases the spec called out (Task 4), the e2e happy-path described in the spec (Task 5), and CLAUDE.md's lint/build/manual-mobile requirements (Task 6). All design-doc bullets accounted for.
- **Type/name consistency:** `SortMode` and `gns:schedule-sort` are defined once in Task 3 and reused in Tasks 4 and 5. `showRank` is added in Task 2 with default `true` and explicitly passed `false` in chronological mode in Task 3.
- **Edge cases from the design:** Invalid storage value → hook's `isValid` rejects (Task 1, test #3 + Task 3 validator). `localStorage` blocked / SSR → hook swallows and stays on default (Task 1, test #5). Empty suggestions → early return predates the toggle (Task 3 step 3.5; Task 4 test #6). `autoExpandDate` in chronological mode → effect now gated on `sortMode === 'availability'` (Task 3 step 3.3).
- **Risk from spec:** The "hide vs. placeholder rank slot" question is resolved with grid-template-columns change (Task 2 step 2.2) — content shifts left when rank hidden, no invisible placeholder.
