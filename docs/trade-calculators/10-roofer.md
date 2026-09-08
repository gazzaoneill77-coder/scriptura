# 10 — Input/Output Matrix: The Roofer's Pricing Calculator

**Quantity model:** **pitched area derived from plan area × a pitch factor** · linear metres
(ridge, verge, hip, valley, flashing, gutter) · unit counts (chimneys, rooflights) ·
m² (flat roof).

**Job types:** full re-roof · re-felt and re-tile · flat roof · roof repair · chimney work ·
guttering, fascia and soffit · rooflight installation · leadwork.

> **Implemented as** [`trade-packs/roofer.pack.json`](trade-packs/roofer.pack.json).

Chosen sixth for the quantity model. Every trade so far measures what it can reach:
the decorator's wall, the tiler's floor, the landscaper's plot. **A roofer prices a surface
they cannot stand on, measured from the ground.** The pitched area is *derived*, not
observed, and that changes both the maths and what the client sees.

Two other things dominate roofing economics and both are priced as first-class lines:

- **Scaffold is frequently the largest single item** — £800–2,500 on a domestic re-roof, and
  it is hired by the week against the *programme*, not against labour hours.
- **The building is open once the covering is off.** Weather is not merely a scheduling
  inconvenience here; it is a liability.

> ⚠️ **Asbestos.** Pre-2000 roofs may carry asbestos cement slates, sheeting, or bitumen
> products in old felt. As with the Plumber's pack, suspicion **blocks the quote** and
> routes to a survey. This is not a pricing judgement.

---

## Inputs

### A. Roof geometry — the derived quantity

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| **Plan area** | Dimension pad | m² measured on plan (footprint) | Base quantity |
| **Pitch** | Cards | 15° · 22.5° · 30° · 35° · 40° · 45° · flat | **Pitch factor** table below |
| Roof shape | Cards | Gable · hip · **complex** (multiple hips/valleys) | ×1.0 / 1.15 / 1.25 |
| Ridge / hip / verge / valley | Sliders | Linear m each | Own tasks and materials |
| Storeys | Stepper | 1–4 | Access, scaffold spec |

**Pitch factor** — pitched area = plan area × factor. Implemented as a **lookup table, not
trigonometry**: the DSL is deliberately small and has no `cos()`, and roofing practice uses
tables anyway.

| Pitch | 15° | 22.5° | 30° | 35° | 40° | 45° |
| --- | --- | --- | --- | --- | --- | --- |
| Factor | 1.035 | 1.082 | **1.155** | 1.221 | 1.305 | 1.414 |

A 100 m² footprint at 30° is **115.5 m² of roof**. Quoting the plan area under-prices the
job by 15% before anything else happens.

### B. Covering and structure

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| New covering | Cards | Concrete interlocking · clay pantile · plain tile · **natural slate** · fibre cement slate | Rate, weight, batten gauge |
| Existing covering | Cards | Same options · asbestos cement · unknown | Strip rate, disposal weight, **asbestos block** |
| Battens and felt | Segmented | Replace both · felt only · reuse | Near-always replace on a re-roof |
| Ridge system | Segmented | **Dry ridge** · mortar bedded | Dry is now standard; mortar-only is a warning |
| Verge | Segmented | Dry verge · mortar · cloaked | — |
| Insulation | Toggle + depth | — | Own task |
| Timber condition | Segmented | Sound · **some replacement** · unknown | Risk buffer, provisional sum |

### C. Flat roof

Area m² · system (**EPDM** · GRP · 3-layer felt · single ply) · insulation and firrings ·
upstands and detail linear m · outlets and drainage · existing build-up to strip · deck
condition (sound / replace).

### D. Ancillaries

Chimneys: count · reflash · repoint · rebuild · remove. Rooflights: count and size.
Guttering, fascia and soffit: linear m each · replace or refurbish.
Leadwork: linear m and code.

### E. Access, waste and weather — where the money is

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| **Scaffold** | Cards | Not required · standard · **plus chimney lift** · restricted / roadway licence | Own extra; often the biggest line |
| Scaffold duration | Auto from programme | weeks | **Priced on elapsed days, not labour hours** |
| Access for erection | Segmented | Clear · restricted · over a neighbour / highway | Licence and permit extras |
| Waste | Auto by weight | Tiles and slate are heavy | Skips banded by **weight**, not volume |
| Season / start month | Segmented | Spring · summer · autumn · **winter** | Programme float, ×1.20 winter |
| Property age | Segmented | Pre-2000 · post-2000 | **Asbestos screening** |
| Surveyed | Segmented | Been up · seen from ground · photos only | Risk 0 / **15%** / 25% |

---

## Backend multipliers and benchmarks

### Labour

| Task | Unit | low | **typical** | high |
| --- | --- | --- | --- | --- |
| Strip existing covering | m² | 0.14 | **0.20** | 0.32 |
| Batten and felt | m² | 0.18 | **0.25** | 0.38 |
| Lay concrete interlocking tile | m² | 0.20 | **0.28** | 0.42 |
| Lay clay pantile | m² | 0.26 | **0.35** | 0.52 |
| Lay plain tile | m² | 0.38 | **0.50** | 0.72 |
| **Lay natural slate** | m² | 0.42 | **0.55** | 0.85 |
| Lay fibre cement slate | m² | 0.30 | **0.40** | 0.60 |
| Dry ridge | m | 0.26 | **0.35** | 0.52 |
| Mortar bedded ridge | m | 0.34 | **0.45** | 0.68 |
| Dry verge | m | 0.18 | **0.25** | 0.40 |
| Hip | m | 0.30 | **0.40** | 0.60 |
| **Valley** | m | 0.45 | **0.60** | 0.95 |
| Lead flashing | m | 0.40 | **0.55** | 0.85 |
| Chimney — reflash | each | 3.0 | **4.0** | 6.5 |
| Chimney — repoint | each | 4.5 | **6.0** | 9.0 |
| Rooflight into existing roof | each | 6.0 | **8.0** | 12.0 |
| Gutter — replace | m | 0.22 | **0.30** | 0.45 |
| Fascia and soffit | m | 0.42 | **0.55** | 0.80 |
| Flat roof — EPDM | m² | 0.42 | **0.55** | 0.80 |
| Flat roof — GRP | m² | 0.55 | **0.75** | 1.10 |
| Flat roof — 3-layer felt | m² | 0.48 | **0.65** | 0.95 |
| Insulation board | m² | 0.14 | **0.20** | 0.32 |
| Firrings | m | 0.26 | **0.35** | 0.52 |
| Loading out and set-up | per day | 0.60 | **0.90** | 1.30 |

### Materials

| Material | Rule |
| --- | --- |
| Concrete interlocking | ~10 per m², gauge 345 mm; +5% |
| Clay pantile | ~16 per m²; +5% |
| Plain tile | ~60 per m²; +5% |
| Natural slate | by size and lap; **+10%** — cutting and breakage |
| Battens | `1 / gauge` m per m² — 2.9 m/m² at 345 mm gauge; +10% |
| Membrane | +15% for laps |
| Nails, clips, disc rivets | per m², by covering |
| Dry ridge / verge kits | per linear m, +5% |
| Lead | by code and girth; **priced by weight and volatile** — `priceVolatility: high` |
| Mortar | ridge and verge bedding where used |
| EPDM / GRP | +10%; adhesives, trims, upstand detail |
| Insulation | board sizes, +8% |

### Modifiers

| Modifier | Factor | Scope |
| --- | --- | --- |
| Pitch over 45° | ×1.25 | roofing — roped access, slower |
| Complex roof (hips and valleys) | ×1.25 | roofing |
| Hipped roof | ×1.15 | roofing |
| Three storeys or more | ×1.20 | roofing, handling |
| Natural slate | ×1.30 | roofing — sorting, holing, breakage |
| Winter working | ×1.20 | all |
| Restricted access for loading | ×1.25 | handling |
| Occupied property | ×1.05 | all |

### Risk buffers

Not surveyed +25% · seen from ground only **+15%** · timber condition unknown +20% ·
existing covering unknown +15% · pre-2000 property +10% · complex roof +10%.
**Capped at +40%** — level with landscaping, and for the same reason: you cannot see the
thing you are pricing.

**Timber replacement is a provisional sum, not a buffer.** Rafter and batten condition is
genuinely unknowable until the covering is off, so the quote carries an explicit
"allowance for timber replacement — £X, adjusted on inspection" line rather than burying it.
A client who sees the allowance accepts the adjustment; one who does not, disputes it.

---

## Outputs

**Client PDF** — grouped: Access and scaffold · Strip out and disposal · Structure and
membrane · Covering · Ridge, verge and detail · Ancillaries · Materials. Scaffold shown as
its own line with its duration. Provisional sums itemised separately and labelled.
Programme in working days **with an explicit weather caveat**. Staged payments for anything
over about £3,000.

**Internal breakdown** — plan area *and* pitched area shown side by side, tile and batten
schedule as a merchant order, scaffold weeks against programme days, disposal weight,
achieved margin, £/m² of **roof** area.

**Sanity warnings** — plan area quoted without a pitch factor · asbestos suspected
(blocking) · scaffold not priced on a job above single storey · mortar-only ridge on a
re-roof · disposal banded by volume rather than weight · no provisional sum for timber where
condition is unknown · programme spanning winter with a fixed completion date.
