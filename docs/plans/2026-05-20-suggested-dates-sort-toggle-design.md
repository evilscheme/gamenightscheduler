# Suggested Dates: Chronological Sort Toggle — Design

**Status:** Approved, ready for implementation plan
**Date:** 2026-05-20

## Background

The Schedule tab's "Suggested dates" section currently always sorts dates by an availability score (most available players first, ties broken by maybe count, then pending count, then date). This is the right default for "when should we play?" but it's awkward for "what's our next play day?" — a GM scanning chronologically has to mentally reorder.

We're adding an optional sort toggle: **By availability** (current behavior) or **By date** (chronological).

## Scope

- `src/components/games/schedule/RankedList.tsx` — add toggle UI + branch on sort mode
- `src/components/games/schedule/RankedRow.tsx` — accept a `showRank` prop; hide rank badge in chronological mode
- `src/hooks/useLocalStoragePref.ts` — **new**: reusable typed localStorage hook
- Unit tests for the hook and updated `RankedList.test.tsx`
- One E2E happy-path test in the schedule suite

Out of scope:

- Persisting the preference in the user profile (DB). localStorage is sufficient.
- Additional sort modes (by maybe count, shuffle, etc.).
- Restructuring `RankedList` into separate sort vs. render units. Boundary is fine for two modes.

## UI

Segmented control inline with the "Suggested dates" eyebrow label:

```
SUGGESTED DATES                       [ Availability | Date ]
```

- Two buttons, current selection highlighted with `bg-primary/10 text-primary` (matching the existing semantic theme classes documented in CLAUDE.md).
- Mobile: same control, but allowed to wrap below the label if horizontal space is tight.
- Hidden when `suggestions.length === 0` (the empty state already covers that case).
- `role="radiogroup"` with two `role="radio"` buttons + `aria-checked` for accessibility.

## Behavior by mode

### Availability mode (default)

Unchanged from today:

1. `sortSuggestions(suggestions)` — orders by `meetsThreshold` → `availableCount` → `maybeCount` → `pendingCount` → date.
2. `partitionByThreshold(...)` — splits into `viable` and `belowThreshold`.
3. Render viable as a numbered list (rank badges 1..n).
4. Render below-threshold in a collapsible section underneath ("Below threshold · N · Show/Hide"), continuing rank numbering.

### Chronological mode

1. `sortSuggestionsChronologically(suggestions)` — single date-ascending list. (Helper already exists at [src/lib/suggestions.ts:106](src/lib/suggestions.ts:106).)
2. **No partition.** Below-threshold rows appear in their date-correct position.
3. **No rank badges.** Pass `showRank={false}` to `RankedRow`; the badge slot collapses.
4. Below-threshold rows keep their existing muted visual treatment (the prop `belowThreshold={true}` on `RankedRow` already handles this — we just compute it from `s.meetsThreshold` per-row instead of from the partition).

## Persistence

A new generic hook `useLocalStoragePref<T>` modeled after the pattern in `ThemeContext`:

```ts
function useLocalStoragePref<T>(
  key: string,
  defaultValue: T,
  isValid: (v: unknown) => v is T
): [T, (next: T) => void];
```

Behavior:

- First render returns `defaultValue` (SSR-safe, no hydration mismatch).
- A `useEffect` on mount reads `localStorage[key]`, runs `isValid`, and updates state if valid.
- Setter writes through to `localStorage` and updates state.
- Storage key: `gns:schedule-sort`. Values: `'availability'` | `'chronological'`.

Why a hook (vs. inline state in `RankedList`): the SSR-safe hydration dance is non-trivial enough that bundling it once avoids subtle hydration bugs the next time we add a UI preference. Generic shape so future prefs reuse it.

## Data flow

```
suggestions (DateSuggestion[])
        │
        ▼
   RankedList
        │
        ├── sortMode (from useLocalStoragePref)
        │
        ▼
  sortMode === 'availability'?
     /              \
   yes               no
    │                 │
sortSuggestions   sortSuggestionsChronologically
    │                 │
partitionByThreshold  │ (no partition; flat list)
    │                 │
    ▼                 ▼
 RankedRow (showRank=true)   RankedRow (showRank=false,
                              belowThreshold=!s.meetsThreshold)
```

The two existing pure helpers in `src/lib/suggestions.ts` aren't modified.

## Edge cases

| Case | Behavior |
|------|----------|
| `localStorage` has garbage value | `isValid` rejects, fall back to `'availability'`. |
| User disables localStorage / SSR | Hook stays on `defaultValue`; setter still updates in-memory state, just doesn't persist. |
| `suggestions.length === 0` | Toggle hidden; empty state renders as today. |
| `autoExpandDate` (after confirming a session) in chronological mode | `showBelow` section doesn't exist, so the existing `setShowBelow(true)` effect is gated to availability mode only. The row's own auto-scroll trigger via `autoScrollTrigger` prop still works because the row exists in the flat list. |
| User switches modes while a below-threshold row is expanded | Expansion state lives on `RankedRow`, keyed by `s.date`. Switching modes doesn't unmount the rows that are present in both modes, so expansion is preserved for those. Rows that only existed under the collapsible "Below threshold" section in availability mode are now always rendered in chronological mode, so they appear collapsed by default — acceptable. |

## Testing

### Unit

- **`useLocalStoragePref` test (new):**
  - Returns default on first render.
  - Hydrates from storage when a valid value exists.
  - Ignores and falls back when storage holds an invalid value.
  - Persists through the setter.
- **`RankedList.test.tsx` (extend):**
  - Chronological mode: rows render in date order, no "Below threshold" collapsible button, no rank ordinals.
  - Below-threshold rows in chronological mode still get the muted visual treatment.
  - Toggle hidden when `suggestions` is empty.
  - Persistence: simulating a localStorage value of `'chronological'` causes the chronological view on (effect-hydrated) re-render.

### E2E

One happy-path test added to the schedule suite:

1. Load schedule tab for a seeded game with multiple suggestions.
2. Default view shows availability-ordered list.
3. Click "Date" segment → list reorders chronologically, rank badges gone.
4. Reload the page → still in chronological mode.
5. Click "Availability" segment → back to ranked view with badges.

## Risks / open questions

- **Visual treatment of the rank slot when hidden.** Two options:
  - Just don't render the badge — adjacent content shifts left slightly.
  - Render an invisible placeholder so row layout stays identical.
  Pick at implementation time based on how the rows actually look; default to "don't render" for less visual weight.
- **`partitionByThreshold` only runs in availability mode.** That's intentional and matches the design, but means if we ever add a third sort (e.g., "by maybe count") we'll need to revisit whether partitioning should be orthogonal to sort. Not a blocker.

## Files

| Change | File |
|--------|------|
| New | `src/hooks/useLocalStoragePref.ts` |
| New | `src/hooks/useLocalStoragePref.test.ts` |
| Modified | `src/components/games/schedule/RankedList.tsx` |
| Modified | `src/components/games/schedule/RankedList.test.tsx` |
| Modified | `src/components/games/schedule/RankedRow.tsx` (add `showRank` prop) |
| New | `e2e/tests/scheduling/suggestions-sort-toggle.spec.ts` (alongside the existing `schedule-tab-redesign.spec.ts`) |
