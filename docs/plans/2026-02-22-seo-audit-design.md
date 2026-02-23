# SEO Audit Fixes — Design

## Scope (This Pass)

### 1. Title template in root layout
Change root metadata title to `{ template: '%s | Can We Play?', default: 'Can We Play? - Game Night Scheduler' }`.

### 2. Improved root description
Replace thin description with: "Schedule your tabletop game nights with ease. Players mark availability, get smart date suggestions, and export confirmed sessions to your calendar."

### 3. Per-page metadata
Add `layout.tsx` files exporting metadata for each public route:

| Route | Title | Description |
|---|---|---|
| `/help` | "Help & Guide" | "Learn how to create games, mark availability, schedule sessions, and get the most out of Can We Play?" |
| `/login` | "Sign In" | "Sign in with Google or Discord to start scheduling your tabletop game nights" |
| `/privacy` | "Privacy Policy" | "How Can We Play? handles your data — what we collect, how we use it, and your rights" |
| `/terms` | "Terms of Service" | "Terms and conditions for using Can We Play?, the free tabletop game night scheduler" |

### 4. robots.ts
Allow: `/`, `/help`, `/privacy`, `/terms`, `/login`, `/games/join/*`
Disallow: `/dashboard`, `/games`, `/settings`, `/admin`, `/api/`, `/dev-login`
Include sitemap reference.

### 5. sitemap.ts
List the 5 public pages with `lastModified` dates.

### 6. Canonical URLs
Add `alternates: { canonical: '/' }` to root metadata.

### 7. favicon.ico
Generate from existing `icon.png` and place in `src/app/`.

### 8. Custom 404 page
Branded `not-found.tsx` with logo, message, and link home.

## Deferred (Second Pass)

- Structured data / JSON-LD (`SoftwareApplication` schema on home page)
- Heading hierarchy fixes (help page h2 nesting, dashboard h1→h3 skip)
- ARIA tab roles on game detail and admin pages
- ARIA dropdown improvements on help menu
- `loading.tsx` files for route segments
- `colorScheme` in viewport export
- Twitter `site`/`creator` handles
- Maskable icon with proper safe-zone padding
- Skip-to-content link
- Service Worker for offline PWA support
- `<header>` / `<footer>` semantic landmarks
