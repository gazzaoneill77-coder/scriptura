# NARROW.

*Few find it.*

Storefront for **DROP 001: TESTAMENT** — heavyweight streetwear for the hard road.
Static Astro front, own domain, own stack. No platform lock-in, near-zero monthly cost.

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
| `/the-road` | Manifesto. |
| `/faq` | QUESTIONS. |
| `/cart` | Client-side cart. |
| `/404` | Wide is the road. |

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

**Cart & checkout.** The cart is client-side (localStorage). Checkout POSTs
line items (SKU + size + qty only — prices are resolved server-side) to the
endpoint in `site.json → checkout.endpoint`, which should create a Stripe
Checkout session and return `{ url }`. Until that endpoint is configured, the
checkout button explains the store hasn't opened and points to the Gate List.

**Gate List.** The footer form (and `/gate`) posts to
`site.json → gateList.formAction` — set it to your list provider's form
endpoint (Buttondown, Mailchimp, ConvertKit all accept a plain form POST).
Until configured, signups are held in `localStorage` under `narrow.gatelist`
so nothing is lost during testing.

## Going live checklist

1. Deploy `dist/` as a static site (Render static site works; any host does).
2. Point the domain at `/gate` first. Collect demand.
3. Wire the Gate List `formAction` to a real list provider. Send
   `emails/welcome.md` as the signup autoresponder.
4. Deploy the checkout function (`functions/checkout.example.mjs`) with
   `STRIPE_SECRET_KEY` and `SITE_URL`, set `checkout.endpoint` in `site.json`.
5. Hook the Stripe webhook to decrement stock and send
   `emails/order-confirmation.md`, then `emails/dispatch.md` on shipping.
6. Replace the placeholder SVG marks in `public/marks/` with real product
   photography (keep the same filenames or update `products.json`).
7. Update real stock counts in `products.json` and rebuild — counts are baked
   at build time, which is fine at drop scale; move them behind a tiny API
   when it isn't.

## Emails

Transactional and list copy lives in `emails/` — welcome (Gate List),
order confirmation, dispatch. Subjects included.

## Brand voice (do not break)

Short sentences. Full stops as attitude. Scripture quoted sparingly, never
explained. Never "Christian clothing brand", never "faith-based apparel" —
the word is **NARROW.** and the tagline is *Few find it.* No exclamation
marks. Ever. The brand name always carries the full stop.
