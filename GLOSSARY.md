# Can We Play?

Scheduling for tabletop game groups: players mark when they can play, and the app finds the dates a game can run.

## Language

### People

**User**:
A person with an account, independent of any game.
_Avoid_: Player (when no particular game is meant), member

**Host**:
The user who owns a game. A host is a player of that game but is not a member of it.
_Avoid_: Owner, admin

**Player**:
A user taking part in one particular game, as its host or as a member.
_Avoid_: User (when a particular game is meant), participant

**Member**:
A player who joined a game by invite. Every player except the host is a member.
_Avoid_: Participant

### Leaving and deleting

**Deletion record**:
An anonymous note that something was deleted, with facts about what it was but nothing that identifies it.
_Avoid_: Tombstone (implies the deleted thing's identity survives), audit log

**Deliberate deletion**:
A deletion someone chose to make: deleting an account, deleting a game, cancelling a session, or a departure.

**Cascaded deletion**:
A deletion that happened only because the thing it belonged to was deliberately deleted, such as a game's sessions going with the game.

**Departure**:
A member ceasing to be in a game while the game and the user's account both continue. A member either **left** (their own choice) or was **removed** (a GM's choice).
_Avoid_: Churn, unsubscribe

**Cancellation**:
Deleting a session before its date. Deleting a session whose date has passed is not a cancellation.

**Ownership transfer**:
A member becoming the host of a game in place of the previous host. It is a change of role, not a departure.
_Avoid_: Promotion (co-GM is the role members are promoted to)
