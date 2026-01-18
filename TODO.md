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
- [ ] add a bulk maybe option, and make those buttons a little easier to see visually
- [X] change selection order to "yes -> no -> maybe" when toggling availability
- [ ] make it more obvious that calendar cells can be clicked?
- [X] allow notes for all availabilities, not just "maybe"
- [ ] make it more explicit that the "export" buttons export calendar invites
- [ ] add "mark all remaining unspecified days as [yes/no]" capability
- [ ] add a way for users to give feedback and report bugs (github issues?)
- [X] make the non-play days more visually obvious with some cross-hatching

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
- [ ] supabase URL is super sketchy, improve it!

## Possible future features
- have the app publish a calendar URL that clients can subscribe to?
