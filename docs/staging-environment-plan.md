# Staging Environment Plan for Supabase + Vercel

## Current State (as of Jan 2026)

- **Production Supabase**: `fgzpdwpbuccyvfyjfrqx.supabase.co`
- **Local Development**: Local Supabase via Docker (`npm run dev:local`)
- **Deployment**: Manual GitHub Actions workflow (`deploy.yml`) - requires typing "deploy" to confirm
- **No preview deployments** - PRs can't be tested before merging
- **Schema changes** have no safe cloud testing path (e.g., `migration_co_gm.sql` sits untracked)

## Options Considered

### Option 1: Separate Staging Supabase Project (~$25/month)
Create a second Supabase project for staging. All Vercel preview deployments share this one staging database.

**Pros**: Simple setup, persistent staging environment, predictable costs
**Cons**: All PRs share same DB (data conflicts possible), manual schema sync required

### Option 2: Supabase Branching (~$30-50/month) ⭐ Recommended
Use Supabase's database branching feature - creates an ephemeral database branch per PR that integrates with Vercel preview deployments.

**Pros**: Each PR gets isolated DB, migrations tested before merge, automatic cleanup when PR closes
**Cons**: Slightly higher cost, requires organizing migrations properly

### Option 3: Hybrid (~$50-75/month)
Both a persistent staging project AND branching for PR-specific testing.

**Pros**: Full flexibility
**Cons**: More complex, overkill for personal/small project

---

## Recommended: Supabase Branching + Vercel Previews

**Cost**: ~$30-50/month depending on PR activity
- Base: ~$25/mo (Supabase Pro)
- Per active branch: ~$0.32/day (~$10/mo if running continuously)
- Short-lived PR branches are cheap

### How It Works
1. You create a feature branch with a migration file
2. Supabase detects the PR and creates a preview database branch
3. The migration is applied to the preview branch automatically
4. Vercel creates a preview deployment connected to that preview database
5. You test at the preview URL with a fully isolated environment
6. When the PR merges, the migration applies to production
7. The preview branch is cleaned up automatically

---

## Implementation Steps

### Step 1: Organize Migration Files (local work)
Move standalone migration files into proper timestamped format in `supabase/migrations/`:

```
supabase/migration_co_gm.sql → supabase/migrations/20260118000000_co_gm.sql
```

Naming convention: `YYYYMMDDHHMMSS_description.sql`

### Step 2: Enable Supabase GitHub Integration (Supabase Dashboard)
1. Go to **Project Settings → Integrations → GitHub**
2. Click "Connect" and authorize the GitHub app
3. Select the `evilscheme/dndscheduler` repository
4. Enable **Branching** feature

Docs: https://supabase.com/docs/guides/deployment/branching

### Step 3: Install Supabase Vercel Integration (Vercel Dashboard)
1. Go to **Integrations → Browse Marketplace**
2. Search for "Supabase" and install
3. Connect to your Supabase organization and project
4. This auto-populates environment variables for preview deployments:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

Docs: https://vercel.com/marketplace/supabase

### Step 4: Enable Vercel Preview Deployments (Vercel Dashboard)
1. Go to **Project Settings → Git**
2. Enable automatic preview deployments for pull requests
3. Ensure production environment variables remain pointed at production Supabase (they should be separate from Preview env vars)

### Step 5: Update OAuth Redirect URLs

**Google Cloud Console** (https://console.cloud.google.com/apis/credentials):
- Add: `https://*-gamenightscheduler.vercel.app/auth/callback`
- Or use specific patterns per preview URL format

**Discord Developer Portal** (https://discord.com/developers/applications):
- Add same wildcard pattern for redirects

**Note**: Supabase branching also auto-creates redirect URLs per branch in Auth settings, but OAuth providers need the wildcards.

### Step 6: Optional - Add Seed Data for Previews
If you want preview branches to have test data:

1. Create `supabase/seed.sql` with test data
2. Update `supabase/config.toml`:
   ```toml
   [db.seed]
   enabled = true
   sql_paths = ["./seed.sql"]
   ```

---

## New Developer Workflow (Post-Implementation)

```
1. git checkout -b feature/my-new-feature
2. Create migration: supabase/migrations/20260120120000_add_feature.sql
3. git push origin feature/my-new-feature
4. Open PR on GitHub
   → Supabase creates preview DB branch with migration applied
   → Vercel deploys preview at https://feature-my-new-feature-gamenightscheduler.vercel.app
5. Test feature at preview URL (isolated DB!)
6. Make fixes, push again → preview updates
7. Merge PR
   → Migration applies to production automatically
   → Preview branch cleaned up
```

---

## Cost Breakdown

| Component | Cost |
|-----------|------|
| Supabase Pro (base) | ~$25/mo |
| Branch compute (per branch-hour) | ~$0.01344/hr |
| Typical usage (2-3 short-lived PRs/week) | ~$5-10/mo |
| **Total** | **~$30-40/mo** |

Heavy PR activity or long-running branches could push toward $50/mo.

---

## Verification Checklist

After completing setup:
- [ ] Create a test branch with trivial migration (e.g., add a column)
- [ ] Push and verify Supabase branch is created in dashboard
- [ ] Verify Vercel preview deploys with correct env vars
- [ ] Test OAuth login on preview URL
- [ ] Verify app can read/write to preview database
- [ ] Merge PR and verify migration applies to production
- [ ] Verify preview branch is cleaned up

---

## Relevant Links

- Supabase Branching: https://supabase.com/docs/guides/deployment/branching
- Supabase + Vercel Integration: https://supabase.com/docs/guides/deployment/branching/vercel
- Vercel Preview Deployments: https://vercel.com/docs/deployments/preview-deployments
- Manage Branching Usage/Costs: https://supabase.com/docs/guides/platform/manage-your-usage/branching
