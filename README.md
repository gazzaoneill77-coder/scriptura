# Dwellwise

*Smarter decisions for a better home.*

An independent buying-advice authority site for **home & smart-home technology** —
robot vacuums, home security, WiFi, climate, lighting and smart speakers. Static
[Astro](https://astro.build) front end, zero runtime dependencies, built for
humans first and optimised for every engine that sends them here.

The whole site is engineered around four optimisation pillars — **SEO, GEO
(generative engines), AEO (answer engines) and LLMO (large language models)** —
baked into reusable templates so that writing a page means writing *content*,
never plumbing. See **[CONTENT-PLAYBOOK.md](CONTENT-PLAYBOOK.md)** for how to
author, and **[HANDOFF.md](HANDOFF.md)** for the current state and what's next.

## Run it

```sh
npm install
npm run dev      # local dev at localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the built site

# Reproduce the exact GitHub Pages build (subpath + absolute URLs):
BASE_PATH=/scriptura SITE_URL=https://gazzaoneill77-coder.github.io npm run build
```

## How it's structured

**Content is data.** Every article is a Markdown file in
`src/content/articles/` with rich frontmatter. The frontmatter drives all the
answer-engine furniture — short answer, key takeaways, comparison tables, pros
and cons, FAQs, ratings and structured data — while the Markdown body carries
the prose. Authors fill in fields and write; the layout renders the rest.

```
src/
  data/
    site.js         Brand, nav, social, disclosure — the single config.
    categories.js   The six topic clusters (pillars) + their hub copy & FAQs.
    authors.js      Author/reviewer entities for E-E-A-T bylines & schema.
  content/articles/ The Markdown articles (see the playbook for frontmatter).
  layouts/
    Base.astro          Head, meta, Open Graph, Organization + WebSite schema.
    ArticleLayout.astro Renders any article: schema, answer boxes, tables, FAQ.
  components/         ShortAnswer, KeyTakeaways, ComparisonTable, ProsCons,
                     Faq, Breadcrumbs, Rating, PickCard, VerdictCard,
                     AffiliateButton, Disclosure, cards, header, footer, JsonLd.
  pages/
    index.astro                Homepage.
    [category]/index.astro     Category hub (pillar) pages.
    [category]/[slug].astro    Article pages.
    reviews.astro, guides.astro    Top-level listings.
    about, how-we-test, disclosure Trust pages (E-E-A-T).
    404.astro
    sitemap.xml.js, robots.txt.js, llms.txt.js, rss.xml.js   Machine endpoints.
  lib/
    url.js       Base-path-safe href()/absolute()/withSlash() helpers.
    content.js   Loads + normalises all articles; query helpers.
    format.js    Date helpers.
  styles/global.css   The whole design system (light/dark, no external fonts).
```

**Topic clusters.** The six categories in `categories.js` are pillars. Each
owns a hub page (`/robot-vacuums/`) and links down to the reviews, roundups and
guides beneath it (`/robot-vacuums/best-robot-vacuums/`). This silo structure is
what builds topical authority. Add a category by adding an object to
`categories.js`; add an article by dropping a Markdown file in `content/articles`.

**Four pillars, built in.** Every page ships semantic HTML, a canonical URL,
Open Graph/Twitter cards, and JSON-LD (`Organization`, `WebSite`, plus
`Article`/`HowTo`/`Product`+`Review`/`FAQPage`/`CollectionPage`/`BreadcrumbList`
as appropriate). `sitemap.xml`, `robots.txt`, `llms.txt` and `rss.xml` are all
generated at build time with absolute URLs that stay correct at a domain root or
under the Pages subpath. No external fonts or scripts, so pages are fast and
score well on Core Web Vitals.

## Deploy

Every push to `main` builds the site and publishes `dist/` to the `gh-pages`
branch via `.github/workflows/deploy.yml` (no secrets beyond the workflow's own
token). `.github/workflows/build.yml` runs `npm run build` on every PR. See
[HANDOFF.md](HANDOFF.md) for the one-time Pages/domain steps.

## Brand voice — do not break

Helpful, plain, and trustworthy. Short, clear sentences. Name the downsides as
readily as the strengths — honesty *is* the brand. Never overpromise, never
hype, never bury the running costs. Tagline: *Smarter decisions for a better
home.*
