# Membership RLS Security Audit & Fix — 2026-06-10

**Status:** Fixed in `schema.sql` + app code. Production DB needs the migration in §7.
**Scope of this doc:** The two **critical** holes in the game-membership model — how they
were found, how they were *verified* (including a false-pass that nearly hid one), the fix,
and what remains open. Written so another session can review the reasoning end-to-end.

---

## 1. Risk model (why RLS is load-bearing)

The browser talks to Postgres **directly** with the Supabase anon key
(`supabase.from(...).insert(...)` runs client-side). There is no API tier in front of most
writes. Therefore **RLS is the entire authorization layer** for client traffic — a policy
that fails to forbid something *is* the vulnerability, because the attacker writes their own
request and is not limited to what the UI sends.

The weakest trust boundary in the app is **player → co-GM/GM**. Co-GM grants the power to edit
the game, add/delete sessions, add play dates, and remove other (non-co-GM) members. The two
critical findings both let an ordinary authenticated user cross that boundary.

Relevant tables: `games` (owner = `gm_id`), `game_memberships` (`user_id`, `is_co_gm`),
joined via an `invite_code` (nanoid-10, ~60 bits) that lives on `games`.

---

## 2. Critical finding A — co-GM privilege escalation on join

**Where:** `supabase/schema.sql`, policy `"Users can join games"` (pre-fix):

```sql
CREATE POLICY "Users can join games" ON game_memberships
  FOR INSERT WITH CHECK (
    (select auth.uid()) = user_id
    AND public.count_game_players(game_id) < 50
  );
```

The `WITH CHECK` constrains *who* (`user_id = auth.uid()`) and *capacity* — but **nothing
constrains `is_co_gm`**, and there is no INSERT trigger to reset it. So a crafted insert:

```js
supabase.from('game_memberships').insert({ game_id, user_id: myUid, is_co_gm: true })
```

makes the caller an instant co-GM of any game whose `game_id` they know. `is_co_gm` is only
ever *meant* to be set by the GM via UPDATE (`toggleCoGm`), but the INSERT path let the client
set it directly.

---

## 3. Critical finding B — no invite-code enforcement on join

**Where:** same policy. The invite code is verified in exactly one place —
`src/app/api/games/invite/[code]/route.ts` — but that route is a **display lookup** (code →
game preview) for the join page. The actual write is a **separate** anon-key insert
(`joinGame` → `src/lib/data/memberships.ts`) that never sees the code. RLS, the only check on
that write, requires only `auth.uid() = user_id` and capacity.

**Consequence:** any authenticated user who learns a game's UUID — which appears in every
`/games/[id]` URL a member ever opened — can join uninvited. Combined with Finding A, a bare
`game_id` is enough to seize co-GM control of a stranger's game.

The structural root cause: a *row-level* INSERT policy was the wrong tool. The secret it needed
to check (`invite_code`) lives on a **different table** (`games`), and a column it needed to
constrain (`is_co_gm`) is **client-supplied**. RLS guards rows; it cannot express "look up a
secret on another table and decide every column server-side."

---

## 4. Verification — and the false-pass that almost hid Finding A

The first regression tests **passed when they should have failed** — a worse outcome than no
test. Root-causing that (instead of trusting green) was the crux of the audit:

1. **Symptom:** a direct membership insert via the existing `supabaseRestCall` helper returned
   `403 / 42501 "new row violates row-level security policy"`, so no row appeared and the
   "attacker is not a member" assertion passed.
2. **Ruled out auth:** a throwaway `whoami()` RPC and a `debug_join_check()` RPC proved that at
   REST time `auth.uid() = attacker.id`, `current_user = authenticated`, `count_players = 1`.
   Every `WITH CHECK` input was satisfied — yet the insert was rejected.
3. **psql ground truth:** simulating PostgREST's context (`SET ROLE authenticated` + injected
   `request.jwt.claims`), the self-insert **succeeded**, and a **negative control**
   (`user_id ≠ auth.uid()`) was correctly rejected — proving RLS *was* enforced and the policy
   genuinely *allows* the non-member self-insert. The vulnerability is real.
4. **The discriminator:** the same REST insert with `Prefer: return=minimal` → **201, row
   created**; with `Prefer: return=representation` → **403 + rollback**.

**Root cause of the false-pass:** `return=representation` makes PostgREST run a post-insert
visibility SELECT. The `game_memberships` SELECT policy (`is_game_participant`) depends on the
row *just inserted*, which the `SECURITY DEFINER` lookup can't see in that snapshot, so the
representation SELECT fails and **rolls the insert back**. The shared helper hardcodes
`return=representation`; the real app's `joinGame` uses `.insert()` with **no `.select()`**
(`return=minimal`), which is why production joins — and the attack — actually succeed.

**Fix to the test:** perform the attack with `return=minimal` (faithful to the real join path).
The tests then fail red for the right reason (attacker becomes co-GM / member), and go green
after the fix.

---

## 5. The fix

**Strategy:** remove the direct INSERT policy entirely and funnel all joins through a
`SECURITY DEFINER` RPC. With no permissive INSERT policy, authenticated users cannot
self-insert at all — closing **both** A and B at once.

- **New RPC** `public.join_game_by_invite(invite_code_param TEXT)` (`schema.sql`): resolves the
  game **by invite code**, rejects unknown codes (`P0002`) and full games (`P0001`), no-ops for
  the GM, and inserts the membership with `is_co_gm = FALSE` hard-coded. `SECURITY DEFINER` +
  `SET search_path = ''`; `EXECUTE` revoked from `PUBLIC`, granted to `authenticated`.
- **Removed** the `"Users can join games"` INSERT policy (replaced by an explanatory comment).
- **App:** `joinGame(supabase, inviteCode)` now calls the RPC; `join/[code]/page.tsx` passes the
  invite `code` and maps `P0001`/`P0002` to user-facing messages.

**Why nothing legitimate breaks:** joins → RPC (definer, bypasses RLS); co-GM promotion →
GM-only UPDATE; account-deletion transfers & test seeding → service-role client (bypasses RLS);
GM game-creation never inserts a membership. `is_co_gm` can now only become true via the GM's
UPDATE, governed by `"GMs can update memberships"`.

---

## 6. Test status

New spec: `e2e/tests/rls/critical-security.spec.ts`

- 3 attack tests (co-GM self-grant; join-by-id without code; direct rejoin-after-kick) — red
  before the fix, **green** after (all three blocked).
- 2 RPC tests — valid code joins as a regular player (`is_co_gm = false`); invalid code joins
  nothing.

Regression: `games/join-game`, `dashboard/games`, `rls/policy-enforcement`, `rls/rls-hardening`
= **35 passed** (UI join flow works through the RPC). `npm run lint` ✅ · `npm run build` ✅.

Reproduce: `npm run db:start` then
`npx playwright test e2e/tests/rls/critical-security.spec.ts --project=chromium`.

---

## 7. Production deployment (required)

`schema.sql` covers fresh installs and the CI/local DB (reset from it). The **existing
production DB** needs a one-off migration (per `CLAUDE.md`, not committed beside the schema
change). Deploy it **together with** the app code — they are coupled; after the policy drop the
old direct-insert join path stops working.

```sql
DROP POLICY IF EXISTS "Users can join games" ON public.game_memberships;

CREATE OR REPLACE FUNCTION public.join_game_by_invite(invite_code_param TEXT)
RETURNS UUID AS $$
DECLARE v_uid UUID := (SELECT auth.uid()); v_game_id UUID; v_gm_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT id, gm_id INTO v_game_id, v_gm_id FROM public.games WHERE invite_code = invite_code_param;
  IF v_game_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code' USING ERRCODE = 'P0002'; END IF;
  IF v_gm_id = v_uid THEN RETURN v_game_id; END IF;
  IF public.count_game_players(v_game_id) >= 50 THEN RAISE EXCEPTION 'Game is full' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.game_memberships (game_id, user_id, is_co_gm)
  VALUES (v_game_id, v_uid, FALSE) ON CONFLICT (game_id, user_id) DO NOTHING;
  RETURN v_game_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.join_game_by_invite(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.join_game_by_invite(TEXT) TO authenticated;
```

---

## 8. Still open (from the same audit, NOT addressed here)

A reviewer should know these were found but deliberately left for follow-up:

- **Missing `WITH CHECK` on UPDATE policies** for `sessions`, `availability`, `games` — lets
  GM/co-GM/users mutate `game_id`/`confirmed_by`/`invite_code` they shouldn't. Fix pattern:
  column-freeze triggers.
- **Helper functions are `EXECUTE`-to-PUBLIC** (`count_game_players`, `is_game_participant`,
  etc.) — count/membership oracles callable by anon via RPC. Revoke + grant to `authenticated`.
- **`users.email` visible to all co-participants** via `shares_game_with`.
- **Calendar feed keyed by the invite code** (`api/games/calendar/[code]`) leaks session
  `location`/`notes` to anyone who ever saw an invite link; decouple to a rotatable token.
- **`/api/test-auth`** gated only on `NODE_ENV`; add the `isLocalSupabase()` check and stop
  committing `TEST_AUTH_SECRET`.

---

## 9. Reviewer checklist

- [ ] Confirm no remaining authenticated INSERT path into `game_memberships` other than the RPC
      (`grep "game_memberships" src | grep insert`).
- [ ] Confirm the RPC forces `is_co_gm = FALSE` and resolves by `invite_code`, not `game_id`.
- [ ] Confirm `EXECUTE` on the RPC is `authenticated`-only (not `PUBLIC`/`anon`).
- [ ] Confirm the attack tests use `return=minimal` (else they false-pass — see §4).
- [ ] Confirm the production migration in §7 is scheduled with the app deploy.
```
