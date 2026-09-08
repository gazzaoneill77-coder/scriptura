# 05 — Input/Output Matrix: The Landscaper's Pricing Calculator

**Quantity model:** m² (paving, turf, decking) · linear metres (fencing, edging, walls) ·
**m³ (excavation, sub-base, spoil)** · tonnes (aggregates, purchased and disposed) ·
unit counts (posts, plants, features).

**Job types:** patio · driveway · turfing · fencing · decking · garden clearance ·
planting scheme · sleeper/retaining walls · artificial grass · full garden redesign.

> **Implemented as** [`trade-packs/landscaper.pack.json`](trade-packs/landscaper.pack.json).
> The rates below are the source of truth for that pack; change them here first, then the
> pack, then re-run the validator.

Landscaping's defining variables are not on the drawing. They are **access**, **ground
conditions** and **muck-away**. A 40 m² patio with machine access and a 40 m² patio reached
only by carrying everything through a terraced house are different jobs with the same area,
and the second can cost 70% more. Access is therefore asked early and weighted heavily.

---

## Inputs

### A. Site context

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| Job type | Cards | 10 archetypes above | Gates everything |
| **Site access** | Cards **(asked 2nd, before any measurement)** | Direct machine access · side gate ≥1 m (barrow) · side gate <1 m · **through the house only** · rear access via alley | ×1.0 / ×1.35 / ×1.55 / **×1.80** / ×1.65 |
| Distance, parking to work area | Slider | 0–100 m | Handling hours: `+0.02 hr per m per tonne moved` |
| Ground conditions | Cards | Topsoil/loam · **heavy clay** · sandy · rubble/made ground · tree roots · rock | ×1.0 / 1.20 / 0.95 / 1.30 / 1.35 / 1.60 |
| Levels | Cards | Flat · slight fall · significant slope · terracing required | ×1.0 / 1.10 / 1.30 / 1.75 + retaining structures |
| Existing surface to remove | Multi-select + thickness | Turf · soil · slabs · **concrete** · tarmac · decking · shed base | Breakout hours + disposal tonnage |
| Services present | Multi-select | Gas · water · electric · drainage · unknown | **Blocks quote if unknown** → CAT scan / utility search line |
| Water and power on site | Toggle | — | Generator and bowser hire if absent |
| Season / start month | Month picker | — | Weather contingency; turf and planting seasonality warnings |
| Surveyed? | Toggle | Visited · photos · plan only | Risk buffer 0 / 12 / 25% |
| Planning / permeability | Auto-flag | Front garden driveway >5 m² | **SUDS**: permeable build-up or planning permission — a legal trigger, not a preference |

### B. Element specification (repeater — a garden is several elements)

**Paving / driveway**
Area m² · paving type (Indian sandstone · porcelain · concrete · block paver · setts ·
resin) · unit size · laying pattern (stack/stretcher · random · circle · **herringbone**) ·
sub-base depth (100 mm pedestrian / **150 mm vehicular**) · bedding (40 mm sand:cement ·
full mortar bed for porcelain) · jointing (kiln-dried sand · brush-in resin · pointed
mortar) · edging linear m · drainage channel linear m · falls and soakaway.

**Turfing** · area m² · topsoil depth needed (0/50/100/150 mm) · existing surface ·
rotavate y/n · turf grade (standard/premium/shade) · irrigation.

**Fencing** · run length m · height (0.9/1.2/1.5/1.8/2.0 m) · panel type (waney lap ·
featheredge · closeboard · slatted · trellis top) · post type (**concrete** / timber /
metal) · gravel boards · gates (count, width, pedestrian/vehicle) · existing fence removal ·
ground (soft / hard / concrete needing breakout).

**Decking** · area m² · height above ground · substructure (ground level / raised / over
100 mm requiring posts) · board type (softwood / hardwood / composite) · balustrade
linear m · steps count.

**Planting** · bed area m² · plant schedule (size bands: 9 cm / 2 L / 3 L / 5 L / 10 L /
specimen) · mulch depth · membrane · topsoil/compost m³ · tree pits.

**Retaining / walls** · length · height · type (sleepers · block and render · brick ·
gabion) · **over 600 mm → engineering and drainage requirements flagged**.

### C. Muck-away and plant hire

Excavation depth · spoil disposal route (skip · grab lorry · muck-away lorry · retain on
site) · material class (inert vs contaminated — **contaminated changes the price by
multiples**) · plant needed (mini digger 0.8/1.5/3 t · dumper · plate compactor · whacker ·
turf cutter · breaker · stump grinder) with hire days and delivery/collection charges ·
operator (self / hired-in with driver).

---

## Backend multipliers and benchmarks

### Labour — productivity rates

| Task | Unit | low | **typical** | high |
| --- | --- | --- | --- | --- |
| Turf lift and dispose | m² | 0.06 | **0.10** | 0.16 |
| Excavate to formation — machine | m³ | 0.35 | **0.55** | 0.90 |
| Excavate to formation — **by hand** | m³ | 1.80 | **2.60** | 3.80 |
| Break out concrete (100 mm) | m² | 0.30 | **0.50** | 0.85 |
| Lay and compact MOT Type 1 | m² per 100 mm | 0.12 | **0.18** | 0.28 |
| Lay paving — slabs on mortar bed | m² | 0.60 | **0.85** | 1.30 |
| Lay paving — porcelain (full bed + primer) | m² | 0.85 | **1.15** | 1.60 |
| Lay block paving | m² | 0.45 | **0.65** | 1.00 |
| Cutting allowance — complex pattern | m² | 0.08 | **0.15** | 0.25 |
| Jointing — brush-in | m² | 0.08 | **0.12** | 0.20 |
| Jointing — pointed mortar | m² | 0.25 | **0.40** | 0.60 |
| Edging — haunched | linear m | 0.20 | **0.30** | 0.45 |
| Lay turf (prepared ground) | m² | 0.05 | **0.08** | 0.12 |
| Ground prep for turf — rotavate, rake, level | m² | 0.10 | **0.15** | 0.25 |
| Fence — remove existing | linear m | 0.15 | **0.25** | 0.45 |
| Fence — dig post hole (soft ground) | each | 0.30 | **0.45** | 0.70 |
| Fence — dig post hole (hard/rubble) | each | 0.60 | **1.00** | 1.60 |
| Fence — set post + concrete | each | 0.25 | **0.35** | 0.50 |
| Fence — fit panel + gravel board | each | 0.30 | **0.45** | 0.70 |
| Fence — hang gate | each | 0.75 | **1.20** | 2.00 |
| Decking — substructure, ground level | m² | 0.45 | **0.70** | 1.10 |
| Decking — lay boards | m² | 0.30 | **0.45** | 0.70 |
| Planting — per 3 L shrub | each | 0.10 | **0.15** | 0.25 |
| Mulch spreading | m² per 50 mm | 0.04 | **0.06** | 0.10 |
| Barrow run — per m³ per 10 m | m³ | 0.15 | **0.25** | 0.40 |
| Site set-up / protection / clean-down | per day | 0.60 | **0.90** | 1.30 |

### Materials — quantities, conversions and waste

| Material | Rule |
| --- | --- |
| **Excavated spoil** | `volume × 1.30` **bulking factor** — spoil swells when dug. Skip and grab sizing uses the *bulked* figure, and forgetting this is the classic muck-away under-order |
| Inert spoil weight | ~1.8 t/m³ (clay heavier, ~2.0) — grab lorries charge by weight |
| MOT Type 1 | **2.1 t/m³ compacted**; 100 mm over 1 m² = 0.21 t |
| Compaction allowance | Loose depth ≈ **1.25 ×** finished depth — order to loose volume |
| Sharp sand (bedding) | 40 mm bed = 0.04 m³/m² ≈ 0.066 t/m² |
| Mortar bed (full, porcelain) | 4:1 sand:cement, 40 mm; +10% waste |
| Cement | 1 bag (25 kg) per ~0.15 m³ mortar at 4:1 |
| Paving cut waste | Stack/stretcher **+5%** · random **+10%** · circle **+12%** · **herringbone/45° +15%** |
| Turf | +5% waste; sold per m² roll; **must be laid within 24 h of delivery** — a scheduling constraint that belongs in the quote's programme |
| Topsoil | 100 mm over 1 m² = 0.1 m³ ≈ 0.15 t; +10% settlement |
| Fence posts | `panels + 1` — always. The most common fencing material error |
| Postcrete | **2 bags per post** standard; **3 bags** for 1.8 m+ or exposed sites |
| Post hole depth | ≥ **1/3 of above-ground height**, min 600 mm for a 1.8 m fence |
| Gravel boards | 1 per bay |
| Decking joists | 400 mm centres (600 mm composite-dependent — check manufacturer); +10% waste |
| Decking boards | `area ÷ (board width + 5 mm gap)`; +10% (+15% if diagonal) |
| Membrane / weed fabric | +15% for overlaps |
| Sundries | Screws, fixings, primer, sealant, line, pegs, blades: `max(6% of materials, £30/day)` |

### Plant hire and disposal (day-rate `extras`, not labour)

Mini digger 1.5 t ~£90/day + £60–90 delivery/collection · dumper ~£70/day ·
plate compactor ~£35/day · turf cutter ~£45/day · breaker ~£40/day · generator ~£45/day.
**Hire is charged in whole days including weekends** when the hire spans one — model as
calendar days, not working days, or the quote loses money every Friday start.

Disposal: skip 4/6/8/12 yd banded · grab lorry per load (~16 t) · tip weight charges ·
**contaminated or mixed waste at a multiple of inert rates** · green waste separately.

### Modifiers

| Modifier | Factor | Scope |
| --- | --- | --- |
| Access — barrow only / <1 m gate / through house | ×1.35 / ×1.55 / **×1.80** | excavation, materials handling, disposal |
| Hand-dig (no machine access) | Use the by-hand rate — a **~4.5× swing**, not a multiplier | excavation |
| Heavy clay / rubble / roots / rock | ×1.20 / 1.30 / 1.35 / 1.60 | excavation, post holes |
| Slope / terracing | ×1.30 / ×1.75 | all groundwork |
| Winter working (Nov–Feb) | ×1.15 | all outdoor tasks |
| Vehicular loading (driveway) | 150 mm sub-base + heavier spec | materials |
| Small job (<15 m²) | ×1.25 | all — set-up dominates on small areas |
| Large job (>150 m²) | ×0.90 | all — genuine economies of scale |
| Distance from parking >30 m | ×(1 + (d−30)/100), cap 1.4 | handling |

### Risk buffers

Not surveyed +25% · photos only +12% · unknown services +15% (**or block the quote**) ·
made ground / rubble suspected +15% · no access for a machine +10% ·
adjacent structures or boundary disputes +10% · weather contingency Nov–Feb +8% on
**programme**, and on price only if working to a fixed completion date. **Capped at +40%** —
the highest of the three trades, because the ground is the biggest unknown in construction.

---

## Outputs

**Client PDF** — grouped by element (Site clearance · Excavation and disposal · Sub-base ·
Paving · Edging · Turfing · Fencing · Planting · Plant hire) so a client can drop an element
without renegotiating the whole job. Programme in working days with weather caveat, staged
payment schedule (deposit for materials / on completion of groundwork / on completion),
and exclusions: services diversion, contaminated ground, structural retaining above
600 mm, tree works requiring a licence or subject to a TPO, and reinstatement of anything
damaged that was concealed.

**Internal breakdown** — hours by element and phase, machine vs hand split, tonnages in and
out as a supplier order and a muck-away booking, hire days by item, achieved margin by
element (the element view matters: paving typically carries margin, muck-away typically
leaks it), and £/m² against the trade band.

**Sanity warnings** — spoil volume not bulked · skip capacity below bulked spoil volume ·
driveway over 5 m² without a permeability or planning decision recorded · turf ordered with
no laying date · retaining structure over 600 mm without an engineering note ·
hand-dig priced at machine rates · hire spanning a weekend charged as working days only ·
unknown services with no CAT scan line.
