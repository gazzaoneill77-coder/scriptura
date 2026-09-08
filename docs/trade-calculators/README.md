# Trade Pricing Calculators — Product & Architecture Plan

Mobile-first PWA. A suite of vertical, trade-specific pricing calculators that turn a
site visit into a priced, itemised, unbranded PDF estimate before the tradesperson
leaves the driveway.

**Positioning:** not a spreadsheet, not "job management software". Each vertical is sold
as its own tool — *The Decorator's Pricing Calculator*, *The Plumber's Pricing
Calculator* — with the language, defaults and allowances of that trade baked in.

**Monetisation:** £4.99/month. Free tier produces on-screen prices; the paywall sits on
**PDF export and client share**, which is the moment value is realised.

**Delivery:** browser-first (no app store friction), installable PWA, offline-capable,
wrappable into a native shell later without rewriting the engine.

---

## Document set

| Doc | Contents |
| --- | --- |
| [`01-pricing-engine.md`](01-pricing-engine.md) | **Algorithmic logic flow.** The universal 11-stage pipeline: quantities → labour → materials → risk buffer → overhead → margin → VAT → presentation. Pseudocode + worked example. |
| [`02-trade-pack-spec.md`](02-trade-pack-spec.md) | **The extensibility contract.** How a trade is defined as versioned data, not code. Read this before adding Plumber, Electrician, Roofer, Tiler… |
| [`03-decorator.md`](03-decorator.md) | Input/Output matrix — Decorator |
| [`04-plumber.md`](04-plumber.md) | Input/Output matrix — Plumber |
| [`05-landscaper.md`](05-landscaper.md) | Input/Output matrix — Landscaper |
| [`06-data-architecture.md`](06-data-architecture.md) | Supabase/Postgres schema, RLS, offline sync, native-wrap path |
| [`07-ux-and-handoff.md`](07-ux-and-handoff.md) | Mobile-first input UX, quote review, PDF generation, WhatsApp/email share, paywall placement |
| [`trade-packs/decorator.pack.json`](trade-packs/decorator.pack.json) | Worked example of a complete trade pack |
| [`trade-packs/plumber.pack.json`](trade-packs/plumber.pack.json) | Second complete pack — the test that the pack architecture holds |
| [`trade-packs/landscaper.pack.json`](trade-packs/landscaper.pack.json) | Third complete pack — forced the first structural change (programme vs price) |
| [`trade-packs/validate-packs.py`](trade-packs/validate-packs.py) | Prototype publish-time validator: references, cycles, DSL whitelist, sourced rates |

---

## The one architectural decision everything else follows from

**Every trade calculator is the same engine running a different data file.**

The engine knows how to: take answers → derive quantities → multiply quantities by
productivity rates → apply condition modifiers → consume materials with waste buffers →
add risk contingency → absorb overhead → apply margin → round → itemise.

It knows *nothing* about paint coverage, copper pipe or MOT Type 1. All of that lives in
a **trade pack**: a versioned JSON document stored in the database.

```
                    ┌──────────────────────────┐
   decorator.pack ──►                          │
   plumber.pack   ──►   @trade/engine          ├──► priced, itemised quote
   landscaper.pack──►   (pure, deterministic)  │
   <your next trade>►                          │
                    └──────────────────────────┘
                              ▲
                    user settings (rates, margin, VAT)
                    material price feed (regional, dated)
```

Consequences, all of them good:

- **A new trade ships without a deploy.** Author a pack, seed its rates, QA it, publish.
- **The engine is unit-testable in isolation** against fixture packs — the money logic has
  one implementation and one test suite, not one per trade.
- **The same package runs in three places**: the browser (instant, offline), a Supabase
  edge function (authoritative recalculation, anti-tamper), and a future React Native
  bundle. Write once.
- **Pricing is auditable.** Every quote stores the pack version and the price list date it
  was calculated against, so a quote from March re-renders in June exactly as sent.

## Adding a trade — the checklist

When you come back with the Plumber's, then the Electrician's, then the Tiler's, this is
the repeatable path. Steps 1–3 are the real work; 4–7 are mechanical.

1. **Job-type taxonomy.** What are the 5–8 job archetypes this trade actually quotes?
   (Decorator: whole house / single room / exterior / woodwork only…) Everything else
   hangs off this choice, because it decides which questions are even asked.
2. **Quantity model.** What does this trade measure in? m² (decorator, landscaper),
   linear metres (fencing, skirting, pipe runs), unit counts (fixtures, sockets,
   radiators), or hours-first (diagnostic/callout work). Most trades need two or three.
3. **Benchmark table.** Productivity rates (hours per unit) and material consumption rates
   with sources. This is where the domain expertise lives and where a bad number costs the
   user money. Every rate gets a `low / typical / high` band, not a single figure.
4. **Condition modifiers.** The multipliers that reflect field reality — access, property
   age, occupied/empty, ground conditions. Cap the compounded total (see engine doc).
5. **Materials + waste allowances.** Coverage rates, buffer percentages, and crucially
   **purchase units** (paint sells in 2.5L and 5L tins; postcrete in 20kg bags) — real
   cost is ceilinged to purchase units, not the exact quantity needed.
6. **Standard exclusions.** Every trade has a list of "not included unless stated" that
   prevents arguments. It goes on the PDF verbatim.
7. **Validation + sanity rails.** Per-trade "this quote looks wrong" checks — £/m² outside
   a plausible band, hours below a minimum charge, margin under zero.

## MVP scope boundary

**In:** three verticals, guided quote flow, settings/onboarding wizard, quote list, PDF
export, share links, Stripe subscription, offline draft capture, receipt capture (photo +
amount + category, no OCR).

**Out of MVP, designed-for:** invoicing and payment collection, OCR receipt parsing,
supplier price feed integrations (MVP uses a curated internal catalogue + manual
override), team/multi-user accounts, scheduling/calendar, CIS and MTD accounting export,
native app shells.

## Roadmap

| Phase | Ships | Proves |
| --- | --- | --- |
| **0 — Foundation** (wks 1–3) | Engine package + pack spec + Decorator pack, no persistence, local-only | The pricing maths and the quote-flow UX |
| **1 — MVP** (wks 4–9) | Supabase, auth, settings wizard, saved quotes, PDF, share, Stripe | People will pay £4.99 |
| **2 — Breadth** (wks 10–14) | Plumber + Landscaper packs, receipts, job history, pack authoring tooling | The pack architecture actually holds for a second and third trade |
| **3 — Depth** (wks 15+) | Price feeds, invoicing, native wrap, trade #4+ | Retention beyond the first quote |

The single riskiest assumption is **Phase 2's first line**: if adding the Plumber pack
requires engine changes, the abstraction was wrong and it is cheaper to find that out in
week 10 than in month 10. Build the Plumber pack against the *frozen* engine and treat
every required engine change as a defect in the spec.

**Status: tested, and it held.** The Plumber pack is authored and validates clean against
the frozen v1 spec. The pipeline did not change — no stage added, removed or reordered, no
trade-specific branch in the engine. It forced four small additions to the vocabulary the
engine reads (job-type gating on trade qualifications, `settings.registrations` in the
evaluation context, a `fixed` pricing type for certification fees, and a per-line
`excludeFromMarginBase` so a £900 boiler isn't run through a 25% labour margin) plus one
documentation gap. All are written up in
[02 — Spec v1 → v2](02-trade-pack-spec.md#spec-v1--v2-what-authoring-the-plumber-pack-actually-forced).
