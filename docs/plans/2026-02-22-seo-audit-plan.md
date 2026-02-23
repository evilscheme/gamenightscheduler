# SEO Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical and important SEO gaps identified in the audit — per-page metadata, robots.txt, sitemap, canonical URLs, favicon, custom 404.

**Architecture:** All changes use Next.js App Router metadata conventions. Public route pages are `'use client'`, so per-page metadata is exported from small `layout.tsx` wrappers. Static SEO files (`robots.ts`, `sitemap.ts`, `not-found.tsx`) live in `src/app/`.

**Tech Stack:** Next.js 16 App Router metadata API, `sips` (macOS) for favicon conversion.

---

### Task 1: Root metadata — title template, description, canonical

**Files:**
- Modify: `src/app/layout.tsx:20-42`

**Step 1: Update root metadata**

Replace the `metadata` export in `src/app/layout.tsx` with:

```typescript
export const metadata: Metadata = {
  title: {
    template: '%s | Can We Play?',
    default: 'Can We Play? - Game Night Scheduler',
  },
  description:
    'Schedule your tabletop game nights with ease. Players mark availability, get smart date suggestions, and export confirmed sessions to your calendar.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Can We Play?',
  },
  openGraph: {
    title: 'Can We Play?',
    description:
      'Schedule your tabletop game nights with ease. Players mark availability, get smart date suggestions, and export confirmed sessions to your calendar.',
    siteName: 'Can We Play?',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Can We Play?',
    description:
      'Schedule your tabletop game nights with ease. Players mark availability, get smart date suggestions, and export confirmed sessions to your calendar.',
  },
};
```

**Step 2: Fix join layout title**

The join invite layout at `src/app/games/join/[code]/layout.tsx` hardcodes ` - Can We Play?` in titles. With the template active, that would produce `Game Name - Game Invite - Can We Play? | Can We Play?`. Fix by removing the suffix from all title strings in that file:

- Line 25: `'Game Invite - Can We Play?'` → `'Game Invite'`
- Line 37: `` `${game.name} - Game Invite - Can We Play?` `` → `` `${game.name} - Game Invite` ``
- Line 52: `'Game Invite - Can We Play?'` → `'Game Invite'`

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/games/join/\[code\]/layout.tsx
git commit -m "feat(seo): add title template, improve description, add canonical URL"
```

---

### Task 2: Per-page metadata for public routes

**Files:**
- Create: `src/app/help/layout.tsx`
- Create: `src/app/login/layout.tsx`
- Create: `src/app/privacy/layout.tsx`
- Create: `src/app/terms/layout.tsx`

Each layout exports metadata and renders children. The pages themselves stay as `'use client'` — no changes needed.

**Step 1: Create `src/app/help/layout.tsx`**

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help & Guide',
  description:
    'Learn how to create games, mark availability, schedule sessions, and get the most out of Can We Play?',
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Step 2: Create `src/app/login/layout.tsx`**

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in with Google or Discord to start scheduling your tabletop game nights.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Step 3: Create `src/app/privacy/layout.tsx`**

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Can We Play? handles your data — what we collect, how we use it, and your rights.',
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Step 4: Create `src/app/terms/layout.tsx`**

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms and conditions for using Can We Play?, the free tabletop game night scheduler.',
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Check output for the routes — each should show as having metadata.

**Step 6: Commit**

```bash
git add src/app/help/layout.tsx src/app/login/layout.tsx src/app/privacy/layout.tsx src/app/terms/layout.tsx
git commit -m "feat(seo): add per-page metadata for public routes"
```

---

### Task 3: robots.ts

**Files:**
- Create: `src/app/robots.ts`

**Step 1: Create `src/app/robots.ts`**

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/help', '/privacy', '/terms', '/login', '/games/join/'],
        disallow: ['/dashboard', '/games/', '/settings', '/admin', '/api/', '/dev-login'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

Note: `/games/join/` is allowed while `/games/` is disallowed. The more specific `/games/join/` rule takes precedence for crawlers that follow the standard.

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds. The route `/robots.txt` should appear in the build output.

**Step 3: Commit**

```bash
git add src/app/robots.ts
git commit -m "feat(seo): add robots.txt with crawl rules and sitemap reference"
```

---

### Task 4: sitemap.ts

**Files:**
- Create: `src/app/sitemap.ts`

**Step 1: Create `src/app/sitemap.ts`**

```typescript
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds. The route `/sitemap.xml` should appear in the build output.

**Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): add sitemap with public pages"
```

---

### Task 5: favicon.ico

**Files:**
- Create: `src/app/favicon.ico`

**Step 1: Generate favicon.ico from icon.png using macOS `sips`**

`sips` can't produce `.ico` directly. Use `sips` to resize to 32x32 PNG, then use `xxd`/manual approach — or simpler, just copy the PNG as `favicon.ico` since modern browsers handle PNG favicons in `.ico` containers. Actually, the simplest reliable approach: use the `png-to-ico` npm package as a one-time script.

```bash
npx png-to-ico src/app/icon.png > src/app/favicon.ico
```

If `png-to-ico` isn't available or fails, an alternative:
```bash
sips -z 64 64 src/app/icon.png --out /tmp/favicon-64.png
sips -z 32 32 src/app/icon.png --out /tmp/favicon-32.png
sips -z 16 16 src/app/icon.png --out /tmp/favicon-16.png
```
Then use any online converter, or just place the 32x32 PNG renamed to `.ico` — browsers handle it.

**Step 2: Verify the file exists and has reasonable size**

```bash
ls -la src/app/favicon.ico
```

Expected: File exists, roughly 4-20KB.

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Next.js should auto-detect `favicon.ico` in `src/app/`.

**Step 4: Commit**

```bash
git add src/app/favicon.ico
git commit -m "feat(seo): add favicon.ico for legacy browser support"
```

---

### Task 6: Custom 404 page

**Files:**
- Create: `src/app/not-found.tsx`

**Step 1: Create `src/app/not-found.tsx`**

```tsx
import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="text-center">
        <Image
          src="/logo.png"
          alt="Can We Play?"
          width={96}
          height={96}
          className="mx-auto mb-6"
        />
        <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-6">
          This page doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
```

Note: This is a Server Component (no `'use client'`), which is correct for `not-found.tsx`. The Navbar renders from the root layout so it will appear above this.

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds. The `/_not-found` route should appear in the build output.

**Step 3: Commit**

```bash
git add src/app/not-found.tsx
git commit -m "feat(seo): add branded 404 page"
```

---

### Task 7: Lint and final build

**Step 1: Run lint**

Run: `npm run lint`
Expected: No new errors.

**Step 2: Run full build**

Run: `npm run build`
Expected: Clean build with all new routes visible in output.

**Step 3: Final commit (if any lint fixes were needed)**

```bash
git add -A
git commit -m "fix: lint fixes for SEO changes"
```
