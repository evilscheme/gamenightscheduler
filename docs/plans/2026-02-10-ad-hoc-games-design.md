# Ad-Hoc Games & Play Date Notes

## Summary

Add support for "ad-hoc scheduling only" games that have no regular play days — the GM manually creates every potential play date. Additionally, allow GMs to attach notes to any play date (regular or special) to convey context like "only after 2pm" or "different location today".

## Database Changes

### New table: `game_play_dates`

```sql
CREATE TABLE game_play_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, date)
);
```

Replaces the `games.special_play_dates DATE[]` column with a normalized table that also supports notes.

### New column on `games`

```sql
ad_hoc_only BOOLEAN NOT NULL DEFAULT false
```

### Migration strategy (zero-downtime, three steps)

1. **Deploy code**: App reads from both `games.special_play_dates` (legacy array) AND `game_play_dates` (new table), merging/deduplicating by date. Writes go to the new table only. Removals clean from both sources.
2. **Run migration**: Move all legacy array data into `game_play_dates` rows, then clear the arrays.
3. **Deploy cleanup**: Remove legacy read/write code, drop the column.

**Read behavior**: Union of legacy array + new table rows, deduplicated by date. Notes only come from the new table (legacy dates have no notes).

**Write behavior**:
- **Add date**: Insert into `game_play_dates` only
- **Remove date**: Delete from `game_play_dates` AND remove from `special_play_dates` array
- **Add/edit note**: Update `game_play_dates` row only

## Ad-Hoc Mode UX

### Game creation & edit forms

- Explicit checkbox/switch above play days section: **"Ad-hoc scheduling only"**
- When toggled ON:
  - Play day buttons collapse/hide
  - Amber info box appears: "No dates will appear on the calendar automatically. You'll need to add each potential play date manually from the game calendar using the + button."
  - `playDays` state is cleared
- When toggled OFF:
  - Play day buttons reappear, info box disappears

### Converting existing game to ad-hoc

When a GM toggles ad-hoc on for an existing game:
1. Clear `play_days`
2. Query future confirmed sessions for this game
3. Auto-create `game_play_dates` entries for those dates
4. Show note: "X confirmed session dates were preserved as special play dates" (if any)

Existing availability data stays in DB (harmless) but dates without play date entries won't appear on the calendar.

### Validation

- `playDays` can be empty when `adHocOnly` is true
- `playDays` must have at least one entry when `adHocOnly` is false (unchanged)

## Play Date Notes UX

### Desktop

- Dates with notes show a small note icon in the calendar cell
- Hovering the icon shows the note text in a tooltip
- GMs see a pencil/edit icon on hover for any play date — clicking opens a popover with a text input
- If a note exists, the edit icon replaces the note icon on hover

### Mobile

- Small note icon on the date cell signals a note exists
- Long-press popover shows a read-only "GM note" section at the top (visible to all players)
- For GMs, that section is editable instead of read-only

### Suggestions list

- Dates with GM notes show the note text below the date in the scheduling suggestions section

## Display Changes

### Game details card

- Ad-hoc games show "Scheduling: Ad-hoc dates only" instead of "Play Days: Mon, Wed, Fri"

### Dashboard game cards

- Ad-hoc games show "Ad-hoc" instead of short day labels

### Bulk availability

- Day-specific dropdown filters hidden for ad-hoc games (no recurring days)
- "Mark all remaining" still works on special dates

### Player messaging

- Ad-hoc games show: "Your GM adds play dates manually — check back for new dates"

### Calendar for ad-hoc games

- `+` icon appears on ALL future dates for GM (since there are no regular play days)
- Empty state when zero dates added: "Add potential play dates by clicking the + on any date"

## Edge Cases

- **Ad-hoc game with zero dates**: Calendar renders normally, all dates gray/disabled, GM sees `+` icons, suggestion list shows empty state
- **Converting to ad-hoc**: Confirmed session dates auto-preserved as special play dates
- **Converting back to regular**: Play days re-selected, special dates remain alongside
- **Availability on removed dates**: Data stays in DB, reappears if date is re-added

## Testing Plan

### Temporary tests (remove in step 3)

- Dual-source merge: dates in legacy array only, new table only, and both (dedup)
- Write path: new dates go only to `game_play_dates`
- Remove path: cleans from both sources
- Notes: only served from new table, legacy dates have no notes

### Permanent tests

- Ad-hoc toggle validation: empty play days allowed when `ad_hoc_only` true, rejected when false
- Conversion to ad-hoc: confirmed session dates become `game_play_dates` entries
- Notes CRUD: add, edit, remove notes on play dates
- Calendar rendering: ad-hoc game shows `+` on all future dates for GM
- Bulk availability: day-specific filters hidden for ad-hoc games
- E2E: create ad-hoc game, add special dates, mark availability, verify suggestions
