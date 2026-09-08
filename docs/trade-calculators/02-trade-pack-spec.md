# 02 — Trade Pack Specification

**A trade is data, not code.** This document is the contract between the engine and every
vertical. Read it before authoring the Plumber's pack, the Electrician's, the Tiler's.

If adding a trade requires changing `@trade/engine`, treat it as a defect in this spec:
generalise the mechanism, version the spec, migrate existing packs. Special-casing a trade
inside the engine is how a suite of nine calculators becomes nine unmaintainable products.

---

## Anatomy

```jsonc
{
  "id": "decorator",
  "specVersion": 1,              // engine compatibility
  "packVersion": "1.4.0",        // semver; quotes store the exact version used
  "name": "The Decorator's Pricing Calculator",
  "region": "GB",
  "units": "metric",

  "jobTypes":    [ /* the 5–8 archetypes; gates which questions appear */ ],
  "questions":   [ /* typed inputs + mobile control hints */ ],
  "derivations": [ /* computed quantities, a DAG of expressions */ ],
  "tasks":       [ /* labour lines: quantity × productivity rate */ ],
  "materials":   [ /* consumption rates, waste, purchase units */ ],
  "modifiers":   [ /* condition multipliers, scoped to task tags */ ],
  "extras":      [ /* plant hire, disposal, permits, subcontract */ ],
  "risk":        { /* trade-specific unknown-condition drivers */ },
  "defaults":    { /* pack-level fallbacks, overridden by user settings */ },
  "validation":  [ /* blocking errors and non-blocking warnings */ ],
  "presentation":{ /* PDF grouping, exclusions, assumptions */ }
}
```

## `jobTypes`

The first question in every flow, and the strongest lever on friction. It decides which
questions are asked at all — a boiler swap and a tap washer share almost no inputs.

```jsonc
{ "id": "full_house_interior", "label": "Whole house — interior",
  "icon": "house", "asks": ["rooms","condition","paint_tier","occupied"],
  "hides": ["exterior_*"], "defaultMinimum": "half_day" }
```

## `questions`

```jsonc
{
  "id": "wall_condition",
  "label": "What are the walls like?",
  "help": "Be honest — this is the number that decides if you make money.",
  "type": "enum",                     // number | enum | boolean | count | dimension | repeater | photo
  "control": "cards",                 // slider | stepper | cards | segmented | dimension-pad | toggle
  "options": [
    { "value": "good",  "label": "Good",       "sub": "Sound, previously painted" },
    { "value": "minor", "label": "Minor work", "sub": "A few nail holes and cracks" },
    { "value": "poor",  "label": "Poor",       "sub": "Lots of filling and sanding" },
    { "value": "lining","label": "Needs lining","sub": "Cracked or bad plaster" }
  ],
  "default": "minor",
  "required": true,
  "group": "condition",
  "affects": ["prep_hours", "material_emulsion"]   // powers "why did the price change?"
}
```

`repeater` questions (rooms, radiators, fence runs, bathroom fixtures) are the workhorse
of every trade and get first-class engine support: an array of sub-answer objects, with
derivations able to `sum()` and `map()` over them.

`control` is a **hint, not a mandate** — the renderer picks the best available control for
the platform, which is what keeps one pack working in the PWA and a later native shell.

## `derivations`

Named expressions forming a DAG, evaluated in topological order. Cycles are rejected at
publish time.

```jsonc
{ "id": "wall_area_gross", "expr": "sum(rooms, 2 * (r.length + r.width) * r.height)" },
{ "id": "openings_area",   "expr": "sum(rooms, r.doors * 1.98 + r.window_area)" },
{ "id": "wall_area_net",   "expr": "max(wall_area_gross - openings_area, wall_area_gross * 0.6)",
  "unit": "m2" }
```

### The expression DSL — and why not `eval`

Packs are data that can be authored, versioned and (eventually) edited by non-engineers.
Executing arbitrary JavaScript from a database row is a remote-code-execution hole, and it
is also unserialisable, untestable in isolation, and impossible to statically analyse.

The DSL is a **small, total, whitelisted expression language** parsed to an AST and
evaluated by the engine:

- arithmetic `+ - * / %`, comparison, `&&`, `||`, `!`, ternary, and `contains`
  (membership test over a `multi_enum`: `surfaces contains 'walls'`)
- functions: `min max round ceil floor clamp sum map count if coalesce` — no others
- references: question ids, derivation ids, `settings.*`, `quantities.*`
- **no** loops, assignment, property access on host objects, or function definitions

Guarantees this buys: it always terminates, it can be validated at publish time (unknown
reference, type mismatch, cycle, division by a possibly-zero term), it serialises to JSON,
and it evaluates identically in TypeScript and — if ever needed — in Postgres.

## `tasks`

```jsonc
{
  "id": "walls_emulsion",
  "label": "Emulsion to walls",
  "group": "walls",                     // PDF grouping
  "tags": ["paint","interior","reach"], // modifier targeting
  "quantity": "wall_area_net",
  "rate": { "low": 0.085, "typical": 0.105, "high": 0.130, "unit": "hr/m2" },
  "multiplierRef": "coats",             // × number of coats
  "minHours": 1.5,
  "appliesWhen": "surfaces contains 'walls'",
  "source": "SPAB/DIY trade norms + practitioner review 2026-02"
}
```

`rate.source` is mandatory. An unsourced productivity rate is a guess, and a guess that
silently prices someone's livelihood is the worst failure mode this product has.

## `materials`

```jsonc
{
  "id": "emulsion",
  "label": "Emulsion paint",
  "sku": "paint.emulsion.matt.{tier}",       // resolves against material_prices
  "quantity": "wall_area_net + ceiling_area",
  "consumption": { "expr": "1 / coverage_lpm2", "unit": "L/m2" },
  "multiplierRef": "coats",
  "wastePct": 0.05,
  "purchaseUnits": [ { "size": 2.5, "unit": "L" }, { "size": 5, "unit": "L" },
                     { "size": 10, "unit": "L" } ],
  "roundingStrategy": "cheapest_combination",
  "notes": "New plaster mist coat: coverage drops ~30% (absorbent substrate)"
}
```

## `modifiers`

```jsonc
{ "id": "poor_walls", "when": "wall_condition == 'poor'",
  "factor": 1.25, "scope": ["prep","walls"],
  "explain": "Poor wall condition — extra filling and sanding" },

{ "id": "high_ceilings", "when": "max_ceiling_height > 2.7",
  "factor": "clamp(1 + (max_ceiling_height - 2.7) * 0.20, 1, 1.35)",
  "scope": ["reach"], "explain": "High ceilings — working at height" }
```

`explain` is user-facing. Every multiplier that fires appears in the internal breakdown as
a plain-English line. **A multiplier the user cannot see is a multiplier they will not
trust**, and untrusted numbers do not get sent to clients.

`factor` may be a constant or an expression, which covers continuous effects (ceiling
height, floor level, distance from parking) without inventing a second mechanism.

## `extras`, `risk`, `validation`, `presentation`

```jsonc
"extras": [
  { "id": "skip", "label": "Skip hire", "when": "waste_volume > 2",
    "pricing": { "type": "banded", "bands": [
      { "upTo": 4,  "sku": "skip.4yd"  }, { "upTo": 8, "sku": "skip.8yd" }] } },
  { "id": "tower", "label": "Scaffold tower hire", "pricing": { "type": "day_rate",
    "sku": "hire.tower", "days": "ceil(total_hours / 7.5)" } }
],

"risk": {
  "unknownConditions": [
    { "when": "property_age == 'pre_1960'", "add": 0.10,
      "explain": "Older property — lath and plaster, unknown substrates" },
    { "when": "!surveyed", "add": 0.08, "explain": "Not seen in person" }
  ],
  "cap": 0.30
},

"validation": [
  { "level": "error",   "when": "sum(rooms, 1) == 0",
    "message": "Add at least one room" },
  { "level": "warning", "when": "price_per_m2 < 8",
    "message": "This works out under £8/m². Most decorators need £12–18/m² to make money." },
  { "level": "warning", "when": "modifier_cap_hit",
    "message": "This job hit the difficulty cap — worth a site visit before you send it." }
],

"presentation": {
  "groups": ["Preparation","Ceilings","Walls","Woodwork","Materials","Extras"],
  "exclusions": [
    "Removal of wallpaper unless stated above",
    "Repair of damaged plaster beyond routine filling",
    "Moving heavy furniture or lifting fitted carpets",
    "Painting of previously unpainted or unprimed surfaces unless stated"
  ],
  "assumptions": [
    "Free access to the property between 08:00 and 17:00",
    "Water and power available on site",
    "Rooms clear of small furniture and personal items on arrival"
  ]
}
```

Standard exclusions are not boilerplate — they are the clauses that end disputes before
they start, and they are trade-specific knowledge worth as much as the rates.

---

## Versioning and publication

- `packVersion` is semver. **Patch** = typo, help text. **Minor** = new optional question,
  new material, adjusted rate inside its existing band. **Major** = removed or renamed
  question, changed derivation semantics, restructured tasks.
- **Every quote stores `pack_id`, `pack_version` and `price_list_date`.** A quote sent in
  March re-renders in June exactly as the client received it. Nothing else is defensible if
  a client queries a price.
- Draft → staged → published lifecycle. Publishing runs the full validator (references
  resolve, no cycles, every rate has a source, every material resolves to a live SKU, all
  golden fixtures still pass) and is blocked on any failure.
- Rolling out a new pack version does **not** retro-price open quotes. Users get a
  "prices have moved" prompt with an explicit re-price action on drafts only.

## Adding a new trade — worked sequence

1. Draft the job-type taxonomy with a working tradesperson. Interview, don't guess.
2. Write the benchmark table (`hours/unit`, `material/unit`) with `low/typical/high` and a
   source per row. **Have a second practitioner review it before any code.**
3. Author the pack JSON. Start with the single most common job type end-to-end rather than
   all eight at 60%.
4. Write 30 golden fixtures from real quotes the tradesperson has previously sent, and
   tune until the engine lands within ±10% of what they actually charged. Where it differs
   by more, find out which of you is wrong — sometimes it is them, and that is the product.
5. Run the publish validator; fix what it finds.
6. Ship behind a flag to 5–10 pilot users of that trade; compare quoted vs. actual cost
   using their captured receipts.
7. Promote to general availability; add the vertical's own landing page and copy.

**Engine changes required: zero.** If that is not true, stop and fix the spec.

---

## Spec v1 → v2: what authoring the Plumber pack actually forced

The roadmap called this the riskiest assumption in the plan: *if adding the Plumber pack
requires engine changes, the abstraction was wrong.* The Plumber pack
([`trade-packs/plumber.pack.json`](trade-packs/plumber.pack.json)) was authored against the
frozen v1 spec. Both packs now validate clean — every reference resolves, no cycles, no
function outside the whitelisted DSL, every rate sourced, every modifier explained.

**Verdict: the abstraction held.** The pipeline in [01](01-pricing-engine.md) did not change.
No stage was added, removed or reordered; no trade-specific branch entered the engine. What
follows are four additions to the *vocabulary* the engine reads, one documentation gap, and
two authoring recommendations. Together they are perhaps a day of engine work.

### 1. `jobTypes[].requires` — gating on qualifications (NEW)

Plumbing is the first trade where **the user's credentials decide which jobs exist.** Gas
work is Gas Safe only; unvented cylinders need G3. v1 had no way to say a job type is
unavailable to a given user.

```jsonc
{ "id": "boiler", "label": "Boiler swap or install",
  "requires": ["registrations.gas_safe"],
  "requiresMessage": "Boiler work is Gas Safe registered only. Add your Gas Safe number in Settings, or quote this as a subcontracted job." }
```

The job-type picker evaluates `requires` and disables the card with `requiresMessage`.
A `validation` error backstops it, so the rule holds even if a pack is authored badly or
the answer set is replayed from an API. This generalises immediately — the Electrician's
pack will need NICEIC/Part P, the Gas Engineer's the same Gas Safe check.

### 2. `settings.registrations.*` in the evaluation context (CLARIFICATION)

v1 said the DSL may reference `settings.*`. But registrations live on
`businesses.registrations`, not `pricing_settings`. The context builder must merge business
identity into the settings namespace before evaluation. No engine logic changes — it is one
more field in the object handed to a pure function — but it must be specified, because
`validation` rules now depend on it and a missing key would silently evaluate falsy and
**wrongly block a qualified user's gas quote**.

### 3. `extras[].pricing.type: "fixed"` (NEW)

The Decorator only needed `banded` (skips) and `day_rate` (tower hire). The Plumber is full
of flat amounts that are neither: Building Regs notification, Benchmark commissioning, a
Landlord Gas Safety Record, G3 and WRAS notifications, congestion charges. Added with an
optional `multiplier` for per-visit costs:

```jsonc
{ "id": "congestion", "label": "Congestion / ULEZ charge",
  "pricing": { "type": "fixed", "sku": "travel.congestion", "multiplier": "visits" } }
```

### 4. `excludeFromMarginBase` per line (NEW — the substantive one)

This is the finding worth the exercise. [01](01-pricing-engine.md) stage 9 treats
margin-in-price vs cost-plus-markup as **one user-level setting** covering all materials.
That works for a decorator, whose materials are tins of paint.

It breaks on a boiler. A £900 appliance run through a 25% margin adds £300 to a job where
the trade norm is a 10–15% supply markup — the quote prices itself out of the market, and
the user will not notice why. The reverse is just as bad: forcing *all* materials to
cost-plus to accommodate the boiler under-recovers on the fittings.

So the flag moves to the line:

```jsonc
{ "id": "boiler_unit", "label": "Boiler", "sku": "appliance.boiler.combi",
  "excludeFromMarginBase": true,
  "notes": "High-value appliance — cost-plus-markup, never inside the labour margin base" }
```

Engine change: stage 9 partitions cost lines into margin-base and markup-base rather than
switching wholesale on a setting. The user setting remains as the default for lines that
don't declare the flag. Applies to `extras` too — a subcontracted electrician is at cost
plus a handling markup, not at the plumber's margin.

**This is a spec defect the Decorator could never have exposed**, which is exactly why the
roadmap sequenced a second trade before building breadth.

### 5. `contains` is undocumented (DOCUMENTATION GAP)

Both packs use `surfaces contains 'walls'` and `making_good contains 'plastering'`, but the
v1 operator list — arithmetic, comparison, `&&`, `||`, `!`, ternary — never mentions it. It
is a real infix operator over `multi_enum` values and must be specified, or the first
independent engine implementation will reject valid packs. Added to the DSL definition:

> operators: arithmetic `+ - * / %`, comparison, `&&`, `||`, `!`, ternary, and
> `contains` (membership test: `<multi_enum> contains <literal>`)

### 6. Recommendation: a `match()` function (SUGAR, not required)

The fixture-repositioning weight is a three-deep nested conditional:

```
sum(fixtures, f.count * if(f.position == 'same', 0, if(f.position == 'moved_lt1', 1,
  if(f.position == 'moved_gt1', 2, 3))))
```

Correct and expressible, so not a blocker — but packs are meant to become authorable by
non-engineers, and enum-to-number lookups are the single most common shape in a pack.
`match(f.position, [['same',0],['moved_lt1',1],['moved_gt1',2]], 3)` is pure sugar over
nested `if`, adds no evaluation power, and keeps the DSL total.

### 7. Idiom: flat-hour allowances are tasks, not modifiers

"Seized stopcock: +1.5 hours" cannot be a modifier — modifiers multiply. Rather than adding
an additive-modifier concept, model it as a task with a 0-or-1 quantity:

```jsonc
{ "id": "stopcock_remedial", "quantity": "stopcock_remedial_units",
  "rate": { "typical": 1.5, "unit": "hr" } }
```

with `stopcock_remedial_units = if(stopcock == 'working', 0, 1)`. **No spec change** — it
prices identically, appears as its own line on the estimate (which the client should see
anyway), and inherits scoping and modifiers for free. Recorded here as the idiom so the
next trade doesn't reach for an additive modifier.

### Running the validator

[`trade-packs/validate-packs.py`](trade-packs/validate-packs.py) implements the
publish-time checks described above — reference resolution, cycle detection, DSL
whitelisting, mandatory rate sources, mandatory modifier explanations, and presentation
group coverage.

```sh
python3 docs/trade-calculators/trade-packs/validate-packs.py \
        docs/trade-calculators/trade-packs/*.pack.json
```

It is a prototype standing in for the real publish gate, not the finished engine. It checks
structure, not arithmetic — golden fixtures do that, and they need the practitioner review
in step 4 of the add-a-trade sequence before they mean anything.

---

## Spec v2 → v3: what the Landscaper forced

Third trade, same discipline: [`trade-packs/landscaper.pack.json`](trade-packs/landscaper.pack.json)
authored against the frozen v2 spec. All three packs validate clean.

**Verdict: mostly held, with one finding that reaches the pipeline.** Three vocabulary
additions, one genuine (if small) structural change at the output stage, and two
confirmations that earlier findings generalise. Reported in that order because the
structural one is the one that matters.

### 1. `risk.programmeOnly` — contingency that adds time but not money (STRUCTURAL)

This is the first finding in three trades that the vocabulary could not absorb.

Every risk buffer up to now inflates **hours**, and hours drive both price *and* duration.
That is correct for unknown conditions: if the ground might be worse than it looks, the job
costs more and takes longer together.

Weather does not work that way. A landscaping job in January will take longer — but the
work is the same work, and charging a domestic client 8% more because it is winter is not
defensible. The right answer is **float in the programme, not money in the price**:

```jsonc
"programmeOnly": [
  { "when": "winter_working && !fixed_completion_date", "addDays": 0.08,
    "explain": "Winter weather — allow float in the programme, not in the price" }
]
```

And it inverts on the condition: **once a fixed completion date is agreed, weather stops
being a scheduling matter and becomes commercial risk**, so the guard drops it out of
`programmeOnly` and it belongs in the priced buffer instead. That conditional inversion is
real domain logic, and no amount of vocabulary would have expressed it.

Engine change: stage 11 must compute `estimated_days` from
`hours × (1 + programmeBuffer)` while stage 9 prices `hours` alone. Small — one extra
multiplication at the output stage — but it is the **first time price and duration diverge**,
and every trade after this one inherits the capability. Weather is not unique to
landscaping; roofing, groundworks and external decorating all need it.

I am flagging this as structural rather than filing it with the vocabulary additions
because the earlier claim was "the pipeline did not change". That claim no longer holds
without qualification, and it is more useful to say so than to define the finding away.

### 2. `materials[].wastePctRef` — derived waste percentages (NEW)

Waste was a literal. Paving cut waste is not: stack bond wastes 5%, random 10%, a circle
feature 12%, herringbone 15%. The pattern is an answer, so the waste has to be a derivation.

```jsonc
{ "id": "paving_units", "wastePct": 0.05, "wastePctRef": "cut_waste_pct" }
```

`wastePct` stays as the fallback when no ref is given, so every existing pack keeps working.

### 3. `extras.pricing.banded` needs `multiple: true` (NEW)

v2's banded pricing assumed the top band absorbs everything above it — fine for a skip up to
12 yards. But muck does not stop at 12 yards; you order a second skip. A capacity band has
to be able to repeat:

```jsonc
{ "upTo": 9.2, "sku": "disposal.skip.12yd" },
{ "upTo": 9999, "sku": "disposal.skip.12yd", "multiple": true }
```

A validation warning backstops it, because silently under-ordering muck-away is one of the
most expensive mistakes in landscaping.

### 4. `pricing.day_rate` — calendar days and a separate delivery charge (NEW)

Two corrections to the v1 `day_rate` type, both learned from plant hire:

- **Hire is charged in calendar days, not working days.** A Friday start pays for the
  weekend. The pack derives `hire_calendar_days` and the extra is asked for directly
  ("Does the hire span a weekend?") rather than inferred, because the engine has no calendar.
- **Delivery and collection is a one-off**, not a per-day cost. `deliverySku` is added and
  charged once, and at £60–90 on a £90/day digger it is not a rounding error.

### 5. Confirmed: the two-task idiom generalises (NO CHANGE)

Hand-digging costs roughly **4.5×** machine digging. That is far too large to be a
modifier — it is a different method, not a harder version of the same one. Modelled as two
mutually exclusive tasks (`excavate_machine` / `excavate_hand`) gated on `machine_access`,
exactly as the Plumber's seized stopcock became a 0-or-1 task.

Second independent instance of the same idiom, so it goes in the authoring guide: **when a
condition changes the method rather than the difficulty, write two tasks, not a modifier.**
Modifiers are for degree; tasks are for kind.

### 6. Confirmed: `excludeFromMarginBase` generalised untouched (NO CHANGE)

Introduced in v2 for a £900 boiler. It now carries hired plant (a digger at cost plus a
handling markup, never at the labour margin) and client-chosen plants — with **no
modification to the flag or the engine**. A field invented for one trade absorbing two
unrelated cases in the next is the strongest evidence so far that the per-line design was
right and the original user-level setting was wrong.

### Running total after three trades

| Finding type | Count |
| --- | --- |
| Vocabulary additions (data the engine reads) | 7 |
| Structural changes (pipeline behaviour) | 1 |
| Documentation gaps | 1 |
| Idioms recorded, no change needed | 2 |
| Earlier findings that generalised untouched | 1 |

Roughly two days of engine work across three trades, and the shape of the cost is
reassuring: the vocabulary keeps absorbing new trades, and the one structural change
bought a capability that later trades need anyway.

---

## Spec v3 → v4: what the Electrician forced

Fourth trade, and the first chosen specifically to attack an earlier finding rather than to
add commercial breadth. All four packs validate clean.

**Verdict: one significant addition, and the `requires` design from v2 turned out to be
half-right.**

### 1. `requires` / `orElse` — a fork, not a block (SIGNIFICANT)

v2 added `jobTypes[].requires` for the Plumber, where the rule is absolute: gas work
without Gas Safe registration is illegal, so the pack refuses it. I generalised from one
example and built a **block**.

Electrical work proved that wrong. Notifiable work in a dwelling has **two lawful routes**:

- a registered competent person (NICEIC, NAPIT, ELECSA, STROMA) **self-certifies**, or
- anyone else **notifies building control and pays a fee** — typically £200–400.

Refusing the job would be flatly incorrect; the unregistered electrician can absolutely do
the work. What they cannot do is self-certify, and the fee is often larger than the job's
profit — so the calculator's real job is to **price the correct route**, and to make the
cost of not being registered visible.

```jsonc
{ "id": "consumer_unit", "notifiable": true }
```
```jsonc
{ "level": "error",
  "when": "is_notifiable && sub_region == 'england_wales' && !settings.registrations.part_p_scheme && part_p_route == 'self_certify'",
  "message": "You're not registered with a Part P scheme, so you can't self-certify. Switch to building control notification — the fee is added to the quote." }
```
```jsonc
{ "id": "building_control_fee", "label": "Building control notification",
  "pricing": { "type": "fixed", "sku": "cert.building_control.electrical" },
  "when": "needs_building_control", "excludeFromMarginBase": true }
```

So `requires` gains an `orElse`: **when the qualification is absent, take this route and add
this cost, instead of refusing.** The Plumber's hard block stays as the degenerate case —
`requires` with no `orElse`. The distinction is regulatory, so it must be declared per job
type by the pack author, never inferred.

**Correcting the v2 write-up:** I described `requires` there as generalising straight to
"the Electrician's NICEIC/Part P". That was too confident. It generalised in shape but not
in behaviour, and the difference is the whole finding.

### 2. Sub-region gating (NEW)

Part P is **England and Wales**. Scotland works to building warrants, Northern Ireland to
its own regulations. `region: "GB"` on the pack is too coarse, so notification logic is
gated on a `sub_region` answer. Every UK trade with a statutory regime will need this —
building control, planning and permitted development all diverge across the four nations.

### 3. `sum()` binds a scoped item alias — undocumented (DOCUMENTATION GAP)

The validator rejected the Electrician's `sum(new_circuits, c.count)` while accepting
`sum(rooms, r.length)` and `sum(fixtures, f.count)`. The packs were right and **the
validator was wrong** — it carried a hardcoded whitelist of `r`, `f`, `p` rather than
reading the binding, because the spec never said what the binding is.

The actual rule, now written down:

> `sum(collection, expr)` and `map(collection, expr)` bind each item to a **single-letter
> alias scoped to that expression**. The alias is conventionally the collection's first
> letter. Because the scope is per-expression, `p` may mean `points` in one derivation and
> `plants` in another with no collision.

An implicit binding that three packs relied on and no document described is exactly the
kind of gap that makes a second, independent engine implementation diverge silently. Worth
noting how it surfaced: not by reading the spec, but by a tool refusing to accept a
correct pack.

### 4. Confirmed again: two tasks for two methods (NO CHANGE)

`ev_short` and `ev_long` are separate tasks gated on `ev_long_run`, not one task with a
multiplier — a PME install with an O-PEN device and a TT install with an earth rod and
separation are different jobs, not harder versions of one. Third independent instance of
the idiom.

### Running total after four trades

| Finding type | Count |
| --- | --- |
| Vocabulary additions | 9 |
| Structural changes | 1 |
| Design corrections to an earlier finding | 1 |
| Documentation gaps | 2 |
| Idioms recorded, no change needed | 2 |
| Earlier findings that generalised untouched | 1 |

The trend is the one to watch: **trade four produced fewer new mechanisms than trade two,
but the one it produced was a correction, not an addition.** The lesson is not to
generalise a regulatory rule from a single trade — Gas Safe and Part P look alike and
behave differently, and only a second regulated trade could expose that.

---

## Spec v4 → v5: what the Tiler forced

Fifth trade, deliberately chosen as a **close neighbour of the Decorator** — m², a
substrate, a coverage rate — to test whether the vocabulary had settled. It mostly had:
`wastePctRef` (v3) carried layout-driven cut waste untouched, and the two-task idiom
absorbed epoxy grout and render-bedded tile removal without discussion.

One thing broke, and it is the direct descendant of the v3 structural change.

### 1. `tasks[].crewSize` — hours and elapsed time are not the same (STRUCTURAL)

Large format tiles (1200 × 600) are a **two-person job throughout** — one person cannot
safely lift, butter and place them. That is not a difficulty multiplier; the labour rate
already reflects the slower work. It is a statement about **how many people are on site**.

v3 established that price and duration can diverge (weather adds programme float, not
money). The Tiler is the mirror image: a two-person task costs the **same labour hours**
but takes **half the elapsed days**.

```jsonc
{ "id": "tile_large_format", "quantity": "total_area",
  "rate": { "typical": 1.10, "unit": "hr/m2" },
  "crewSize": 2 }
```

Engine change, at the same output stage v3 touched:

```
labourCost    = Σ(task.hours) × rate            // unchanged — hours are hours
elapsedDays   = Σ(task.hours / task.crewSize) / chargeableHoursPerDay
```

Two consequences worth stating, because both are easy to get wrong:

- **Overhead absorption still uses total hours, not elapsed days.** Two people on site for
  one day consume two people-days of van, insurance and phone. Dividing overhead by elapsed
  days would under-recover by exactly the crew size.
- **A second person is not free.** Where the user is an employer, `crewSize: 2` should draw
  on a second labour cost rate; for a sole trader hiring a labourer for a day, it is a
  subcontract line. The pack declares the crew size; **the settings decide what a second
  pair of hands costs**, and MVP can reasonably default to the same rate and flag it.

`crewSize` defaults to 1, so every existing pack is unaffected.

### 2. `materials[].singleBatch` (NEW, small but expensive to omit)

Tile shade varies between production batches. Ordering 22 m² and coming back for 3 m² is
not a small problem — it is a re-tile, at the tiler's cost. The flag tells the internal
breakdown to print the material as **one batch quantity** and warns against splitting it.

The mechanism generalises beyond tiling: paint from one mixing batch, stone from one block,
timber from one shipment. It is a **procurement constraint**, not a pricing one — the first
of that kind in the spec, and worth watching in case more appear.

### 3. Confirmed twice more: two methods, two tasks (NO CHANGE)

Epoxy grout at 0.35 hr/m² versus cement at 0.12 hr/m² is a 3× difference in material and
method; render-bedded tile removal versus standard likewise. Both are separate tasks gated
on an answer. Fourth and fifth instances — this idiom is now the most-reused decision in the
whole spec and belongs at the top of the authoring guide, not in a footnote.

### Running total after five trades

| Finding type | Count |
| --- | --- |
| Vocabulary additions | 10 |
| Structural changes | 2 |
| Design corrections to an earlier finding | 1 |
| Documentation gaps | 2 |
| Idioms recorded, no change needed | 2 |
| Earlier findings that generalised untouched | 2 |

Both structural changes landed in the same place — **the boundary between cost and
programme** — and neither touched stages 1–9. That is a meaningful signal: the pricing
pipeline proper has been stable across five trades, while the *output* model needed two
extensions. If a sixth trade forces a third change, the honest read is that quote outputs
were under-designed from the start, and the cheapest fix is to model programme as a
first-class output alongside price rather than continuing to bolt on flags.
