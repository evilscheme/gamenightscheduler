# Open Security Findings (deferred backlog) — 2026-06-10

Remaining findings from the RLS/server security audit, after fixing the two **critical**
membership-join holes (PR #115 — see `2026-06-10-membership-rls-audit.md`). This started as a
prioritized backlog to revisit later; some items have since shipped — see the **Progress log**
below for what's closed and check the per-row status before re-doing anything.

**Caveat for whoever picks this up:** these were surfaced on 2026-06-10. Policy names and file
paths are stable references, but exact line numbers and code shapes drift — re-confirm against
current code before acting (and apply the `return=minimal` test discipline from the audit doc
when writing RLS regression tests, or they can false-pass).

---

## Progress log

Tracked here so the table below stays honest as items ship. Each entry names the regression
test and the hand-applied production migration. Per `CLAUDE.md`, schema changes are made in
`supabase/schema.sql` (which reaches fresh DBs via the symlinked initial migration); the
`docs/migrations/*-prod.sql` files apply the same change to the **existing** production DB by
hand and are deliberately NOT committed alongside the `schema.sql` edit.

- **2026-07-02 — anon/PUBLIC EXECUTE lockdown → resolves #2 as written.** The implicit
  `EXECUTE`-to-`PUBLIC` (and a stray anon default-ACL grant) on every `public` function was
  replaced with `REVOKE … FROM PUBLIC, anon; GRANT … TO authenticated, service_role`
  (`schema.sql` grant block). The SECURITY DEFINER helpers (`count_*`, `is_*`,
  `shares_game_with`) and `join_game_by_invite` are no longer callable by **unauthenticated**
  PostgREST clients — which is exactly the fix #2 prescribed. Regression:
  `e2e/tests/rls/function-grants.spec.ts` → `Function EXECUTE grants — anon lockdown` (ACL check
  via `has_function_privilege`, so it can't REST-probe false-pass). Prod:
  `docs/migrations/2026-07-02-quick-wins-prod.sql`.
  **Residual (smaller than the original finding, still open):** an *authenticated* user can
  still call the helpers as count/membership oracles for games they're not in. This is inherent
  to referencing SECURITY DEFINER helpers inside RLS — `authenticated` MUST keep EXECUTE or
  every policy that calls them fails closed. Disposition: accept + Supabase-advisor-ignore, or
  relocate the helpers into a non-exposed `private` schema in a later pass. Tracked as the
  residual on #2.
- **2026-07-02 — test-auth hardening + bulk cap-bypass fix (bundled in the same quick-wins
  effort, merged via PR #130 = squash `c49fab4`, 2026-07-04).** Three findings moved:
  - **#12 fully fixed** (`1420000`): `isLocalSupabase()` was extracted to `src/lib/supabase/env.ts`
    and now parses `new URL(url).hostname` and compares it exactly — `localhost.attacker.com` no
    longer passes. Test: `src/lib/supabase/env.test.ts`.
  - **#11 guard fixed** (`1420000`): `/api/test-auth` now returns `404` unless `NODE_ENV` is
    development AND `isLocalSupabase()`, closing the "mint an admin against cloud creds" path.
    *Only an inert committed test secret remains* — reframed as cosmetic, not the original Med.
  - **#8 bulk vector closed** (`b844c44`): the `count_*` cap helpers are `VOLATILE`, so a single
    multi-row INSERT can't slip a whole batch past the cap on one cached count. Tests:
    `function-volatility.spec.ts`, `usage-limits-bulk.spec.ts`. The narrower cross-transaction
    race remains (still Low) — see #8.
- **2026-07-05 — trigger-only function EXECUTE lockdown (Supabase advisor lint
  `0029_authenticated_security_definer_function_executable`).** `handle_new_user`,
  `protect_user_columns`, and `protect_game_gm_id` exist ONLY as triggers. A trigger fires via
  the table's trigger machinery, which does **not** check the invoking role's EXECUTE grant, so
  the `authenticated` grant the blanket `GRANT … TO authenticated` swept onto them was pure
  advisor noise (they were never client-callable RPCs — PostgREST doesn't even route
  `trigger`-returning functions). Revoked from `authenticated` (`schema.sql`, after the grant
  block). Regression: `e2e/tests/rls/function-grants.spec.ts` → `Trigger-function EXECUTE
  lockdown` (asserts neither anon NOR authenticated holds EXECUTE), backed by the 8
  trigger-behavior tests in `rls-hardening.spec.ts` proving the triggers still fire. Prod:
  `docs/migrations/2026-07-05-trigger-fn-execute-lockdown-prod.sql` — **apply this to clear the
  3 findings on the remote advisor** (until applied, the cloud advisor still lists all of them).
  Scope note: this is advisor *hygiene* only — it does **not** address the behavioral concerns
  in #4/#5, which remain open.

---

## Important context: the "missing WITH CHECK" cluster was over-graded

The original audit flagged several UPDATE policies for lacking a `WITH CHECK` clause and rated
some **High**. On review that was too aggressive. The key Postgres semantic:

> When an UPDATE policy omits `WITH CHECK`, the `USING` expression is reused as the new-row
> check. So the post-update row must still satisfy `USING`.

For these tables `USING` already fences the actor to **their own games / their own user**, so
the missing `WITH CHECK` does **not** open a cross-tenant escalation. Concretely:

- **`sessions` UPDATE** — a `game_id` change still requires `is_game_gm_or_co_gm(new_game_id)`,
  so a session can only move into a game you already control. Moving a session between two of
  your own games is functionally identical to delete-then-recreate, which a GM can already do.
  Residual is cosmetic only (backdating `date`, or `confirmed_by` mis-attribution **within your
  own game**). **Downgraded to Low/cosmetic — possibly close.**
- **`availability` UPDATE** — `USING` requires `auth.uid() = user_id` on the new row, so you
  can't reassign availability to another user; `game_id` can only move to a game you're in. Your
  own data, your own games. **Downgraded to non-issue.**
- **`games` UPDATE** — not an RLS escalation (`gm_id` is trigger-protected). The only substance
  is "should co-GMs be able to rotate `invite_code` / edit settings, or GMs only?" — a **product
  permission decision**, not a security bug.

The one UPDATE finding that keeps real (if low) substance is membership `user_id` rewrite — see
#1 below.

---

## Database / RLS (`supabase/schema.sql`)

| # | Sev | Finding | Where | Risk → Fix |
|---|-----|---------|-------|------------|
| 1 | Low–Med | `game_memberships` UPDATE can change `user_id` | `"GMs can update memberships"` (only `game_id` is trigger-blocked) | Since joins are now self-service only, rewriting an existing member row's `user_id` is the one way a GM can **conscript a non-consenting user** into their game (and silently drop the original member). Low impact (victim gains visibility into the GM's game; no victim data leaks). → cheap `prevent_membership_user_change` trigger |
| 2 | ✅ Resolved (anon) / Low residual | Helper functions were `EXECUTE`-to-`PUBLIC` | `count_game_players`, `count_future_sessions`, `is_game_participant`, `is_game_gm_or_co_gm`, `is_membership_co_gm`, `shares_game_with` | **Anon threat closed 2026-07-02** (`REVOKE … FROM PUBLIC, anon; GRANT … TO authenticated` — see Progress log). *Residual:* an authenticated user can still oracle games they're not in; inherent to RLS-referenced SECURITY DEFINER helpers (authenticated must keep EXECUTE). → accept/advisor-ignore or move helpers to a `private` schema later. |
| 3 | Med | `users` SELECT exposes `email` + `is_admin` to all co-participants | `"Users viewable by self or co-participants"` (schema.sql:454) | Every player can read every co-player's `email`/`is_admin`. **Reachable through normal app usage, not just a direct REST probe** — `src/lib/data/games.ts` and `memberships.ts` both fetch `users(*)`, so every party-panel render already ships these fields to the browser. → mask via a view or split public-profile fields. Privacy call (upper end of Med). |
| 4 | Med | `protect_game_gm_id` silently reverts instead of raising | trigger fn | UPDATE returns 200 with the change swallowed; misleads callers/audit. → `RAISE EXCEPTION`. |
| 5 | Med | `protect_user_columns` keys "is service role" off `auth.uid() IS NULL` | trigger fn | Safe from the browser, but a future migration run as `postgres` would bypass the column freeze. → check role explicitly. |
| 6 | Low | `availability` DELETE has no participant check | `"Users can delete own availability"` | Inconsistent with INSERT; minimal real risk. |
| 7 | Low | `sessions.confirmed_by` accepts any user UUID | column FK | Mis-attribution only. → validate participant or set server-side. |
| 8 | Low | TOCTOU on the 20-game / 100-session caps | INSERT policies; `count_*` helpers | **Bulk vector closed 2026-07-02** (`b844c44`): the `count_*` cap helpers are `VOLATILE`, so a single multi-row INSERT can no longer slip the whole batch past the cap on one cached count (tests `function-volatility.spec.ts`, `usage-limits-bulk.spec.ts`; schema.sql:231/249/264). *Residual:* genuine **cross-transaction** races under READ COMMITTED still overshoot by a small margin — each concurrent tx counts against its own snapshot. Fully closing needs an advisory lock / `SERIALIZABLE` / constraint-backed counter. |
| 9 | Info | No `TO authenticated` scoping on policies | all policies | Anon needlessly evaluates SECURITY DEFINER predicates; clarity/perf, not a hole. Side effect of #2's anon-EXECUTE revoke: an anon request hitting such a policy now gets *permission-denied-for-function* rather than a clean empty set (still fails closed); `TO authenticated` would make it a clean no-match. |
| — | Closed | `sessions` / `availability` / `games` UPDATE "no WITH CHECK" | — | See over-grading note above. Cosmetic / non-issue / product decision. |

## Server routes & app config

| # | Sev | Finding | Where | Risk → Fix |
|---|-----|---------|-------|------------|
| 10 | Med | Calendar feed = invite code as a permanent, unauth bearer token; leaks `location`/`notes` | `src/app/api/games/calendar/[code]/route.ts` | Anyone who ever saw an invite link can read the schedule + meeting addresses forever; only revocation is rotating the code (breaks everyone's subscription). → separate rotatable `calendar_token`; meanwhile drop/opt-in `location`/`notes`. *Most user-impactful; biggest change (schema + token flow + UI).* |
| 11 | ✅ Fixed (guard) / Low residual | `/api/test-auth` was gated only on `NODE_ENV` | `src/app/api/test-auth/route.ts:41,193,247` | **Guard shipped 2026-07-02** (`1420000`): every handler now returns `404` unless `NODE_ENV==='development'` AND `isLocalSupabase()`, closing the cloud-admin-minting path — the old "no `isLocalSupabase()` check" rationale is now false. *Residual (cosmetic):* `TEST_AUTH_SECRET='test-secret-for-e2e'` is still committed (`playwright.config.ts:100`, `e2e/*`), but it's inert — the route only responds under localhost dev. |
| 12 | ✅ Fixed | `isLocalSupabase()` used a substring match | `src/lib/supabase/env.ts:5-8` (moved from `dev-login/actions.ts`) | **Fixed 2026-07-02** (`1420000`): now parses `new URL(url).hostname` and compares it exactly to `localhost` or `127.0.0.1`, so `localhost.attacker.com` no longer passes. Covered by `src/lib/supabase/env.test.ts`. |
| 13 | Low | Account deletion is non-atomic | `src/app/api/account/delete/route.ts` | N sequential admin queries; small TOCTOU + partial-failure windows (transfer commits, then user-delete could fail). → single transactional RPC. |
| 14 | Low | Calendar feed sets `Cache-Control: public` on a secret-keyed URL | `calendar/[code]/route.ts` (~:85) | Shared caches/CDNs may store it. → `private, max-age=300`. |
| 15 | Low | Rate limiting is in-memory / best-effort | `src/proxy.ts` | Resets on serverless cold start; trusts `x-forwarded-for`. Fine on Vercel, weak if self-hosted. → Vercel WAF rate-limit rules for real protection. |
| 16 | Low | CSP allows `'unsafe-inline'` / `'unsafe-eval'` in `script-src` | `next.config.ts` | Weakens CSP as XSS mitigation. → at minimum drop `'unsafe-eval'` in prod; consider nonce-based CSP. |

---

## Suggested order when we revisit

1. ~~**#2 (revoke function EXECUTE)**~~ ✅ **Done 2026-07-02** (anon threat); authenticated-oracle
   residual remains — see Progress log. ~~**#11 guard**~~ and ~~**#12 (host match)**~~ also ✅ done.
2. **#10 (calendar token decoupling)** — now the highest-impact open item; its own larger PR
   (separate rotatable `calendar_token` + schema + UI), and pairs with **#14** (cache header).
3. **#3 (email exposure)** and **#1 (membership `user_id` trigger)** — bundle with whichever RLS PR.
4. Sweep the remaining Low/Info items (#4, #5, #6, #7, #8 residual, #9, #13, #15, #16, and #11's
   cosmetic committed-secret) opportunistically.

Each RLS change should ship with a failing-first regression test in `e2e/tests/rls/` and, for
production, a standalone migration applied alongside the `schema.sql` change (per `CLAUDE.md`).

## What we deliberately are NOT treating as findings

- `sessions`/`availability`/`games` UPDATE missing `WITH CHECK` (see over-grading note).
- Strengths confirmed by the audit (kept here so they aren't re-flagged): RLS enabled on all
  tables; all helpers are `SECURITY DEFINER` + `SET search_path = ''`; server routes that use
  the service-role client do their own `getUser()`-based authz; `safeCallbackUrl` open-redirect
  protection is sound; service-role key never reaches the client bundle.
```
