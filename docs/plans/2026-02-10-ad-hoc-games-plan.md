# Ad-Hoc Games & Play Date Notes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ad-hoc scheduling mode (games with no regular play days) and GM notes on play dates, while migrating special_play_dates from an array column to a normalized table.

**Architecture:** New `game_play_dates` table replaces the `special_play_dates DATE[]` array with a normalized structure that also holds notes. A dual-source read layer merges legacy array + new table during transition. New `ad_hoc_only` boolean on `games` controls whether play days are required.

**Tech Stack:** Next.js 16 App Router, Supabase PostgreSQL, TypeScript, Vitest (unit), Playwright (E2E)

**Design doc:** `docs/plans/2026-02-10-ad-hoc-games-design.md`

---

### Task 1: Database Schema Changes

**Files:**
- Modify: `supabase/schema.sql`

**Step 1: Add `ad_hoc_only` column to games table**

In `supabase/schema.sql`, add `ad_hoc_only BOOLEAN NOT NULL DEFAULT false` to the `games` table definition (after `min_players_needed`).

**Step 2: Add `game_play_dates` table**

Add after the `sessions` table definition:

```sql
-- Game Play Dates table (normalized special play dates with optional notes)
CREATE TABLE game_play_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, date)
);
```

**Step 3: Add indexes for game_play_dates**

In the indexes section:

```sql
CREATE INDEX idx_game_play_dates_game_id ON game_play_dates(game_id);
CREATE INDEX idx_game_play_dates_date ON game_play_dates(date);
```

**Step 4: Add RLS policies for game_play_dates**

In the RLS section:

```sql
ALTER TABLE game_play_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game participants can view play dates" ON game_play_dates
  FOR SELECT USING (public.is_game_participant(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can insert play dates" ON game_play_dates
  FOR INSERT WITH CHECK (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can update play dates" ON game_play_dates
  FOR UPDATE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can delete play dates" ON game_play_dates
  FOR DELETE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
```

**Step 5: Add the `game_play_dates` table to the `resetDatabaseSchema` drop list**

In `e2e/helpers/seed.ts`, add `game_play_dates` to the `dropSql` string (before `sessions`) and to the `cleanDatabase` tables array (before `sessions`).

**Step 6: Commit**

```
feat: add game_play_dates table and ad_hoc_only column to schema
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add `ad_hoc_only` to the `Game` interface**

Add after `min_players_needed`:

```typescript
ad_hoc_only: boolean;
```

**Step 2: Add `GamePlayDate` interface**

Add after the `Game` interface:

```typescript
export interface GamePlayDate {
  id: string;
  game_id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  note: string | null;
  created_at: string;
}
```

**Step 3: Commit**

```
feat: add GamePlayDate type and ad_hoc_only to Game interface
```

---

### Task 3: Game Validation — TDD

**Files:**
- Modify: `src/lib/gameValidation.ts`
- Modify: `src/lib/gameValidation.test.ts`

**Step 1: Write new failing tests**

Add to `src/lib/gameValidation.test.ts`:

```typescript
it("passes with no play days when adHocOnly is true", () => {
  const result = validateGameForm({
    name: "Ad Hoc Game",
    playDays: [],
    adHocOnly: true,
  });

  expect(result.valid).toBe(true);
  expect(result.errors).toEqual([]);
});

it("still fails with no play days when adHocOnly is false", () => {
  const result = validateGameForm({
    name: "Regular Game",
    playDays: [],
    adHocOnly: false,
  });

  expect(result.valid).toBe(false);
  expect(result.errors).toContain("Please select at least one play day");
});

it("still fails with no play days when adHocOnly is undefined", () => {
  const result = validateGameForm({
    name: "Regular Game",
    playDays: [],
  });

  expect(result.valid).toBe(false);
  expect(result.errors).toContain("Please select at least one play day");
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/gameValidation.test.ts`
Expected: FAIL — `GameFormData` doesn't have `adHocOnly`

**Step 3: Update `GameFormData` and `validateGameForm`**

In `src/lib/gameValidation.ts`:

Add `adHocOnly?: boolean;` to `GameFormData`.

Update the play days validation (lines 35-38) to:

```typescript
if (!data.adHocOnly && (!data.playDays || data.playDays.length === 0)) {
  errors.push("Please select at least one play day");
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/gameValidation.test.ts`
Expected: All PASS

**Step 5: Commit**

```
feat: allow empty play days when adHocOnly is true in validation
```

---

### Task 4: Special Play Dates Service — Dual-Source Logic (TDD)

This is the core of the zero-downtime migration. Create a utility that merges legacy `special_play_dates` array with `game_play_dates` table rows.

**Files:**
- Create: `src/lib/specialPlayDates.ts`
- Create: `src/lib/specialPlayDates.test.ts`

**Step 1: Write failing tests**

Create `src/lib/specialPlayDates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mergeSpecialPlayDates, type GamePlayDateEntry } from "./specialPlayDates";

describe("mergeSpecialPlayDates", () => {
  // TEMPORARY: Remove these tests when legacy support is dropped (step 3 of migration)

  it("returns dates from legacy array only", () => {
    const result = mergeSpecialPlayDates(
      ["2026-03-01", "2026-03-05"],
      []
    );
    expect(result).toEqual([
      { date: "2026-03-01", note: null },
      { date: "2026-03-05", note: null },
    ]);
  });

  it("returns dates from new table only", () => {
    const tableRows: GamePlayDateEntry[] = [
      { date: "2026-03-01", note: "Only after 2pm" },
      { date: "2026-03-05", note: null },
    ];
    const result = mergeSpecialPlayDates([], tableRows);
    expect(result).toEqual([
      { date: "2026-03-01", note: "Only after 2pm" },
      { date: "2026-03-05", note: null },
    ]);
  });

  it("deduplicates dates present in both sources, preferring table (has notes)", () => {
    const tableRows: GamePlayDateEntry[] = [
      { date: "2026-03-01", note: "Moved to 5pm" },
    ];
    const result = mergeSpecialPlayDates(
      ["2026-03-01", "2026-03-05"],
      tableRows
    );
    expect(result).toEqual([
      { date: "2026-03-01", note: "Moved to 5pm" },
      { date: "2026-03-05", note: null },
    ]);
  });

  it("returns empty array when both sources are empty", () => {
    const result = mergeSpecialPlayDates([], []);
    expect(result).toEqual([]);
  });

  it("sorts results by date", () => {
    const tableRows: GamePlayDateEntry[] = [
      { date: "2026-03-10", note: null },
    ];
    const result = mergeSpecialPlayDates(
      ["2026-03-01", "2026-03-15"],
      tableRows
    );
    expect(result.map((d) => d.date)).toEqual([
      "2026-03-01",
      "2026-03-10",
      "2026-03-15",
    ]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/specialPlayDates.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Implement the merge utility**

Create `src/lib/specialPlayDates.ts`:

```typescript
/**
 * Dual-source special play dates utilities.
 *
 * TEMPORARY: This module supports reading from both the legacy
 * `games.special_play_dates` array column AND the new `game_play_dates` table.
 * Remove legacy support after data migration (step 3).
 */

export interface GamePlayDateEntry {
  date: string; // YYYY-MM-DD
  note: string | null;
}

/**
 * Merge special play dates from legacy array and new table, deduplicating by date.
 * When a date exists in both sources, the table entry wins (it may have a note).
 * Results are sorted by date ascending.
 */
export function mergeSpecialPlayDates(
  legacyDates: string[],
  tableRows: GamePlayDateEntry[]
): GamePlayDateEntry[] {
  const dateMap = new Map<string, GamePlayDateEntry>();

  // Legacy dates first (no notes)
  for (const date of legacyDates) {
    dateMap.set(date, { date, note: null });
  }

  // Table rows override legacy (may have notes)
  for (const row of tableRows) {
    dateMap.set(row.date, { date: row.date, note: row.note });
  }

  return Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/specialPlayDates.test.ts`
Expected: All PASS

**Step 5: Commit**

```
feat: add dual-source special play dates merge utility
```

---

### Task 5: Constants Update

**Files:**
- Modify: `src/lib/constants.ts`

**Step 1: Add note length limit**

Add to `TEXT_LIMITS`:

```typescript
PLAY_DATE_NOTE: 200,
```

**Step 2: Commit**

```
feat: add PLAY_DATE_NOTE text limit constant
```

---

### Task 6: Game Creation Form — Ad-Hoc Toggle

**Files:**
- Modify: `src/app/games/new/page.tsx`

**Step 1: Add `adHocOnly` state**

Add after the `playDays` state declaration (line 23):

```typescript
const [adHocOnly, setAdHocOnly] = useState(false);
```

**Step 2: Update validation call**

Change line 80 to pass `adHocOnly`:

```typescript
const validation = validateGameForm({ name, description, playDays, adHocOnly });
```

**Step 3: Add `ad_hoc_only` to the insert**

In the `.insert()` call (lines 97-109), add:

```typescript
ad_hoc_only: adHocOnly,
```

**Step 4: Add ad-hoc toggle UI**

Before the play days `<div>` (line 180), add:

```tsx
<div className="flex items-center gap-3">
  <label className="relative inline-flex items-center cursor-pointer">
    <input
      type="checkbox"
      checked={adHocOnly}
      onChange={(e) => {
        setAdHocOnly(e.target.checked);
        if (e.target.checked) setPlayDays([]);
      }}
      className="sr-only peer"
    />
    <div className="w-9 h-5 bg-secondary rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
  </label>
  <span className="text-sm font-medium text-foreground">
    Ad-hoc scheduling only
  </span>
</div>

{adHocOnly && (
  <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
    <p className="text-sm text-warning-foreground">
      No dates will appear on the calendar automatically. You&apos;ll need to add each potential play date manually from the game calendar using the + button.
    </p>
  </div>
)}
```

**Step 5: Conditionally hide play day buttons**

Wrap the existing play days `<div>` (lines 180-203) in:

```tsx
{!adHocOnly && (
  <div>
    {/* existing play days UI */}
  </div>
)}
```

**Step 6: Build check**

Run: `npm run build`
Expected: SUCCESS

**Step 7: Commit**

```
feat: add ad-hoc scheduling toggle to game creation form
```

---

### Task 7: Game Edit Form — Ad-Hoc Toggle + Conversion

**Files:**
- Modify: `src/app/games/[id]/edit/page.tsx`

**Step 1: Add state**

Add after the `minPlayersNeeded` state (line 31):

```typescript
const [adHocOnly, setAdHocOnly] = useState(false);
const [conversionMessage, setConversionMessage] = useState<string | null>(null);
```

**Step 2: Initialize from game data**

In the `fetchGame` function, after `setMinPlayersNeeded` (line 78), add:

```typescript
setAdHocOnly(data.ad_hoc_only || false);
```

**Step 3: Update validation call**

Change line 101:

```typescript
const validation = validateGameForm({ name, playDays, adHocOnly });
```

**Step 4: Add `ad_hoc_only` to the update and handle conversion**

In the `handleSave` function, before the supabase update call, add conversion logic for when an existing game is being switched to ad-hoc mode:

```typescript
// If switching to ad-hoc, preserve confirmed session dates as special play dates
if (adHocOnly && !game.ad_hoc_only) {
  const { data: futureSessions } = await supabase
    .from('sessions')
    .select('date')
    .eq('game_id', gameId)
    .gte('date', new Date().toISOString().split('T')[0]);

  if (futureSessions && futureSessions.length > 0) {
    const sessionDates = futureSessions.map((s) => s.date);
    // Insert into game_play_dates (ignore conflicts for dates that already exist)
    for (const date of sessionDates) {
      await supabase
        .from('game_play_dates')
        .upsert({ game_id: gameId, date }, { onConflict: 'game_id,date' });
    }
    setConversionMessage(
      `${sessionDates.length} confirmed session date${sessionDates.length !== 1 ? 's were' : ' was'} preserved as special play dates.`
    );
  }
}
```

Add `ad_hoc_only: adHocOnly` to the `.update()` object.

**Step 5: Add ad-hoc toggle UI**

Same toggle UI as the creation form (Task 6 Step 4 + Step 5), positioned before the play days section. Also show `conversionMessage` if set.

**Step 6: Build check**

Run: `npm run build`
Expected: SUCCESS

**Step 7: Commit**

```
feat: add ad-hoc toggle to game edit form with session date preservation
```

---

### Task 8: Game Detail Page — Dual-Source Special Dates + Notes

This is the largest task. The game detail page needs to:
1. Fetch from `game_play_dates` table
2. Merge with legacy `special_play_dates`
3. Handle add/remove through the new table (with legacy cleanup)
4. Support note CRUD

**Files:**
- Modify: `src/app/games/[id]/page.tsx`

**Step 1: Add state for game play dates**

Add after the `otherGames` state:

```typescript
const [gamePlayDates, setGamePlayDates] = useState<GamePlayDate[]>([]);
```

Import `GamePlayDate` from `@/types` and `mergeSpecialPlayDates` from `@/lib/specialPlayDates`.

**Step 2: Fetch game_play_dates in fetchData**

After fetching sessions, add:

```typescript
// Fetch game play dates (new table)
const { data: playDateRows } = await supabase
  .from('game_play_dates')
  .select('*')
  .eq('game_id', gameId);

setGamePlayDates(playDateRows || []);
```

**Step 3: Compute merged special dates**

Add a `useMemo` that merges legacy + new table:

```typescript
const mergedSpecialDates = useMemo(() => {
  const legacyDates = game?.special_play_dates || [];
  const tableEntries = gamePlayDates.map((r) => ({
    date: r.date,
    note: r.note,
  }));
  return mergeSpecialPlayDates(legacyDates, tableEntries);
}, [game?.special_play_dates, gamePlayDates]);

// Flat date string array for calendar/suggestions
const specialDateStrings = useMemo(
  () => mergedSpecialDates.map((d) => d.date),
  [mergedSpecialDates]
);

// Note lookup map for calendar
const playDateNotes = useMemo(
  () => new Map(mergedSpecialDates.filter((d) => d.note).map((d) => [d.date, d.note!])),
  [mergedSpecialDates]
);
```

**Step 4: Replace all usages of `game.special_play_dates`**

Replace:
- `game.special_play_dates || []` → `specialDateStrings` (in suggestions calculation, calendar props, copy availability, etc.)
- Update `playerCompletionPercentages` to use `specialDateStrings`

**Step 5: Rewrite `handleToggleSpecialDate` for dual-source writes**

Replace the existing function with:

```typescript
const handleToggleSpecialDate = async (date: string) => {
  if (!gameId || !game) return;

  const isCurrentlySpecial = specialDateStrings.includes(date);

  if (isCurrentlySpecial) {
    // Remove: delete from new table + legacy array
    const existingRow = gamePlayDates.find((r) => r.date === date);
    if (existingRow) {
      setGamePlayDates((prev) => prev.filter((r) => r.date !== date));
      await supabase.from('game_play_dates').delete().eq('game_id', gameId).eq('date', date);
    }
    // Also clean from legacy array
    const legacyDates = game.special_play_dates || [];
    if (legacyDates.includes(date)) {
      const newLegacy = legacyDates.filter((d) => d !== date);
      setGame((prev) => prev ? { ...prev, special_play_dates: newLegacy } : prev);
      await supabase.from('games').update({ special_play_dates: newLegacy }).eq('id', gameId);
    }
  } else {
    // Add: insert into new table only
    const newRow = { game_id: gameId, date, note: null };
    const tempRow: GamePlayDate = {
      id: 'temp-' + date,
      game_id: gameId,
      date,
      note: null,
      created_at: new Date().toISOString(),
    };
    setGamePlayDates((prev) => [...prev, tempRow].sort((a, b) => a.date.localeCompare(b.date)));

    const { data, error } = await supabase
      .from('game_play_dates')
      .insert(newRow)
      .select()
      .single();

    if (error) {
      setGamePlayDates((prev) => prev.filter((r) => r.date !== date));
    } else if (data) {
      setGamePlayDates((prev) =>
        prev.map((r) => (r.id === tempRow.id ? (data as GamePlayDate) : r))
      );
    }
  }
};
```

**Step 6: Add note update handler**

```typescript
const handleUpdatePlayDateNote = async (date: string, note: string | null) => {
  if (!gameId) return;

  // Ensure a row exists in game_play_dates
  const existing = gamePlayDates.find((r) => r.date === date);
  if (existing) {
    // Update note
    setGamePlayDates((prev) =>
      prev.map((r) => (r.date === date ? { ...r, note } : r))
    );
    await supabase.from('game_play_dates').update({ note }).eq('game_id', gameId).eq('date', date);
  } else {
    // Insert new row with note
    const tempRow: GamePlayDate = {
      id: 'temp-' + date,
      game_id: gameId,
      date,
      note,
      created_at: new Date().toISOString(),
    };
    setGamePlayDates((prev) => [...prev, tempRow]);
    const { data } = await supabase
      .from('game_play_dates')
      .upsert({ game_id: gameId, date, note }, { onConflict: 'game_id,date' })
      .select()
      .single();
    if (data) {
      setGamePlayDates((prev) =>
        prev.map((r) => (r.id === tempRow.id ? (data as GamePlayDate) : r))
      );
    }
  }
};
```

**Step 7: Pass new props to AvailabilityCalendar**

Add `playDateNotes`, `onUpdatePlayDateNote`, and `adHocOnly={game.ad_hoc_only}` props to the calendar.

**Step 8: Pass notes to SchedulingSuggestions**

Add `playDateNotes` prop.

**Step 9: Update ad-hoc specific messaging**

In the availability tab, if `game.ad_hoc_only` and `specialDateStrings.length === 0` and not GM, show:

```tsx
<p className="text-muted-foreground">
  Your GM adds play dates manually — check back for new dates.
</p>
```

**Step 10: Build check**

Run: `npm run build`
Expected: SUCCESS

**Step 11: Commit**

```
feat: wire game detail page to dual-source special play dates with notes
```

---

### Task 9: Calendar Component — Notes & Ad-Hoc Support

**Files:**
- Modify: `src/components/calendar/AvailabilityCalendar.tsx`

**Step 1: Add new props to AvailabilityCalendarProps**

```typescript
playDateNotes?: Map<string, string>;
onUpdatePlayDateNote?: (date: string, note: string | null) => void;
adHocOnly?: boolean;
```

**Step 2: Thread props to MonthCalendar**

Add `playDateNotes`, `onUpdatePlayDateNote`, and `adHocOnly` to `MonthCalendarProps` and pass them through.

**Step 3: Update `canAddAsSpecial` for ad-hoc games**

In the MonthCalendar day rendering, change `canAddAsSpecial`:

```typescript
const canAddAsSpecial =
  isGmOrCoGm && !isRegularPlayDay && !isSpecialPlayDate && !isPast;
```

This already works for ad-hoc games since `playDays` is empty, so ALL days are non-regular-play-days, meaning the `+` icon shows on everything.

**Step 4: Add GM note icon and note indicator**

In the day cell rendering, after the existing comment icon block, add a note indicator for dates with GM notes:

```tsx
{/* GM play date note indicator */}
{isPlayDay && !isPast && playDateNotes?.has(dateStr) && (
  <span
    className={`absolute top-0.5 right-0.5 leading-none ${
      isGmOrCoGm
        ? "cursor-pointer hover:scale-125 transition-all"
        : "pointer-events-none"
    }`}
    onClick={(e) => {
      if (isGmOrCoGm) {
        e.stopPropagation();
        onUpdatePlayDateNote && handleEditPlayDateNote(dateStr);
      }
    }}
    title={playDateNotes.get(dateStr)}
  >
    <FileText className="w-2.5 h-2.5 text-primary" />
  </span>
)}
```

Import `FileText` from `lucide-react`.

**Step 5: Add GM note to long-press popover and NoteEditorPopover**

Update the NoteEditorPopover to optionally show a GM note section:
- Add `gmNote?: string | null` and `onGmNoteChange?: (note: string | null) => void` and `isGmOrCoGm?: boolean` props
- When `gmNote` is not undefined, show a "Date note (visible to all)" field above the player note
- GMs can edit it; players see it read-only

**Step 6: Update the action menu for GM long-press on special dates**

The action menu already has "Add/Edit note" — update `handleActionMenuEditNote` to also support GM notes (open the note editor which now includes the GM note field).

**Step 7: Update bulk actions for ad-hoc games**

In the bulk actions bar, when `adHocOnly` is true (or `playDays.length === 0`), hide the day-specific options from the dropdown and only show "remaining days":

```tsx
{playDays.length > 0 && playDays.map((day) => (
  <option key={day} value={day}>
    {DAY_LABELS.full[day]}s
  </option>
))}
```

This already works since `playDays.map()` on empty array produces nothing.

**Step 8: Update tooltip to include GM note**

In the tooltip building section, add after the comment tooltip:

```typescript
const gmNote = playDateNotes?.get(dateStr);
if (gmNote) {
  tooltipParts.push(`GM note: ${gmNote}`);
}
```

**Step 9: Build check**

Run: `npm run build`
Expected: SUCCESS

**Step 10: Commit**

```
feat: add play date notes and ad-hoc mode support to calendar
```

---

### Task 10: Display Components — Dashboard & GameDetailsCard

**Files:**
- Modify: `src/components/dashboard/DashboardContent.tsx`
- Modify: `src/components/games/GameDetailsCard.tsx`

**Step 1: Update DashboardContent**

In the game card play days display (line 168), handle ad-hoc:

```tsx
<span className="flex items-center gap-1.5">
  <Calendar className="w-4 h-4" />
  {game.ad_hoc_only
    ? "Ad-hoc"
    : game.play_days.map((d) => DAY_LABELS.short[d]).join(", ")}
</span>
```

Note: `GameWithGM` already extends `Game` which will have `ad_hoc_only` after the type update.

**Step 2: Update GameDetailsCard**

Add `adHocOnly?: boolean` to props.

Update the play days display (lines 52-57):

```tsx
<div>
  <p className="text-sm text-muted-foreground">
    {adHocOnly ? "Scheduling" : "Play Days"}
  </p>
  <p className="text-card-foreground">
    {adHocOnly
      ? "Ad-hoc dates only"
      : playDays.map((d) => DAY_LABELS.full[d]).join(", ")}
  </p>
</div>
```

**Step 3: Pass `adHocOnly` from game detail page**

In `src/app/games/[id]/page.tsx`, add `adHocOnly={game.ad_hoc_only}` to the `<GameDetailsCard>` props.

**Step 4: Build check**

Run: `npm run build`
Expected: SUCCESS

**Step 5: Commit**

```
feat: show ad-hoc label in dashboard and game details card
```

---

### Task 11: Scheduling Suggestions — Notes Display

**Files:**
- Modify: `src/components/games/SchedulingSuggestions.tsx`

**Step 1: Add `playDateNotes` prop**

```typescript
playDateNotes?: Map<string, string>;
```

**Step 2: Display note in suggestion rows**

In the date rendering section, after the date/day-of-week display, add:

```tsx
{playDateNotes?.has(suggestion.date) && (
  <p className="text-xs text-muted-foreground mt-0.5 italic">
    {playDateNotes.get(suggestion.date)}
  </p>
)}
```

**Step 3: Build check**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Commit**

```
feat: show GM play date notes in scheduling suggestions
```

---

### Task 12: E2E Test Helpers Update

**Files:**
- Modify: `e2e/helpers/seed.ts`

**Step 1: Add `ad_hoc_only` to `TestGame` interface and `createTestGame`**

Add `ad_hoc_only?: boolean` to the `createTestGame` options and `TestGame` interface:

```typescript
ad_hoc_only: options.ad_hoc_only || false,
```

**Step 2: Add `createGamePlayDate` and `setPlayDateNote` helpers**

```typescript
export async function createGamePlayDate(
  gameId: string,
  date: string,
  note?: string | null
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('game_play_dates')
    .upsert(
      { game_id: gameId, date, note: note ?? null },
      { onConflict: 'game_id,date' }
    );
  if (error) {
    throw new Error(`Failed to create game play date: ${error.message}`);
  }
}
```

**Step 3: Commit**

```
feat: update E2E seed helpers for game_play_dates and ad_hoc_only
```

---

### Task 13: Unit Tests — Dual-Source & Notes Integration

**Files:**
- Modify: `src/lib/specialPlayDates.test.ts` (extend)
- Modify: `src/lib/availability.test.ts` (if exists, or skip)
- Modify: `src/lib/bulkAvailability.test.ts` (if exists, or skip)

**Step 1: Add more merge edge case tests**

```typescript
it("handles legacy dates with null/undefined gracefully", () => {
  const result = mergeSpecialPlayDates(
    undefined as unknown as string[],
    []
  );
  // Should handle gracefully or we ensure callers always pass []
});
```

**Step 2: Run all unit tests**

Run: `npm run test:run`
Expected: All PASS

**Step 3: Commit**

```
test: add edge case tests for dual-source special play dates
```

---

### Task 14: Full Build & Smoke Test

**Step 1: Run build**

Run: `npm run build`
Expected: SUCCESS with no type errors

**Step 2: Run all unit tests**

Run: `npm run test:run`
Expected: All PASS

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Commit any fixes**

If any issues found, fix and commit.

---

### Task 15: Migration File for Production

**Files:**
- Create: `supabase/migrations/20260210000000_add_game_play_dates.sql`

This is the migration file a human will apply to production. It does NOT touch the legacy column — just adds the new table and column.

```sql
-- Add ad_hoc_only column to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS ad_hoc_only BOOLEAN NOT NULL DEFAULT false;

-- Create game_play_dates table
CREATE TABLE IF NOT EXISTS game_play_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_play_dates_game_id ON game_play_dates(game_id);
CREATE INDEX IF NOT EXISTS idx_game_play_dates_date ON game_play_dates(date);

-- RLS
ALTER TABLE game_play_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game participants can view play dates" ON game_play_dates
  FOR SELECT USING (public.is_game_participant(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can insert play dates" ON game_play_dates
  FOR INSERT WITH CHECK (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can update play dates" ON game_play_dates
  FOR UPDATE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
CREATE POLICY "GMs and co-GMs can delete play dates" ON game_play_dates
  FOR DELETE USING (public.is_game_gm_or_co_gm(game_id, (select auth.uid())));
```

**Step 1: Create the migration file**

**Step 2: Commit**

```
chore: add production migration for game_play_dates table
```

---

## Task Dependency Summary

```
Task 1 (schema) → Task 2 (types) → Task 3 (validation)
                                   → Task 4 (merge utility)
                                   → Task 5 (constants)
                                      ↓
                   Task 6 (create form) ←──┤
                   Task 7 (edit form) ←────┤
                                           ↓
                   Task 8 (game detail page) — depends on 4, 6, 7
                                           ↓
                   Task 9 (calendar) — depends on 8
                   Task 10 (display) — depends on 2
                   Task 11 (suggestions) — depends on 8
                   Task 12 (E2E helpers) — depends on 1
                   Task 13 (unit tests) — depends on 4
                   Task 14 (build check) — depends on all above
                   Task 15 (migration file) — independent
```
