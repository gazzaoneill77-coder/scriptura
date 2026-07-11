# Handoff — Dwellwise (ready for Fable 5)

The foundation is built, verified and green. This is the one file to read first:
what exists, what's proven, and exactly what to do next.

## TL;DR

**Dwellwise** is a home & smart-home buying-advice authority site — a static
Astro build with the SEO / GEO / AEO / LLMO architecture fully in place. Every
page type has a working, reusable template, five exemplar articles show the
standard, and the whole thing builds clean at a domain root and under the GitHub
Pages subpath. What remains is mostly **producing content on the established
pattern** plus a few one-time launch toggles — not building machinery.

- **Niche:** home & smart-home technology (robot vacuums, security, WiFi, climate, lighting, speakers).
- **Brand:** Dwellwise — *Smarter decisions for a better home.*
- **Stack:** Astro 7, static output, **zero runtime dependencies**, no external fonts/scripts.
- **Read next:** [CONTENT-PLAYBOOK.md](CONTENT-PLAYBOOK.md) to author; [README.md](README.md) for structure.

## What's built

- **Four-pillar architecture, baked into templates.** Semantic HTML, canonical
  URLs, Open Graph/Twitter, and JSON-LD across the board (`Organization`,
  `WebSite`, `Article`, `HowTo`, `Product`+`Review`, `FAQPage`, `CollectionPage`,
  `BreadcrumbList`, `ItemList`). Generated `sitemap.xml`, `robots.txt`,
  `llms.txt`, `rss.xml`.
- **Reusable answer-engine components.** Short-answer box, key takeaways,
  auto-building comparison tables, pros/cons, star ratings, FAQ (with schema),
  breadcrumbs, verdict cards, pick cards, affiliate CTAs, disclosure, bylines.
- **Content-as-data engine.** Articles are Markdown + frontmatter; the layout
  renders all structure. Adding a page = one file.
- **Six topic clusters** (pillars) with hub pages, FAQs and copy in
  `categories.js`.
- **Trust pages** for E-E-A-T: About, How We Test, Affiliate & Editorial
  Disclosure.
- **Design system** in one stylesheet: clean, fast, accessible, light + dark, no
  external requests.
- **Five exemplar articles** covering every page type (roundup, review,
  comparison, how-to, plus a second-cluster roundup).

## Verified before handoff

- `npm run build` — **clean, 18 pages + 4 endpoints**, root-domain config.
- `BASE_PATH=/scriptura …` build — **clean**, i.e. correct under GitHub Pages.
- All **74 JSON-LD blocks across 18 pages parse as valid JSON**; expected schema
  types present on each page type.
- **Zero stray root-relative links** in the Pages build (nothing 404s on the subpath).
- **Canonical URLs match the sitemap exactly** (trailing-slash consistent).
- **Visually reviewed** desktop + mobile (home, roundup, hub, review) — renders
  professionally and responsively.

## What's left

**Content — the main job (this is what Fable 5 scales):**

1. **Fill the clusters.** Four categories (WiFi, Climate, Lighting, Speakers)
   have hub pages but no articles yet; Robot Vacuums and Home Security have a
   start. Write roundups, reviews, comparisons and guides per
   [CONTENT-PLAYBOOK.md](CONTENT-PLAYBOOK.md).
2. **Verify and de-`sample` the exemplars.** The five seed articles are flagged
   `sample: true` (they render a "template" banner) because their prices/specs
   are illustrative. Verify the figures, add affiliate links, remove the flag —
   or replace them with freshly-researched articles.
3. **Add real authors.** Replace/augment the generic `editorial` byline in
   `authors.js` with genuine named experts + credentials for full E-E-A-T.
4. **Affiliate links.** Add real affiliate URLs to pick/product `url` fields
   (Amazon Associates + direct brand programs). Empty URLs render a safe
   "Price coming soon".

**One-time launch steps (owner/dashboard, no code):**

- **Enable GitHub Pages once:** Settings → Pages → Deploy from a branch →
  `gh-pages` / `(root)`. Auto after that.
- **Custom domain (optional):** point a real domain (e.g. `dwellwise.com`) via
  Pages + DNS. Then set `SITE_URL` in the deploy workflow and the fallback in
  `astro.config.mjs`. All URLs adapt automatically.
- **Register affiliate accounts** (Amazon Associates etc.) and add the IDs to links.

## Gotchas

- **Always route internal links/assets through `src/lib/url.js`** (`href()` /
  `absolute()`). A bare `/shop` 404s under the `/scriptura` Pages subpath. This
  is the one mistake the build won't catch.
- **JSON-LD is rendered in the document body, not the `<head>` slot** — a slot
  quirk silently dropped head-projected schema. Keep new schema in the body via
  the `JsonLd` component (that's how every current schema renders and validates).
- **Quote any frontmatter `title` containing a colon**, or YAML parsing fails
  the build.
- `sample: true` is a safety net, not decoration — it's the line between a
  template and a publishable page.

## Repo context

This branch (`claude/prepare-fable-five-handoff-czugjd`) was re-based onto the
latest `main` and then rebuilt as Dwellwise. The previous occupant of this repo —
the **NARROW.** streetwear storefront — remains intact on `main`; nothing there
was deleted. A separate open draft, **PR #6 "Maker Studio AI"**, is unrelated and
untouched.
