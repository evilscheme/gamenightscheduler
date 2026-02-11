# Ad-Hoc Games & Play Date Notes — Migration Runbook

**Branch:** `feature/ad-hoc-games`
**PR:** (to be created)

---

## Overview

This feature introduces two things:

1. **Ad-hoc scheduling mode** — games with no fixed play days; GM adds dates manually
2. **Play date notes** — GM-visible notes attached to special play dates

The data model changes from a `DATE[]` array column (`games.special_play_dates`) to a normalized table (`game_play_dates`) with an optional `note` column. The deployed code includes **dual-source compatibility** that reads from both the old array and the new table during the transition period.

---

## What Changes

### Schema (additive, safe to apply first)

| Change | Details |
|--------|---------|
| New column | `games.ad_hoc_only BOOLEAN NOT NULL DEFAULT false` |
| New table | `game_play_dates (id, game_id, date, note, created_at)` with `UNIQUE(game_id, date)` |
| New indexes | `idx_game_play_dates_game_id`, `idx_game_play_dates_date` |
| New RLS policies | SELECT for participants, INSERT/UPDATE/DELETE for GM/co-GM |

### Compatibility code (to be removed later)

| Location | What it does |
|----------|--------------|
| `src/lib/specialPlayDates.ts` | `mergeSpecialPlayDates()` — deduplicates old array + new table |
| `src/lib/specialPlayDates.test.ts` | Unit tests for the merge utility |
| `src/app/games/[id]/page.tsx:85-91` | Merges both sources into a single list |
| `src/app/games/[id]/page.tsx:652-668` | On delete, also cleans the legacy array |
| `src/types/index.ts:22` | `special_play_dates` field on `Game` type |
| `e2e/helpers/seed.ts:34,58,73,141` | Seed helper still sets legacy array |
| `e2e/tests/games/special-play-dates.spec.ts:119,160,206,290` | E2E tests seed via legacy array |

---

## Migration Steps

### Phase 1: Deploy Schema

**When:** Anytime before or alongside the code deploy
**Risk:** None — purely additive with safe defaults
**Rollback:** Drop column + drop table (no data loss since nothing writes to them yet)

Apply the migration SQL via Supabase dashboard SQL editor or psql:

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

> **Note:** This SQL is NOT committed as a migration file. The repo uses a symlinked
> `schema.sql` as the initial migration — a separate migration file would cause
> "already exists" errors in CI. Run this manually against production only.

**Verify:**

```sql
-- Confirm column exists with correct default
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'games' AND column_name = 'ad_hoc_only';

-- Confirm table exists
SELECT count(*) FROM game_play_dates;  -- Should return 0

-- Confirm RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'game_play_dates';
```

---

### Phase 2: Deploy Code

**When:** After schema is applied (code references the new column/table)
**Risk:** Low — dual-source reads mean existing data still works

Merge the PR and deploy. After deploy:

- New play dates are written to `game_play_dates` table only
- Reads merge both `games.special_play_dates` (legacy) and `game_play_dates` (new)
- Deleting a play date removes from both sources if present
- All existing games continue to work with their legacy array data

**Verify in production:**

1. Open an existing game with special play dates — they should still appear
2. Add a new special play date — should work
3. Remove an old (legacy) special play date — should work
4. Create a new ad-hoc game — should work

---

### Phase 3: Migrate Legacy Data

**When:** After code deploy is stable (give it a day to confirm no issues)
**Risk:** Low — idempotent, non-destructive

```sql
-- Copy all legacy special_play_dates array entries into the new table
INSERT INTO game_play_dates (game_id, date)
SELECT g.id, unnest(g.special_play_dates)
FROM games g
WHERE array_length(g.special_play_dates, 1) > 0
ON CONFLICT (game_id, date) DO NOTHING;
```

**Verify:**

```sql
-- Count migrated rows
SELECT count(*) FROM game_play_dates;

-- Spot-check: compare a game's legacy array vs table rows
SELECT g.id, g.special_play_dates, array_agg(gpd.date ORDER BY gpd.date) AS table_dates
FROM games g
LEFT JOIN game_play_dates gpd ON gpd.game_id = g.id
WHERE array_length(g.special_play_dates, 1) > 0
GROUP BY g.id, g.special_play_dates
LIMIT 10;
```

After verification, clear the legacy arrays:

```sql
-- Clear legacy arrays (compatibility code handles empty arrays gracefully)
UPDATE games SET special_play_dates = '{}' WHERE special_play_dates != '{}';
```

---

### Phase 4: Wait for Old Client Code to Age Out

**When:** After legacy data is migrated and cleared
**How long:** 1 week is plenty

The concern here is that users with stale browser tabs might still have the **old** JavaScript bundle cached (pre-deploy code that only reads from `games.special_play_dates`). Since we cleared the arrays in Phase 3, those old clients would see empty play dates until they refresh.

**Mitigating factors:**

- Next.js App Router uses chunked builds with content-hashed filenames — stale tabs will get a full-page reload on next navigation when chunks don't match
- The only window of risk is a tab that was open before deploy and hasn't navigated since
- After Phase 3 clears the arrays, the merge utility returns the same data (table-only) regardless of code version
- Realistically, no user keeps a tab open for more than a few days without refreshing

**Recommendation:** Wait **1 week** after Phase 3 before proceeding to Phase 5. This is conservative and accounts for weekends where users might not visit.

---

### Phase 5: Remove Compatibility Code & Drop Legacy Column

**When:** 1 week after Phase 3
**Branch:** Create a new cleanup branch

#### 5a. Code cleanup

Remove dual-source merge logic and legacy array references:

| File | Action |
|------|--------|
| `src/lib/specialPlayDates.ts` | **Delete file** |
| `src/lib/specialPlayDates.test.ts` | **Delete file** |
| `src/app/games/[id]/page.tsx` | Remove `mergeSpecialPlayDates` import; read only from `game_play_dates` table; remove legacy array cleanup in delete handler (lines 652-668) |
| `src/types/index.ts` | Remove `special_play_dates` from `Game` type |
| `e2e/helpers/seed.ts` | Remove `special_play_dates` from seed options and `createGame` |
| `e2e/tests/games/special-play-dates.spec.ts` | Update tests to seed via `game_play_dates` table instead of legacy array |

#### 5b. Schema cleanup

After the cleanup code is deployed:

```sql
-- Drop the legacy column
ALTER TABLE games DROP COLUMN special_play_dates;
```

Or update `supabase/schema.sql` to remove the column and apply.

#### 5c. Verify

- Run full E2E suite
- Run `npm run build` to confirm no TypeScript errors referencing removed fields
- Spot-check production: existing games still show play dates

---

## Rollback Plan

| Phase | Rollback |
|-------|----------|
| 1 (schema) | `DROP TABLE game_play_dates; ALTER TABLE games DROP COLUMN ad_hoc_only;` — safe, nothing uses them yet |
| 2 (code) | Revert the merge commit / redeploy previous version. Legacy array still intact. |
| 3 (data migration) | No action needed — data exists in both places, code reads both |
| 3 (array clearing) | Re-run data migration in reverse: `UPDATE games SET special_play_dates = ARRAY(SELECT date FROM game_play_dates WHERE game_id = games.id);` |
| 5 (cleanup) | Revert code + re-add column. But this is why we wait a week — by then we're confident. |

---

## Timeline Summary

```
Day 0:  Phase 1 — Apply schema migration
Day 0:  Phase 2 — Merge PR, deploy code
Day 1:  Phase 3 — Migrate legacy data, clear old arrays
Day 8:  Phase 5 — Remove compatibility code, drop column
```

Total transition period: ~1 week
