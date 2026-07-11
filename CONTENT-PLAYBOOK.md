# Dwellwise Content Playbook

How to write a Dwellwise page that helps a human first and gets cited by every
engine second. This is the standard. Follow it and every article automatically
satisfies the four pillars — **SEO, GEO, AEO, LLMO** — because the templates do
the structural work for you.

**The deal:** you write frontmatter + prose. The layout renders the schema,
answer boxes, comparison tables, ratings, FAQ markup, breadcrumbs and internal
links. You never hand-write structured data.

---

## 1. The golden rule

Every decision, in this order:

1. **Help the visitor.** Would this genuinely help someone decide? If not, cut it.
2. **Build trust.** Name downsides. Show the running costs. Never hype.
3. **Scale cleanly.** Reuse the patterns here; don't invent one-off structures.
4. **Original quality.** No spun or templated prose. Say something true and useful.
5. **Sustainable income.** Affiliate links serve the reader's decision — never the reverse.

Never sacrifice the reader's experience for a short-term ranking trick.

---

## 2. How to add an article

1. Create `src/content/articles/<slug>.md`. The filename **is** the URL slug.
2. Set the frontmatter (section 4). `category` must match a slug in
   `src/data/categories.js`.
3. Write the body in Markdown — prose only, no components. Use `##`/`###`
   headings; the templates supply everything else.
4. Run `npm run build` and open the page. Fix, verify, publish.

To add a whole new topic cluster, add an object to `categories.js` (copy an
existing one) — the hub page, nav and sitemap update themselves.

---

## 3. The four pillars, and how each page already meets them

| Pillar | What it needs | Where it comes from |
| --- | --- | --- |
| **SEO** | Semantic HTML, canonical, metadata, clean URLs, internal links, fast pages, structured data | `Base.astro`, `ArticleLayout.astro`, `url.js`, topic-cluster routing, `global.css` (no external fonts) |
| **GEO** | Summaries, comparison tables, key takeaways, citable fact-based paragraphs, entity clarity | `summary`, `keyTakeaways`, `comparison`/`picks`, consistent terminology, `Organization` schema |
| **AEO** | Direct short answers, FAQs, featured-snippet & voice targeting | `summary` → Short Answer box, `faqs` → `FAQPage` schema, question-style H2s |
| **LLMO** | Executive summary, definitions, logical headings, pros/cons, recommendations, `llms.txt` | `keyTakeaways`, `ProsCons`, `VerdictCard`, heading hierarchy, generated `llms.txt` |

Your job is to **fill those fields well**. The wiring is done.

---

## 4. Frontmatter reference

### Fields every article shares

```yaml
title: "..."            # Quote it if it contains a colon. Front-load the keyword.
category: robot-vacuums # Must exist in categories.js
type: roundup           # roundup | review | comparison | guide | how-to
heroEmoji: "🤖"          # Lightweight visual marker
author: editorial       # Key in authors.js
publishDate: 2026-06-20
updatedDate: 2026-07-08 # Keep current — the visible date is a trust signal
description: >-         # Meta description, ~150 chars, compelling + accurate
  ...
summary: >-             # THE SHORT ANSWER. 40–60 words. A complete, direct answer
  ...                   # to the page's core question. This wins snippets & AI cites.
keyTakeaways:           # 3–6 scannable, quotable bullets = the executive summary
  - ...
faqs:                   # 2–5 real questions people ask. Answers 40–60 words, direct.
  - q: ...
    a: ...
sample: true            # SET TRUE until every fact is verified (see section 6)
draft: true             # Optional — hidden from production builds
```

### `type: roundup` (a "best X" buyer's guide) — also add:

```yaml
picks:
  - name: Product Name
    slug: product-name        # anchor id; also used by the auto comparison table
    badge: Best overall       # why it's here
    rating: 4.6               # number, out of 5
    price: "~£680"            # string; keep approximate + verify
    bestFor: most homes
    summary: One-line verdict for this pick.
    pros: [ ..., ... ]
    cons: [ ..., ... ]
    specs: { Navigation: LiDAR, Self-empty: Yes }
    url: ""                   # affiliate URL; empty renders a safe "Price coming soon"
```

A comparison table is **auto-generated** from `picks`. To supply your own
instead, add a `comparison:` block (see below).

### `type: review` (single product) — also add:

```yaml
product:
  name: Product Name
  badge: Best for pet hair
  rating: 4.4
  price: "~£799"
  bestFor: homes with pets
  verdict: The bottom line in 1–2 sentences.
  pros: [ ... ]
  cons: [ ... ]
  specs: { ... }
  url: ""
```

### `type: comparison` (X vs Y) — also add:

```yaml
comparison:
  caption: "Roborock vs eufy at a glance"
  columns:
    - { key: name, label: Brand }   # first column is the row label
    - { key: nav,  label: Navigation }
  rows:
    - { name: Roborock, best: true, badge: All-round polish, nav: "Excellent (LiDAR)" }
    - { name: eufy, nav: "Very good (LiDAR)" }
```

### `type: how-to` — optionally add `steps:` for HowTo schema:

```yaml
steps:
  - { name: Assess your floors, text: "..." }
```

`type: guide` needs no product blocks — it's prose + `summary` + `keyTakeaways`
+ `faqs`. Guides and how-tos are the safest content (general advice, no
per-product claims), so start clusters with them.

---

## 5. Writing the body

- Open by helping immediately — the reader already saw the short answer; now earn
  the read. No throat-clearing.
- **Question-shaped `##` headings** ("Do robot vacuums work with pet hair?") feed
  AEO and voice. Keep a logical `##` → `###` hierarchy (LLMO).
- Short paragraphs. One idea each. **Bold** the term being defined.
- Prefer lists and mini-tables where they answer faster than prose.
- Be specific and factual. Vague copy doesn't get cited; hedged copy doesn't
  convert.
- Link to related Dwellwise pages naturally (internal links spread authority).
- End with a clear "who should buy which" / decision recommendation.

**Voice:** helpful, plain, trustworthy. Short sentences. Name the downsides.
Never hype, never exclaim, never bury running costs (subscriptions, filters,
batteries). Honesty is the brand.

---

## 6. The non-negotiable: verify before you publish

Affiliate content only earns trust if it's true.

- **Every price, spec, rating and factual claim about a real product must be
  verified** against the product and a current source before publishing.
- New product articles ship with **`sample: true`**, which renders a visible
  "template article" banner. **Remove `sample: true` only once every figure on
  the page is verified.** Never publish invented numbers as if they were tested.
- Prefer hands-on testing. When a claim is research-based, say so in the prose.
- Real E-E-A-T needs real people: before scaling, add genuine named
  authors/reviewers with real credentials to `authors.js` and byline them. The
  default `editorial` team byline is honest but generic — upgrade it.
- Add or confirm the affiliate `url` on each pick/product; an empty URL renders a
  neutral "Price coming soon" rather than a dead link.

---

## 7. Pre-publish checklist

- [ ] `title` front-loads the search term; quoted if it has a colon.
- [ ] `summary` is a complete 40–60 word direct answer.
- [ ] 3–6 `keyTakeaways`; 2–5 real `faqs`.
- [ ] Roundup/review/comparison has its `picks`/`product`/`comparison` block.
- [ ] Every price, spec and rating **verified**; `sample` removed if so.
- [ ] Affiliate URLs added (or intentionally left blank).
- [ ] `updatedDate` set to today.
- [ ] Internal links to the category hub and 1–2 related articles.
- [ ] `npm run build` clean; page reviewed in the browser.
