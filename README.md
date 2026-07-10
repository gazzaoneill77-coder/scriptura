# NARROW.

*Few find it.*

Storefront for **DROP 001: TESTAMENT** — heavyweight streetwear for the hard road.
Static Astro front, own domain, own stack. No platform lock-in, near-zero monthly cost.

**Live:** https://gazzaoneill77-coder.github.io/scriptura/ — auto-deployed to
GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`. No
API keys anywhere: signups and orders reach the inbox through a form relay
(see below), and payments are arranged by email reply until Stripe is wired.

## Run it

```sh
npm install
npm run dev      # local dev at localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the built site
```

## Pages

| Route | What it is |
| --- | --- |
| `/gate` | Pre-launch landing page. **Ship this first** — point the domain here while samples are on the press, collect demand via the Gate List. |
| `/` | Homepage: hero, drop banner, story strip, craft block. |
| `/shop` | The drop grid. REFINED (hero piece, smallest run) featured first. |
| `/products/<slug>` | Product pages for all five pieces. |
| `/arcade` | NARROW. ARCADE — six original browser games (see below). |
| `/the-road` | Manifesto. |
| `/faq` | QUESTIONS. |
| `/cart` | Client-side cart. |
| `/404` | Wide is the road. |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt` | Build-time discoverability endpoints (search engines + LLMs). |

## NARROW. ARCADE

`/arcade` is a wall of six TV cabinets, each running a live attract-mode
preview of an original canvas game (Rally, Siege, Serpent, Starfall,
Roadrunner, Gatecrash). Launching a cabinet opens a full-screen CRT overlay:
instructions gate first, then play, with channel-surfing between games,
share deep-links (`/arcade#play=snake`), synth sound (mutable, persisted),
and fullscreen. Pure vanilla canvas — zero dependencies.

Code layout under `src/scripts/arcade/`:

- `catalog.js` — pure metadata (id, title, goal, controls, accent). The ONLY
  file both the build (SEO markup, llms.txt) and the client import, so copy
  can never drift between the two.
- `games.js` — the six game factories. Each implements
  `reset/step/render/score` over a fixed 480×320 virtual field and a `demo`
  flag for self-play.
- `engine.js` — canvas fitting (DPR, letterbox), 120 Hz fixed-step host,
  input snapshot, attract-mode preview runner (20 fps, paused offscreen),
  honest localStorage stats (best score + play counts, per-device only).
- `portal.js` — orchestration: previews, CRT overlay, channel surf, deep
  links, share, sound toggle.

**Adding game #7:** one metadata object in `catalog.js`, one factory in
`games.js`, one id in the `CATALOG` list. Nothing else changes — the wall,
sitemap, JSON-LD, and llms.txt all derive from the catalog.

**No fake numbers.** Same rule as stock counters: scores and play counts
shown are the visitor's own device-local truth. Aggregate/global stats only
if a real backend ever provides real ones.

## Architecture

**Product data lives in one place:** `src/data/products.json` — SKUs, prices
(pence), per-size stock counts, and copy. Display components only read from it.
Site config (shipping, announcement bar, endpoints) is `src/data/site.json`.
This is the POD-ready seam: when volume justifies print-on-demand, the
fulfilment call swaps behind the checkout webhook without touching the
storefront. See `functions/checkout.example.mjs` for the two-path fulfilment
sketch (home press for limited runs, Printful/Gelato REST for overflow).

**Stock counters are honest.** "X remaining" only renders when a size is below
5 units (`site.json → lowStockThreshold`). Scarcity that's visible only when
real reads as honest; a permanent fake counter reads as dropshipping. A fully
sold-out product shows **GONE.** with the Gate List pointer.

**Cart & checkout.** The cart is client-side (localStorage). Two checkout
modes, decided by `src/data/site.json`:

1. **Card checkout** — `checkout.endpoint` set: POSTs line items (SKU + size
   + qty only — prices are resolved server-side) to your endpoint, which
   creates a Stripe Checkout session and returns `{ url }`.
2. **Key-free reserve flow** (live now) — `checkout.endpoint` empty,
   `checkout.reserveEndpoint` set: the customer leaves an email, the full
   order (lines, sizes, total) lands in your inbox via the form relay, and
   you reply with a payment link (PayPal.me, bank transfer, Stripe payment
   link — anything). Stock is honoured on dispatch, not on click. A local
   copy of every claim is also kept under `localStorage → narrow.orders`.

**Gate List.** The footer form (and `/gate`) posts to
`site.json → gateList.formAction`. It's wired to a FormSubmit AJAX relay —
free, no account, no API key. **One-time activation:** the first submission
makes FormSubmit email you an activation link; click it and every signup and
order after that is delivered. That first email also contains a random alias
string — swap it into `formAction`/`reserveEndpoint` in place of the raw
address to keep the address out of the page source. If the relay call ever
fails, signups fall back to `localStorage → narrow.gatelist` so nothing is
lost. Any provider that accepts a form POST (Buttondown, Mailchimp,
ConvertKit) can replace it later.

**Motion.** All 3D is dependency-free: the hero mark cube is CSS keyframes,
card tilt tracks the pointer via CSS variables (`src/scripts/fx.js`), and
sections reveal with a perspective fold on scroll (IntersectionObserver).
Everything switches off under `prefers-reduced-motion`.

## Going live checklist

Already done: every push to `main` builds the site and publishes it to the
`gh-pages` branch, and orders/signups flow to the inbox key-free.

1. **Switch Pages on (one time):** repo **Settings → Pages → Source: Deploy
   from a branch → Branch: `gh-pages` / `(root)` → Save**. GitHub requires a
   repo admin to enable Pages the first time — a workflow can't. The site is
   live at the URL above within a minute, and every deploy after this is
   automatic.
2. **Click the FormSubmit activation link** — it arrives in your inbox after
   the first form submission on the live site. One click, done forever.
3. **Custom domain (optional, free):** repo **Settings → Pages → Custom
   domain**, then at your DNS: CNAME `www` → `gazzaoneill77-coder.github.io`
   (plus the four A records GitHub lists for the apex). Pages issues the
   certificate automatically. The site works at both the `github.io` URL and
   the domain root — links adapt to the base path at build time.
4. Replace the placeholder SVG marks in `public/marks/` with real product
   photography (keep the same filenames or update `products.json`).
5. Update real stock counts in `products.json` and push — counts are baked
   at build time, which is fine at drop scale; move them behind a tiny API
   when it isn't.
6. **When card checkout is wanted:** deploy the checkout function
   (`functions/checkout.example.mjs`) with `STRIPE_SECRET_KEY` and
   `SITE_URL`, set `checkout.endpoint` in `site.json`, and hook the Stripe
   webhook to decrement stock and send `emails/order-confirmation.md`, then
   `emails/dispatch.md` on shipping. Until then the reserve flow takes
   orders by email.
7. Alternative host: `render.yaml` still works (Render → **New +** →
   **Blueprint**) and rewrites `/` to `/gate` for a pre-launch posture.

## Emails

Transactional and list copy lives in `emails/` — welcome (Gate List),
order confirmation, dispatch. Subjects included.

## Brand voice (do not break)

Short sentences. Full stops as attitude. Scripture quoted sparingly, never
explained. Never "Christian clothing brand", never "faith-based apparel" —
the word is **NARROW.** and the tagline is *Few find it.* No exclamation
marks. Ever. The brand name always carries the full stop.
