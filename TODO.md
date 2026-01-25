# TODO

## More Features
- [X] implement third "maybe" state for availability, along with optional note
- [X] allow games to have a default time of day set in addition to the play days
- [X] allows game presets to be editable by the GM
- [X] show player availability in the confirmed games UI
- [X] players should be able to leave games, and GMs should be able to remove players from their games
- [X] better favicon
- [X] better app name & custom domain
- [X] better preview card for URLs when pasted to discord/messages
- [X] change selection order to "yes -> no -> maybe" when toggling availability
- [X] allow notes for all availabilities, not just "maybe"
- [X] make it more explicit that the "export" buttons export calendar invites
- [X] add "mark all remaining unspecified days as [yes/no]" capability
- [X] add a way for users to give feedback and report bugs (github issues?)
- [X] make the non-play days more visually obvious with some cross-hatching
- [X] sensible usage limits (20 games per person, 50 players per game)
- [X] make chosen game days a different color than green
- [X] only show pencil (edit) icon on hover
- [X] clean up text in places to be more accurate/explanatory
- [X] improve the experience for new users. give them big shiny buttons to do things. have everyone be a GM by default?
- [X] have a separate "past games" section for games that have occurred in the past

## Integration & Deployment
- [X] implement google OAuth
- [X] figure out deployment (Vercel?)

## Security Constraints
- [ ] games should not be publicly visible, and only visible to members and the owning GM
- [ ] users should only be able to see other users if they share one or more gamess

## Bugs
- [ ] calendar events have no timezone
- [X] light mode text can be hard to read in places
- [X] if someone is given a game join link, and they don't have a user already, when they complete the user signup flow they aren't redirected to the join URL, and there is no invite shown in their UI 
- [X] players can view games they aren't a member of
- [~] supabase URL is super sketchy, improve it! (probably can't do w/o paying)

## Technical Debt / Cleanup

### Schema Issues
- [X] Remove unused `session_status` enum values from schema: 'suggested' and 'cancelled' are never used. Sessions are created directly as 'confirmed', and cancelled sessions are deleted rather than marked as cancelled. Either remove these values or implement the intended workflow.
- [X] Schema default for sessions.status is 'suggested' but sessions are always created as 'confirmed' - change default to 'confirmed' or remove it

### Type System Issues
- [X] Duplicate `PlayerWithComment` interface defined in both `src/types/index.ts` and `src/lib/suggestions.ts` - consolidate to single exported type
- [X] `SessionStatus` type in `src/types/index.ts` is not exported but used internally - either export it or remove if unused
- [X] Multiple unsafe `as unknown as` type casts in:
  - `src/app/api/games/preview/[code]/route.ts:38` (gm relation)
  - `src/app/games/join/[code]/layout.tsx:26` (gm relation)
  - `src/app/games/[id]/page.tsx:115-119` (member relations)
  - Consider creating proper Supabase query return types

### Code Organization
- [X] `src/app/games/[id]/page.tsx` is 928 lines - extract tab content into separate components (OverviewTab, AvailabilityTab, ScheduleTab)
- [X] Suggestion calculation logic duplicated between page component and `src/lib/suggestions.ts` - use the exported utility functions instead of inline calculation
- [X] `getPlayDatesInWindow` function in availability.ts is exported but only used in tests - either use it in the app or unexport

### ESLint Suppressions (review if still needed)
- [X] `react-hooks/set-state-in-effect` disabled in ThemeContext.tsx and settings/page.tsx - valid for hydration from localStorage but should document why
- [X] `react-hooks/exhaustive-deps` disabled in multiple data-fetching useEffects - consider using React Query or SWR for cleaner data fetching
- [X] `@next/next/no-img-element` disabled for external avatar URLs - acceptable, but could use next/image with remotePatterns config

### Low Priority
- [ ] Console.error statements in API routes (admin/games, admin/stats, test-auth, calendar, invite, preview) - acceptable for error logging but could use structured logging
- [ ] Calendar events have no timezone (noted in Bugs section) - ICS DTSTART/DTEND should include TZID or use UTC

## Possible future features
- [X] have the app publish a calendar URL that clients can subscribe to?
- [X] allow for co-GMs?
- [X] allow GM to punch in special play options that aren't normally a play day?
