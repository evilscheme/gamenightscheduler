# Account Deletion Improvements

*2026-02-21T20:55:20Z by Showboat 0.6.0*
<!-- showboat-id: fc57739e-d42c-4ec7-ad49-9a751225ca2d -->

This PR builds on the account deletion feature (PR #84) with documentation updates, UI improvements, and test infrastructure. Here's a walkthrough of the changes.

## 1. Documentation Updates

Updated README.md, CLAUDE.md, privacy policy, and terms of service to reflect the self-service account deletion feature.

```bash
git diff HEAD~1 -- README.md
```

```output
diff --git a/README.md b/README.md
index c9012da..e2c981e 100644
--- a/README.md
+++ b/README.md
@@ -18,6 +18,7 @@ A web app to help groups coordinate game nights. Hosts create games, players mar
 - **Special Play Dates**: Schedule one-off sessions outside regular play days
 - **Internationalization**: Timezone support, configurable week start day, and 12h/24h time format
 - **Installable**: Add to your home screen as a PWA on mobile devices
+- **Account Deletion**: Self-service account deletion with game transfer or deletion options
 - **Past Sessions**: View history of completed game nights
 
 ## Tech Stack
@@ -86,6 +87,7 @@ Open [http://localhost:3000](http://localhost:3000)
 5. View **suggested dates** ranked by player availability
 6. **Confirm sessions** and set specific times
 7. **Export to calendar** via .ics download or subscribe via webcal:// URL
+8. **Manage your account** in Settings — update preferences or delete your account
 
 ## Testing
 
@@ -120,7 +122,7 @@ src/
 │   ├── login/             # Login page
 │   ├── privacy/           # Privacy policy
 │   ├── terms/             # Terms of service
-│   └── settings/          # User settings
+│   └── settings/          # User settings and account deletion
 ├── components/
 │   ├── calendar/          # Availability calendar with bulk actions
 │   ├── dashboard/         # Dashboard content and empty states
```

```bash
git diff HEAD~1 -- CLAUDE.md | head -40
```

```output
diff --git a/CLAUDE.md b/CLAUDE.md
index d280cd2..500e507 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -161,6 +161,22 @@ RLS uses `auth.uid()` and helper functions (SECURITY DEFINER) like `is_game_part
   - Separates upcoming vs past sessions
   - Export to calendar (.ics download or webcal://)
 
+### Account Deletion
+
+Self-service account deletion is accessed from Settings > Danger Zone. The flow is a multi-step wizard:
+
+1. **Preview** — `/api/account/delete-preview` fetches owned games (with members), and games the user is a player in
+2. **Decisions** — For games with other players, the user chooses to delete or transfer each game to another member
+3. **Confirmation** — Summary of actions with `DELETE` confirmation word
+4. **Execution** — `/api/account/delete` processes transfers, deletes `public.users` (cascading to games, memberships, availability, sessions), then deletes `auth.users`
+
+Key files:
+- `src/app/settings/delete-account/page.tsx` — Deletion wizard UI
+- `src/app/api/account/delete-preview/route.ts` — Preview API
+- `src/app/api/account/delete/route.ts` — Deletion API
+- `scripts/delete-user.ts` — Admin CLI tool (`npx tsx scripts/delete-user.ts <email-or-uuid>`)
+- `e2e/tests/settings/delete-account.spec.ts` — E2E tests
+
 ### E2E Testing
 
 Tests are in `e2e/tests/` organized by feature. The test harness uses:
```

## 2. Privacy Policy & Terms of Service

Both legal pages previously directed users to "contact us via the feedback link" for account deletion. Now they describe the self-service flow.

```bash
git diff HEAD~1 -- src/app/privacy/page.tsx src/app/terms/page.tsx
```

```output
diff --git a/src/app/privacy/page.tsx b/src/app/privacy/page.tsx
index 8035923..a34b2c4 100644
--- a/src/app/privacy/page.tsx
+++ b/src/app/privacy/page.tsx
@@ -103,9 +103,15 @@ export default function PrivacyPage() {
 
         <Section title="Data Retention & Deletion">
           <p>
-            Your data is retained as long as you have an account. If you want your data deleted,
-            contact us using the feedback link in the app and we will remove your account and
-            all associated data.
+            Your data is retained as long as you have an account. You can delete your account
+            at any time from{' '}
+            <a href="/settings" className="text-primary hover:underline">Settings</a>{' '}
+            &gt; Danger Zone &gt; Delete Account. This permanently removes your profile,
+            availability data, and game memberships.
+          </p>
+          <p>
+            For games you own, you will be asked to either delete the game or transfer ownership
+            to another player before your account is removed.
           </p>
         </Section>
 
diff --git a/src/app/terms/page.tsx b/src/app/terms/page.tsx
index 0ee5d21..7097c70 100644
--- a/src/app/terms/page.tsx
+++ b/src/app/terms/page.tsx
@@ -84,8 +84,11 @@ export default function TermsPage() {
         <Section title="Account Termination">
           <p>
             We reserve the right to suspend or terminate accounts that violate these terms.
-            If you want to delete your account, contact us using the feedback link in the app
-            and we will remove your account and all associated data.
+            You can delete your account at any time from{' '}
+            <a href="/settings" className="text-primary hover:underline">Settings</a>{' '}
+            &gt; Danger Zone &gt; Delete Account. Deletion is permanent and removes your profile,
+            availability data, and game memberships. For games you own, you will be asked to
+            either delete them or transfer ownership to another player.
           </p>
         </Section>
 
```

## 3. Explicit Game Lists in Deletion Preview

The confirmation step previously showed only counts (e.g. "1 game will be deleted"). Now it lists each game by name, including transfer targets (e.g. "Transfer Game → Player Name"). The API was also expanded to return player membership game names instead of just a count.

```bash
git diff HEAD~1 -- src/app/api/account/delete-preview/route.ts
```

```output
diff --git a/src/app/api/account/delete-preview/route.ts b/src/app/api/account/delete-preview/route.ts
index b5a2b9a..9cc7bc1 100644
--- a/src/app/api/account/delete-preview/route.ts
+++ b/src/app/api/account/delete-preview/route.ts
@@ -13,9 +13,15 @@ export interface OwnedGame {
   members: OwnedGameMember[];
 }
 
+export interface PlayerMembershipGame {
+  id: string;
+  name: string;
+}
+
 export interface DeletePreview {
   ownedGames: OwnedGame[];
   playerMembershipCount: number;
+  playerMembershipGames: PlayerMembershipGame[];
 }
 
 export async function GET(): Promise<Response> {
@@ -43,17 +49,25 @@ export async function GET(): Promise<Response> {
     return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
   }
 
-  // Count player memberships in games the user doesn't own
-  const { count: membershipCount, error: membershipError } = await admin
+  // Fetch player memberships with game names
+  const { data: membershipRows, error: membershipError } = await admin
     .from('game_memberships')
-    .select('id', { count: 'exact', head: true })
+    .select('game_id, games(id, name)')
     .eq('user_id', user.id);
 
   if (membershipError) {
-    console.error('delete-preview: failed to fetch membership count', membershipError);
+    console.error('delete-preview: failed to fetch membership data', membershipError);
     return NextResponse.json({ error: 'Failed to fetch membership data' }, { status: 500 });
   }
 
+  const playerMembershipGames: PlayerMembershipGame[] = (membershipRows ?? []).map((row) => {
+    const g = Array.isArray(row.games) ? row.games[0] : row.games;
+    return {
+      id: row.game_id,
+      name: (g as { id: string; name: string } | null)?.name ?? 'Unknown',
+    };
+  }).sort((a, b) => a.name.localeCompare(b.name));
+
   const preview: DeletePreview = {
     ownedGames: (ownedGames ?? []).map((game) => ({
       id: game.id,
@@ -63,7 +77,8 @@ export async function GET(): Promise<Response> {
         return { id: m.user_id, name: (u as { id: string; name: string } | null)?.name ?? 'Unknown' };
       }),
     })),
-    playerMembershipCount: membershipCount ?? 0,
+    playerMembershipCount: playerMembershipGames.length,
+    playerMembershipGames,
   };
 
   return NextResponse.json(preview);
```

```bash
git diff HEAD~1 -- src/app/settings/delete-account/page.tsx
```

```output
diff --git a/src/app/settings/delete-account/page.tsx b/src/app/settings/delete-account/page.tsx
index 3ee87b6..3d2b3a1 100644
--- a/src/app/settings/delete-account/page.tsx
+++ b/src/app/settings/delete-account/page.tsx
@@ -17,9 +17,15 @@ interface OwnedGame {
   members: OwnedGameMember[];
 }
 
+interface PlayerMembershipGame {
+  id: string;
+  name: string;
+}
+
 interface DeletePreview {
   ownedGames: OwnedGame[];
   playerMembershipCount: number;
+  playerMembershipGames: PlayerMembershipGame[];
 }
 
 type GameDecision =
@@ -256,32 +262,64 @@ export default function DeleteAccountPage() {
                 What will be deleted
               </h2>
             </CardHeader>
-            <CardContent>
-              <ul className="space-y-2 text-sm">
+            <CardContent className="space-y-4">
+              <ul className="space-y-3 text-sm">
                 {gamesBeingDeleted > 0 && (
                   <li className="text-foreground">
-                    <span className="font-medium">{gamesBeingDeleted}</span>{' '}
-                    {gamesBeingDeleted === 1 ? 'game' : 'games'} you own will be permanently
-                    deleted, including all sessions, availability, and player data within{' '}
-                    {gamesBeingDeleted === 1 ? 'it' : 'them'}.
+                    <p className="font-medium">
+                      {gamesBeingDeleted} {gamesBeingDeleted === 1 ? 'game' : 'games'} will be
+                      permanently deleted, including all sessions, availability, and player data:
+                    </p>
+                    <ul className="mt-1.5 ml-4 space-y-0.5 text-muted-foreground">
+                      {[
+                        ...soloGames.map((g) => g.name),
+                        ...multiMemberGames
+                          .filter((g) => decisions[g.id]?.action === 'delete')
+                          .map((g) => g.name),
+                      ].map((name) => (
+                        <li key={name}>{name}</li>
+                      ))}
+                    </ul>
                   </li>
                 )}
                 {gamesBeingTransferred > 0 && (
                   <li className="text-foreground">
-                    <span className="font-medium">{gamesBeingTransferred}</span>{' '}
-                    {gamesBeingTransferred === 1 ? 'game' : 'games'} will be transferred to a
-                    new GM. Those games and their data will be preserved.
+                    <p className="font-medium">
+                      {gamesBeingTransferred} {gamesBeingTransferred === 1 ? 'game' : 'games'} will
+                      be transferred to a new GM:
+                    </p>
+                    <ul className="mt-1.5 ml-4 space-y-0.5 text-muted-foreground">
+                      {multiMemberGames
+                        .filter((g) => decisions[g.id]?.action === 'transfer')
+                        .map((g) => {
+                          const d = decisions[g.id];
+                          const newGm = d?.action === 'transfer'
+                            ? g.members.find((m) => m.id === d.newGmId)
+                            : null;
+                          return (
+                            <li key={g.id}>
+                              {g.name} → {newGm?.name ?? 'Unknown'}
+                            </li>
+                          );
+                        })}
+                    </ul>
                   </li>
                 )}
-                {(preview?.playerMembershipCount ?? 0) > 0 && (
+                {(preview?.playerMembershipGames?.length ?? 0) > 0 && (
                   <li className="text-foreground">
-                    You will be removed from{' '}
-                    <span className="font-medium">{preview!.playerMembershipCount}</span>{' '}
-                    {preview!.playerMembershipCount === 1 ? 'game' : 'games'} as a player. Your
-                    availability in those games will be deleted.
+                    <p className="font-medium">
+                      You will be removed from{' '}
+                      {preview!.playerMembershipGames.length}{' '}
+                      {preview!.playerMembershipGames.length === 1 ? 'game' : 'games'} as a player:
+                    </p>
+                    <ul className="mt-1.5 ml-4 space-y-0.5 text-muted-foreground">
+                      {preview!.playerMembershipGames.map((g) => (
+                        <li key={g.id}>{g.name}</li>
+                      ))}
+                    </ul>
                   </li>
                 )}
-                <li className="text-foreground">
+                <li className="text-foreground font-medium">
                   Your account and all personal data will be permanently deleted.
                 </li>
               </ul>
```

## 4. Shared DB Assertions Helper

Extracted the 10 database verification functions from the test file into a reusable `e2e/helpers/db-assertions.ts` module. This pattern makes it easy for future tests to verify database state without duplicating query logic.

```bash
cat e2e/helpers/db-assertions.ts | head -30
```

```output
/**
 * Shared database assertion helpers for E2E tests.
 *
 * These query the database directly via the admin client to verify
 * that operations (like account deletion) produced the expected state.
 */

import { getAdminClient } from './seed';

export async function userExistsInDb(userId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin.from('users').select('id').eq('id', userId).maybeSingle();
  return data !== null;
}

export async function authUserExistsInDb(userId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user !== null;
}

export async function gameExistsInDb(gameId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin.from('games').select('id').eq('id', gameId).maybeSingle();
  return data !== null;
}

export async function gameMembershipsForUser(userId: string): Promise<number> {
  const admin = getAdminClient();
  const { count } = await admin
```

```bash
grep -c 'export async function' e2e/helpers/db-assertions.ts
```

```output
10
```

## 5. Mixed Scenario Test

Added a comprehensive integration test that exercises all deletion paths in a single scenario: a user who owns solo games, multi-member games (some deleted, some transferred), and is a player in another user's games. This validates the full cascade behavior end-to-end.

```bash
sed -n '/mixed GM and member games/,/^});$/p' e2e/tests/settings/delete-account.spec.ts | head -50
```

```output
test.describe('Delete Account — mixed GM and member games', () => {
  test('handles solo games, multi-member delete, multi-member transfer, and player memberships', async ({
    page,
    request,
  }) => {
    const ts = Date.now();
    const gm = await loginTestUser(page, {
      email: `mixed-gm-${ts}@e2e.local`,
      name: 'Mixed GM',
      is_gm: true,
    });

    const player1 = await createTestUser(request, {
      email: `mixed-player1-${ts}@e2e.local`,
      name: 'Mixed Player 1',
      is_gm: false,
    });

    const player2 = await createTestUser(request, {
      email: `mixed-player2-${ts}@e2e.local`,
      name: 'Mixed Player 2',
      is_gm: true,
    });

    // --- Solo game (no other members, auto-deleted) ---
    const soloGame = await createTestGame({ gm_id: gm.id, name: 'Solo Campaign' });
    const dates = getPlayDates([5, 6], 2);
    await setAvailability(gm.id, soloGame.id, [{ date: dates[0], status: 'available' }]);

    // --- Multi-member game to DELETE ---
    const deleteGame = await createTestGame({
      gm_id: gm.id,
      name: 'Doomed Campaign',
      play_days: [5, 6],
    });
    await addPlayerToGame(deleteGame.id, player1.id);
    await setAvailability(player1.id, deleteGame.id, [{ date: dates[0], status: 'available' }]);

    // --- Multi-member game to TRANSFER ---
    const transferGame = await createTestGame({
      gm_id: gm.id,
      name: 'Inherited Campaign',
      play_days: [5, 6],
    });
    await addPlayerToGame(transferGame.id, player2.id);
    await setAvailability(player2.id, transferGame.id, [{ date: dates[0], status: 'maybe' }]);
    const pastDates = getPastPlayDates([5, 6], 2);
    await createTestSession({
      game_id: transferGame.id,
      date: pastDates[0],
```

## 6. Verification

Lint and TypeScript type checking both pass cleanly for all changed files. The build fails only due to Google Fonts being unreachable in this environment (network issue, not a code problem).

```bash
npm run lint 2>&1
```

```output

> canweplay@0.1.0 lint
> eslint

```

```bash
npx tsc --noEmit 2>&1 | grep -E '(delete-preview|delete-account|privacy|terms|db-assertions)' || echo 'No TypeScript errors in changed files'
```

```output
No TypeScript errors in changed files
```

## Summary of Changes

| Area | Change |
|------|--------|
| README.md | Added account deletion feature and usage step |
| CLAUDE.md | Documented account deletion architecture and key files |
| Privacy Policy | Self-service deletion instructions replace "contact us" |
| Terms of Service | Self-service deletion instructions replace "contact us" |
| delete-preview API | Returns game names for player memberships (not just count) |
| Deletion UI | Lists each game by name with actions in confirmation step |
| db-assertions.ts | Shared helper with 10 reusable DB verification functions |
| Mixed scenario test | Integration test covering solo + delete + transfer + player games |
