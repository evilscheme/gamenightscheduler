# Schedule tab — confirmed sessions vs. suggested dates

**Date:** 2026-07-05
**Status:** Approved (via interactive mock), implementing.

## Problem

On the schedule tab, confirmed **sessions** (`ScheduledRow`) and **suggested dates**
(`RankedRow`) look nearly identical. Both lean on the theme's **primary** hue on an
identical `bg-card` / `border-border` shell:

- Confirmed session: a `★` in `text-primary`.
- Top-ranked suggestion (#1): `border-primary/40` + `ring-1 ring-primary/15`.

So a locked-in session and a still-a-candidate date read as the same object. There is
an existing `--scheduled` token, but it equals `--primary` in every theme, so it can't
create separation on its own.

## Decision

Differentiate by **form**, within the existing palette (no new theme tokens):

1. **Confirmed upcoming sessions get a solid primary header band.** A filled
   `bg-primary` / `text-primary-foreground` strip caps the card with a "Confirmed"
   label, the date, and the `★`. The body below stays neutral (`bg-card`). Filled strip
   = decided; flat outlined card = candidate.
2. **The #1 suggestion loses its primary card frame.** Remove the `border-primary/40` +
   `ring-primary/15` highlight from the top-ranked `RankedRow`. Keep the primary
   **rank circle** and the larger `%` as the "best pick" cue. This is the other half of
   the fix — without it, the top suggestion keeps competing with confirmed sessions for
   the primary accent.
3. **Past sessions are unchanged** (already dimmed to `opacity-70`). The confusion only
   exists among *upcoming* confirmed sessions, so the band applies to upcoming only.

The transient hover ring (`ring-primary/30`, synced with the mini-calendar) stays — it's
a momentary interaction affordance, not a persistent state marker.

### Why this direction

The user wanted color-based separation that stays **within each theme's palette**
(no hardcoded "green") and works across all five themes in light/dark. Options were
mocked across every theme (`schedule-treatments.html`). Two paths were explored:

- **Path 1 — treatment only (chosen):** ① tinted fill, ② accent rail, ③ **header band**,
  ④ solid card. User picked **③ header band** (runner-up: ④ solid card).
- **Path 2 — new `--accent` token:** add a harmonized second hue per theme. Considered
  and **declined for now** in favor of the zero-token-risk band. (Recovered accent
  proposal kept below in case it's revisited.)

The chosen band wears the **existing `--primary`**, not a new token.

## Rejected / deferred: new `--accent` token

A reusable second hue per theme would give the strongest split (especially in Slate,
whose grey primary tints weakly) and a color usable app-wide. Deferred because it's a
larger, subjective change (5 themes × 2 modes = 10 hand-tuned values + `@theme inline`
map + CLAUDE.md). First-pass proposal, for the future:

| Theme  | Primary   | Proposed accent (light / dark) |
|--------|-----------|--------------------------------|
| Ocean  | sky blue  | violet `#8b5cf6` / `#a78bfa`   |
| Purple | violet    | pink `#db2777` / `#f472b6`     |
| Forest | green     | violet `#8b5cf6` / `#a78bfa`   |
| Slate  | grey      | blue `#0ea5e9` / `#38bdf8`     |
| Rose   | red-pink  | teal `#0d9488` / `#2dd4bf`     |

## Scope

- `src/components/games/schedule/ScheduledRow.tsx` — header band for upcoming confirmed.
- `src/components/games/schedule/RankedRow.tsx` — drop the #1 primary card highlight.
- `src/components/games/schedule/ScheduledRow.test.tsx` — new: band shows for upcoming,
  absent for past.

Styling stays semantic (`bg-primary`, `text-primary-foreground`) per CLAUDE.md — no
hardcoded color classes. Verify on desktop and mobile, light and dark, across themes.
