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

- arithmetic `+ - * / %`, comparison, `&&`, `||`, `!`, ternary
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
