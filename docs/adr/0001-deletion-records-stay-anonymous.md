# Deletion records stay anonymous

Deletion records hold counts, dates (to the day) and flags about what was deleted, and never an id, name, email or any text a user wrote. We wanted to answer questions like "how old was that game and how many players did it have?", and storing the game's id or name would have made records easier to trace, but the privacy policy promises that deleting an account permanently removes the profile, availability and memberships, and a record that names what was deleted would quietly break that promise. Records that belong to the same act (an account deletion and the games it took with it) are tied together by a database transaction number, which says nothing about who or what they were.

## Consequences

- A deletion record can never be matched back to a specific user or game, including by an admin investigating a complaint. That is the point, and it cannot be undone later: facts that were never stored cannot be recovered.
- New facts added to a record must pass the same test: a count, a day-precision date or a flag. Free text and exact timestamps of user actions fail it.
