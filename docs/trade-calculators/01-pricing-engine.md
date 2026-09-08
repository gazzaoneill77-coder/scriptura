# 01 — Algorithmic Logic Flow

The pricing engine is a **pure, deterministic function**:

```ts
price(answers, pack, settings, priceList) => Quote
```

Same inputs, same output, every time, in every runtime. No I/O, no clock, no randomness,
no network. Prices, rates and the current date are *passed in*, never fetched inside. This
is what lets the identical code run in the browser offline, in an edge function for the
authoritative recalculation, and in a test suite with frozen fixtures.

---

## The pipeline

```
 answers ─┐
 pack ────┼─► 1. Validate & normalise
 settings │      │
 prices ──┘      ▼
            2. Derive quantities        (m², linear m, unit counts, volumes)
                 │
                 ▼
            3. Build labour tasks       quantity × productivity rate = base hours
                 │
                 ▼
            4. Apply condition modifiers  multiplicative, capped
                 │
                 ▼
            5. Build material lines     quantity × consumption × waste → purchase units
                 │
                 ▼
            6. Apply risk buffer        contingency on hours, and on volatile materials
                 │
                 ▼
            7. Cost roll-up             labour cost + material cost + plant + disposal
                 │
                 ▼
            8. Overhead absorption      £/chargeable hour × hours  (NOT a % of cost)
                 │
                 ▼
            9. Margin                   price = cost ÷ (1 − margin)   (NOT × (1 + margin))
                 │
                 ▼
           10. Rounding, minimums, banding
                 │
                 ▼
           11. VAT, presentation, exclusions ──► Quote
```

Stages 8 and 9 are where most trade pricing tools — and most tradespeople — lose money.
They are the two things this product exists to get right.

---

## Stage 1 — Validate & normalise

- Coerce every answer to the pack's declared type and unit. Store canonical SI-ish units
  internally (metres, m², litres, kg, hours) and convert only at the UI edge, so a user who
  works in feet costs the same as one who works in metres.
- Apply pack `validation` rules → `errors` (block) and `warnings` (allow, but surface).
- Fill unanswered optional questions from `pack.defaults`, then from
  `settings.userDefaults` (the user's own defaults always win over the pack's).
- Record which values were defaulted. The quote review screen highlights defaulted inputs,
  because an unnoticed default is how a wrong quote gets sent.

## Stage 2 — Derive quantities

Raw answers are rarely the quantity you price against. Derivations turn them into
priceable measures via the pack's expression DSL (see [02](02-trade-pack-spec.md)).

```
wall_area_gross   = 2 × (length + width) × height
openings_area     = doors × 1.98 + Σ(window_w × window_h)
wall_area_net     = max(wall_area_gross − openings_area, wall_area_gross × 0.6)
ceiling_area      = length × width
perimeter         = 2 × (length + width)
excavation_volume = area × depth × 1.30        // bulking factor: spoil swells
```

Two rules that matter:

- **Floor the deduction.** `wall_area_net` never drops below 60% of gross. A room that is
  mostly glass still costs most of a room to paint — the labour is in the cutting-in, not
  the rolling. Deducting openings linearly under-prices conservatories catastrophically.
- **Deducted openings generate their own labour.** Netting off a window's area and then
  adding a per-opening cut-in allowance is more accurate than either alone. Cut-in is
  ~0.25 hr per opening for a decorator.

Derivations are a DAG — one may reference another — evaluated in topological order with
cycle detection at pack-publish time.

## Stage 3 — Base labour hours

Each `task` in the pack is `hours = quantity × rate.typical × coats/passes`.

```ts
for (const task of pack.tasks) {
  if (!evaluate(task.appliesWhen, ctx)) continue;
  const qty  = ctx.quantities[task.quantity];
  const rate = settings.rateOverrides[task.id] ?? task.rate.typical;
  task.baseHours = qty * rate * (ctx[task.multiplierRef] ?? 1);
}
```

Rates are carried as `{ low, typical, high }` bands. `typical` prices the quote; the band
drives the confidence range shown internally (see Stage 10) and lets a fast, experienced
user shift their whole book toward `low` with one setting.

**Minimum task hours.** A task with a `minHours` never falls below it. Hanging one door is
not 1/8th of the cost of hanging eight — setup is not divisible.

## Stage 4 — Condition modifiers

Modifiers are the "field reality" layer: poor wall condition, no rear access, occupied
property, third floor with no lift, heavy clay ground.

```ts
const factor = clamp(
  modifiers.filter(m => evaluate(m.when, ctx))
           .reduce((f, m) => f * m.factor, 1),
  pack.modifierFloor ?? 0.8,
  pack.modifierCeiling ?? 2.5
);
```

Design rules:

- **Multiplicative, not additive.** Poor walls in an occupied third-floor flat compound;
  they do not sum.
- **Scoped.** A modifier declares which task tags it hits (`scope: ["prep","walls"]`).
  Access difficulty inflates carrying materials in, not spraying a door.
- **Capped.** Uncapped compounding produces absurd numbers from four honest answers. The
  ceiling of 2.5× is a deliberate safety rail; when it binds, the quote review screen says
  so, because a job hitting the cap is a job that needs a site visit, not a calculator.
- **Labour only, by default.** Bad access costs hours, not litres of paint.

## Stage 5 — Materials, waste and purchase units

```ts
required   = quantity × consumptionRate × coats        // e.g. m² ÷ (m²/L) × coats
withWaste  = required × (1 + wastePct)                 // cut waste, spillage, buffer
toBuy      = ceilToPurchaseUnits(withWaste, material.packSizes)
cost       = Σ(unitsOfEachPack × packPrice)
```

Three things a naïve calculator gets wrong:

1. **Waste percentages are per-trade and per-pattern**, not a global 10%. Herringbone
   paving wastes 12–15%; stack-bond wastes 5%. Copper pipe carries a +10% length buffer and
   +15% on fittings because you never do a run with the exact count.
2. **You buy in packs, not in quantities.** Needing 6.2 L of emulsion means buying a 5 L
   tin plus a 2.5 L tin — 7.5 L of cost. `ceilToPurchaseUnits` solves the small
   combinatorial problem of cheapest valid combination, not just `ceil(qty / largestPack)`.
3. **Leftover is not automatically waste.** Flag part-tins over a threshold on the internal
   view so the user can offer touch-up paint as a value-add rather than eat the cost.

**Sundries** (dust sheets, tape, filler, caulk, abrasives, jointing compound) are real and
routinely forgotten. Model them as `max(percentOfMaterials, perDayAmount × days)` — a
one-day job with £30 of paint still burns £25 of sundries.

## Stage 6 — Risk buffer

Three independent buffers, because they have different causes and different owners:

| Buffer | Driven by | Applied to | Typical |
| --- | --- | --- | --- |
| `surveyConfidence` | How well the job was seen: visited / photos only / described over phone | Labour hours | 0% / 8% / 18% |
| `unknownConditions` | Trade-specific unknowns — pre-1960 property, boxed-in pipework, unknown substrate | Labour hours | 5–25% |
| `priceVolatility` | Days until work starts × material class volatility | Material cost | 0–6% |

```ts
hours     *= 1 + surveyConfidence + unknownConditions;
matCost   *= 1 + priceVolatility;
```

Buffers are shown to the user as a single "Contingency" line they can dial with one slider
(Tight / Balanced / Cautious) — but stored decomposed so we can learn, from the receipts
the app already captures, which buffer was actually needed. **That feedback loop is the
long-term moat**: after 500 completed jobs the app can tell a decorator that their
"poor wall condition" jobs run 22% over, not 15%.

Contingency is **not** shown as a line item on the client PDF. It is absorbed into the
task prices. A client-visible "risk buffer" invites a negotiation you will lose.

## Stage 7 — Cost roll-up

```
directCost = labourCost      // hours × settings.labourCostRate  (what the WORK costs)
           + materialCost    // after waste + volatility
           + plantHire       // digger, tower, turf cutter — day rates × days, + delivery
           + disposalCost    // skip/grab/tip fees, weight-banded
           + subcontract     // electrician for Part P, scaffolder — at cost
           + travelCost      // (miles × 2 × visits × pencePerMile) + paid travel time
```

`labourCostRate` is **the cost of an hour of work**, not the charge-out rate. For a sole
trader it is the wage they want to draw; for an employer it is gross wage + NI + holiday +
pension + employer's liability ≈ wage × 1.30. Conflating cost rate with charge-out rate is
the single most common cause of a busy trade going broke, and the onboarding wizard's job
is to separate them.

Subcontract and plant may carry their own markup (typically 10–15%) and are **excluded**
from the labour-hours margin base to avoid double-counting.

## Stage 8 — Overhead absorption

Overheads are recovered **per chargeable hour**, never as a percentage of cost. A
percentage of cost recovers more overhead on a material-heavy job than a labour-heavy one,
which is exactly backwards — the van, the phone and the insurance are consumed by *time*.

```
overheadRate = annualOverheads / annualChargeableHours

annualChargeableHours = daysWorkedPerYear × chargeableHoursPerDay
                      // default 220 × 6 = 1,320 — NOT 260 × 8.
                      // Quoting, travel, invoicing and merchant runs are not chargeable.

overheadCost = totalHours × overheadRate
```

Onboarding collects annual overheads in one screen of six fields with trade-specific
defaults: van (lease/finance, fuel, insurance, MOT, servicing), public liability + tools
insurance, phone and software, accountant, tools and consumables replacement, marketing and
memberships. A sole-trader decorator lands around £7–9k; a landscaper with a truck, trailer
and yard, £14–20k.

At £8,000 across 1,320 hours that is **£6.06 of overhead in every single hour quoted** —
and it is invisible without this calculation. Showing the user this number during
onboarding is the strongest single "aha" the product has, and it belongs in the marketing
as much as in the app.

## Stage 9 — Profit margin

```ts
const costBase = labourCost + overheadCost + materialCost + plant + disposal + travel;
const price    = costBase / (1 - settings.targetMargin);   // margin, not markup
```

**`cost × 1.20` is not a 20% margin — it is a 16.7% margin.** Dividing is correct;
multiplying quietly gives away a fifth of the profit. The settings screen says
*"Profit margin — what's left after every cost, including paying yourself"* and shows both
figures side by side so the number is unambiguous.

Materials are handled per the user's preference, which differs by trade:

- **Margin-in-price** (default): materials sit in `costBase` and carry the same margin.
- **Cost-plus-markup**: materials priced at `cost × (1 + materialMarkup)` (20–25% typical)
  and *excluded* from the margin base. This is the norm for trades that supply and fit,
  and it survives the client asking "what if I buy the materials myself?" — because
  removing the material line then removes exactly its markup, not a scrambled share of the
  total.

Both must exist; forcing one on a trade that works the other way is a churn event.

## Stage 10 — Rounding, minimums, banding

```ts
price = max(price, settings.minimumJobValue);        // callout minimum, half-day minimum
price = roundTo(price, band(price));                 // <£500 → £5, <£2k → £10, else £25
```

- **Round up, never down.** Rounding down is a direct donation.
- **No fake precision.** £2,847.63 reads as a machine's number and invites line-by-line
  haggling. £2,850 reads as a professional's judgement.
- **Minimums are per job type**, not global: a plumbing callout has a 1-hour minimum plus a
  30-minute increment thereafter; a decorating job has a half-day minimum.
- Internally (never on the client PDF) show the **confidence range** from the rate bands:
  "likely £2,450–£3,180". If the sent price sits below the low end, warn before sending.

## Stage 11 — VAT, presentation, exclusions

- VAT only if `settings.vatRegistered`. Default **off** — most sole traders are under the
  threshold, and a VAT line on a domestic quote from a non-registered trader is a
  compliance problem, not a rounding detail.
- Domestic clients see **VAT-inclusive** totals; commercial clients see ex-VAT with VAT
  shown separately. One toggle per client record, remembered.
- Line items are grouped by the pack's `presentation.groups` — the client sees "Preparation
  / Ceilings / Walls / Woodwork / Materials", not thirty derived rows.
- **Two views of every quote:**
  - *Client PDF* — grouped, priced, unbranded, no hours, no cost rates, no contingency.
  - *Internal breakdown* — every stage, every multiplier, cost vs price, achieved margin.
    This is the screen that teaches users their own business, and the reason they renew.
- The pack's standard exclusions and assumptions print verbatim, plus quote validity
  (default 30 days), deposit terms, and the note that the estimate assumes the conditions
  described.

---

## Worked example — 3-bed semi, walls and ceilings, poor condition

```
INPUTS   3 double bedrooms + landing, avg 3.6 × 3.2 × 2.4 m, 2 coats
         wall condition: poor (filling + sanding), occupied, mid-range trade paint
         survey: visited. Settings: cost rate £22/hr, overhead £8k/1,320 hr,
         margin 25%, not VAT registered.

2  QUANTITIES     walls net 141.2 m²   ceilings 41.5 m²   openings 8
3  BASE LABOUR    walls 2 coats  141.2 × 0.105          = 14.83 hr
                  ceilings 2 coats 41.5 × 0.115         =  4.77 hr
                  prep/fill/sand 141.2 × 0.055          =  7.77 hr
                  cut-in 8 openings × 0.25              =  2.00 hr
                  masking/protection (occupied, per room) =  3.20 hr
                                                          ------- 32.57 hr
4  MODIFIERS      poor condition ×1.25 (prep, walls) → +5.65 hr
                  occupied ×1.10 (masking scope)     → +0.32 hr      = 38.54 hr
5  MATERIALS      emulsion 182.7 m² × 2 coats ÷ 11 m²/L = 33.2 L
                  +5% waste = 34.9 L → buy 6×5 L + 1×2.5 L = 32.5 L… → 7×5 L = 35 L
                  7 × £28.50                            = £199.50
                  sundries max(12% × 199.50, £25 × 5 days) = £125.00
6  RISK           survey visited 0% + unknown 5%  → 40.47 hr;  volatility 0%
7  DIRECT COST    labour 40.47 × £22 = £890.34  +  materials £324.50   = £1,214.84
8  OVERHEAD       40.47 × £6.06                                        = £  245.25
                                                            cost base    £1,460.09
9  MARGIN 25%     1,460.09 ÷ 0.75                                      = £1,946.79
10 ROUNDING       band £25 → round up                                  = £1,950
11 OUTPUT         5 days on site · no VAT · £1,950
                  internal: 40.5 hr, achieved margin 25.1%,
                  confidence range £1,720–£2,290, effective £48.15/chargeable hr
```

The user sees `£1,950`, a five-line grouped breakdown, and a 5-day programme. The engine
shows its whole working on the internal tab.

---

## Test strategy

The money logic gets the strictest testing in the codebase:

- **Golden fixtures.** ~30 realistic jobs per trade with hand-verified expected totals,
  reviewed by a working tradesperson before they are frozen. Any change to totals must be
  an explicit, reviewed fixture update — never a silent snapshot refresh.
- **Property-based tests.** Monotonicity is the strongest invariant available: more area
  never costs less; worse condition never costs less; a higher margin never lowers price.
  Fuzz the answer space and assert these hold.
- **Invariant assertions in the engine itself:** achieved margin within 0.5pp of target;
  no negative line; no `NaN`/`Infinity` (a single undefined rate poisons an entire quote,
  so fail loudly at pack-publish time instead of shipping `£NaN` to a client);
  every priced line traceable to a task or material id.
- **Cross-runtime parity.** The browser result and the edge-function result must be
  byte-identical for the same inputs. Money uses integer pence throughout — never floats —
  with a single rounding point at Stage 10.
