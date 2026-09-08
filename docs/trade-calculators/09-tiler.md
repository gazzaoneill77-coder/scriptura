# 09 — Input/Output Matrix: The Tiler's Pricing Calculator

**Quantity model:** m² (walls, floors) · linear metres (trim, silicone) · unit counts (cuts,
cutouts).

**Job types:** bathroom walls · bathroom floor · wet room · kitchen splashback · floor
tiling · outdoor / patio tiling · repair and regrout.

> **Implemented as** [`trade-packs/tiler.pack.json`](trade-packs/tiler.pack.json).

Sequenced fifth for a commercial reason as much as a technical one: **tiling is the
Plumber's biggest exclusion.** Every bathroom quote in `04-plumber.md` prints "tiling not
included" — which is the correct way to price it and a standing invitation to cross-sell.
A tradesperson holding both packs quotes the whole bathroom.

Technically the trade is close to the Decorator — m², a substrate, a coverage rate — which
made it a good test of whether the pack vocabulary had settled. It mostly had. The one
thing it broke is worth the trade on its own.

---

## Inputs

### A. Context and substrate

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| Job type | Cards | 7 archetypes above | Gates everything |
| Wall area / floor area | Dimension pad | m² | Primary quantities |
| **Substrate** | Cards | Plaster · plasterboard · cement backer board · sand-and-cement render · screed · **timber floor** · existing tile | Prep tasks; timber floors need overboarding |
| Substrate condition | Segmented | Sound and flat · minor variation · **out of level / out of square** | ×1.0 / 1.10 / 1.20 |
| Overboarding required | Toggle | — | 0.30 hr/m² + board materials |
| Levelling compound | Toggle + depth | — | 0.25 hr/m² + compound |
| **Tanking / waterproofing** | Toggle | — | 0.35 hr/m². **Mandatory in a wet room** — the pack blocks without it |
| Remove existing tiles | Toggle + substrate | — | 0.35 hr/m², 0.55 if bedded on render |
| Underfloor heating | Segmented | None · electric mat (install) · water (tile over) | 0.35 hr/m² install |
| Occupied | Toggle | — | ×1.10 |
| Room size | Auto from area | — | Under 4 m² → ×1.30, cuts dominate |

### B. Specification

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| **Tile size** | Cards | Mosaic · 100×100 · 200×250 · 300×600 · 600×600 · **large format 1200×600** | Labour rate, adhesive coverage, crew size |
| Tile material | Cards | Ceramic · porcelain · **natural stone** · glass · mosaic | ×1.0 / 1.0 / 1.25 / 1.20 / — |
| Layout | Segmented | Straight · brick bond · diagonal · **herringbone** | ×1.0 / 1.10 / 1.25 / 1.40 and cut waste |
| Grout | Segmented | Cement · **epoxy** | 0.12 vs **0.35** hr/m² — epoxy is three times the work |
| Cutouts | Stepper | Sockets, pipes, shower valves, downlights | 0.15 hr each |
| Edge trim | Slider | Linear m | Trim labour + 2.5 m lengths |
| Silicone | Slider | Linear m | 0.10 hr/m; ~6 m per tube |
| Client supplying tiles | Toggle | — | Removes material line and its markup |

---

## Backend multipliers and benchmarks

### Labour

| Task | Unit | low | **typical** | high |
| --- | --- | --- | --- | --- |
| Wall tiling — 200×250 ceramic, straight | m² | 0.42 | **0.55** | 0.80 |
| Floor tiling — 300×600 / 600×600 porcelain | m² | 0.58 | **0.75** | 1.05 |
| **Large format 1200×600** | m² | 0.85 | **1.10** | 1.60 |
| Mosaic | m² | 1.20 | **1.60** | 2.40 |
| Splashback — small area | m² | 0.60 | **0.85** | 1.30 |
| Remove existing tiles | m² | 0.25 | **0.35** | 0.60 |
| Remove tiles bedded on render | m² | 0.40 | **0.55** | 0.90 |
| Overboard with cement backer board | m² | 0.22 | **0.30** | 0.45 |
| Levelling compound | m² | 0.18 | **0.25** | 0.40 |
| Tanking / waterproof membrane | m² | 0.25 | **0.35** | 0.55 |
| Electric UFH mat — install | m² | 0.25 | **0.35** | 0.55 |
| Grouting — cement | m² | 0.09 | **0.12** | 0.20 |
| Grouting — **epoxy** | m² | 0.25 | **0.35** | 0.55 |
| Cutouts — socket, pipe, valve | each | 0.10 | **0.15** | 0.25 |
| Edge trim | m | 0.12 | **0.18** | 0.28 |
| Silicone | m | 0.07 | **0.10** | 0.16 |
| Set-up, protection and clean-down | per day | 0.50 | **0.75** | 1.10 |

### Materials

| Material | Rule |
| --- | --- |
| Tiles — cut waste | Straight **10%** · brick bond 10% · diagonal **15%** · herringbone **18%** · large format 8% · mosaic 10% |
| Natural stone | **+15%** on top — shade sorting and breakage; order the whole job in one batch |
| Adhesive | 3.5 kg/m² (small) · 5.5 kg/m² (300×600 / 600×600) · **8 kg/m² (large format, solid bed)**; 20 kg bags |
| Grout | 0.5 kg/m² small joints → 1.5 kg/m² large format |
| Tanking kit | m² + 10% overlap; **one kit minimum** |
| Backer board | 1.2 × 0.6 m sheets, +10% |
| Levelling clips and wedges | Large format only — 12 per m² |
| Trim | 2.5 m lengths, +10% |
| Silicone | ~6 linear m per tube |
| Sundries — spacers, blades, mixing, sponges | `max(7% of materials, £20/day)` |

**Order the whole job in one batch.** Tile shade varies between production batches, and a
short order mid-job is not a small problem — it is a re-tile. The internal breakdown prints
the batch quantity as a single line for exactly this reason.

### Modifiers

| Modifier | Factor | Scope |
| --- | --- | --- |
| Natural stone | ×1.25 | tiling — sizing variation, sealing |
| Glass or mosaic | ×1.20 | tiling |
| Herringbone / diagonal / brick bond | ×1.40 / ×1.25 / ×1.10 | tiling |
| Out of level or out of square | ×1.20 | tiling, prep |
| Small room under 4 m² | ×1.30 | tiling — cuts dominate a small area |
| Occupied property | ×1.10 | all |
| Wet room | ×1.20 | prep, tanking |

### Risk buffers

Not surveyed +18% · substrate unconfirmed +15% · existing tiles to remove with unknown
backing +12% · out of square +8% · client-supplied tiles +8% (breakage, short orders, no
recourse). **Capped at +30%.**

---

## Outputs

**Client PDF** — grouped: Preparation · Waterproofing · Tiling · Grouting and finishing ·
Materials. Exclusions: plumbing and electrical disconnection or reconnection, plastering
beyond levelling, removal of sanitaryware, and replacement of tiles broken after handover.

**Internal breakdown** — m² by area, tile count and **single-batch order quantity**,
adhesive bags, hours by phase, achieved margin, £/m² against the trade band.

**Sanity warnings** — wet room without tanking (blocking) · large format without a levelling
system · natural stone without sealer · tiles ordered across batches · epoxy grout priced at
cement rates · substrate not confirmed on a floor over timber.
