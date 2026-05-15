# Bangalore Homes (demo-site)

Deliberately-broken Next.js real-estate site used as the demo target for the
Autonomous Growth Engineer. The agent pipeline operates on this codebase:
crawls it, finds the SEO/perf gaps, opens a PR with fixes, and produces a
visible Lighthouse before/after.

## Intentional defects (do not fix manually)

- Bare-minimum `<title>`, no `<meta description>`, no OG/Twitter, no canonical.
- No `schema.org` JSON-LD (Organization, RealEstateListing, BreadcrumbList).
- No `sitemap.xml`, no `robots.txt`.
- No locality landing pages (Whitefield/Sarjapur/Indiranagar etc.).
- Images are raw `<img>` tags (no `next/image`).
- Duplicate / generic `<h1>` on home, multiple `<h1>` per page.
- No `generateMetadata` per route.

The agent should fix some subset of these and open a PR.

## Run locally

```bash
pnpm install
pnpm dev   # http://localhost:3200
```

## Push to your own GitHub for the demo

```bash
cd demo-site
git init
git add -A
git commit -m "initial demo target"
gh repo create bangalore-homes-demo --public --source=. --push
```

Then connect that repo + a fresh Vercel project. The dashboard's "new run" form
takes this repo URL.
