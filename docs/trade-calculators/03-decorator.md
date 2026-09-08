# 03 — Input/Output Matrix: The Decorator's Pricing Calculator

**Quantity model:** m² (walls, ceilings), linear metres (skirting, architrave, coving),
unit counts (doors, windows, radiators), per-room repeater.

**Job types:** whole house interior · single room · exterior · woodwork only ·
wallpapering · new-build / new plaster · commercial void

> All rates are UK trade norms for a competent solo decorator and are **starting
> benchmarks, not gospel**. Every one carries a `low/typical/high` band, is overridable per
> user, and must be reviewed by a practising decorator before the pack is published.

---

## Inputs

### A. Job context

| Input | Control | Options / range | Feeds |
| --- | --- | --- | --- |
| Job type | Cards | 7 archetypes above | Gates all subsequent questions |
| Property type | Cards | Flat · terrace · semi · detached · commercial | Defaults for room sizes, access |
| Property size | Segmented | 1/2/3/4/5-bed | Seeds the room repeater with typical dimensions |
| Property age | Segmented | Pre-1960 · 1960–2000 · post-2000 · new build | Risk buffer; lath-and-plaster, unprimed surfaces |
| Occupied? | Toggle | Empty · occupied · occupied with children/pets | ×1.10–1.18 masking and protection |
| Floor level / lift | Stepper + toggle | Ground → 5th, lift y/n | Access modifier on material handling |
| Parking | Segmented | Outside · <50 m · permit/paid · restricted | Extras (permit £) + travel time |
| Surveyed? | Toggle | Visited · photos only · described | Survey-confidence risk buffer 0/8/18% |

### B. Rooms (repeater — the core of the flow)

| Input | Control | Default | Notes |
| --- | --- | --- | --- |
| Room name/type | Chips | Bedroom, lounge, kitchen, bathroom, hall/stairs/landing | HSL is its own beast — see modifiers |
| Length × Width | Dimension pad | From property-size seed | Big numeric keypad, metric/imperial toggle |
| Ceiling height | Slider | 2.40 m | 2.2–4.0 m; >2.7 triggers reach modifier |
| Surfaces | Multi-select chips | Walls + ceiling | Walls · ceiling · woodwork · radiators · coving · doors |
| Doors | Stepper | 1 | 1.98 m² deduction each; own paint task |
| Windows | Stepper + size chips | 1 × standard | Small 1.0 / standard 1.8 / large 3.0 / patio 5.0 m² |
| Radiators | Stepper | 1 | Paint behind allowance + optional rad paint |
| Coving / picture rail | Toggle | Off | Linear m = perimeter |
| Skirting / architrave | Auto | Perimeter − door widths | Overridable |

### C. Specification

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| Wall condition | Cards | Good · minor · poor · needs lining | Prep hours ×1.0/1.10/1.25/1.60 |
| Substrate | Segmented | Previously painted · new plaster · bare · wallpapered | Mist coat; coverage penalty |
| Colour change | Segmented | Same/similar · light→dark · dark→light · strong colour | Coat count (dark→light = 3) |
| Coats | Stepper | 2 | 1–4 |
| Paint tier | Cards | Trade contract · trade mid · premium (Farrow&Ball etc.) | SKU tier + coverage + hours (premium ≈ ×1.05, more careful) |
| Client supplying paint? | Toggle | Off | Removes material line and its markup |
| Prep: strip wallpaper | Toggle + layers stepper | Off | 0.22 hr/m², ×1.5 multi-layer/painted-over |
| Prep: lining paper | Toggle | Off | 0.35 hr/m² hang + still needs painting |
| Prep: fill & sand | Auto from condition | — | Included in prep task |
| Woodwork condition | Segmented | Sound · needs sanding · stripping/burning off | ×1.0/1.25/2.2 |
| Furniture handling | Segmented | Clear · light · full room | Protection hours |

### D. Exterior (job type = exterior)

Storeys · render/masonry/timber/UPVC m² · soffit and fascia linear m · window count and type
· access method (ladders / tower / scaffold — scaffold is an `extras` line, often the
single largest cost) · surface condition (sound / flaking / needs stabilising) ·
season/weather window.

### E. Business settings (once, at onboarding — not per quote)

Labour cost rate £/hr · target margin % · material markup % · annual overheads · days worked
· chargeable hours/day · VAT registered · minimum job value · travel rate and radius ·
contingency stance (Tight/Balanced/Cautious).

---

## Backend multipliers and benchmarks

### Labour — productivity rates

| Task | Quantity | low | **typical** | high | Unit |
| --- | --- | --- | --- | --- | --- |
| Emulsion — walls (per coat) | wall_area_net | 0.085 | **0.105** | 0.130 | hr/m² |
| Emulsion — ceilings (per coat) | ceiling_area | 0.095 | **0.115** | 0.145 | hr/m² |
| Mist coat, new plaster | wall+ceiling | 0.070 | **0.085** | 0.100 | hr/m² |
| Prep — fill, caulk, sand | wall_area_net | 0.035 | **0.055** | 0.090 | hr/m² |
| Cut-in allowance | per opening | 0.18 | **0.25** | 0.35 | hr each |
| Masking and protection | per room | 0.60 | **0.85** | 1.30 | hr each |
| Skirting/architrave (prep + 2 coats) | linear m | 0.22 | **0.30** | 0.45 | hr/m |
| Door — both sides + frame | each | 1.30 | **1.90** | 2.80 | hr |
| Window — casement, prep + 2 coats | each | 0.80 | **1.20** | 2.00 | hr |
| Radiator — brush | each | 0.50 | **0.75** | 1.10 | hr |
| Strip wallpaper | m² | 0.15 | **0.22** | 0.40 | hr/m² |
| Hang lining paper | m² | 0.25 | **0.35** | 0.50 | hr/m² |
| Hang wallpaper — plain | m² | 0.30 | **0.42** | 0.60 | hr/m² |
| Hang wallpaper — pattern repeat | m² | 0.40 | **0.55** | 0.80 | hr/m² |
| Exterior masonry (per coat) | m² | 0.10 | **0.14** | 0.20 | hr/m² |
| Set-up / clean-down | per visit day | 0.40 | **0.55** | 0.75 | hr/day |

### Materials — coverage and waste

| Material | Coverage | Waste | Purchase units |
| --- | --- | --- | --- |
| Matt emulsion, trade | 11 m²/L per coat | 5% | 2.5 / 5 / 10 L |
| Emulsion on new plaster (mist) | **8 m²/L** (30% penalty, absorbent) | 5% | as above |
| Premium emulsion | 12 m²/L | 5% | 2.5 / 5 L |
| Satinwood / eggshell | 15 m²/L | 8% | 0.75 / 2.5 / 5 L |
| Gloss | 16 m²/L | 8% | 0.75 / 2.5 L |
| Undercoat / primer | 14 m²/L | 8% | 2.5 / 5 L |
| Masonry paint | 7 m²/L per coat | 8% | 5 / 10 L |
| Lining paper | 10 m²/roll | 12% | roll |
| Wallpaper (plain / patterned) | 5 m²/roll / **4 m²/roll** | 10% / 18% | roll |
| Filler, caulk, abrasives, tape, dust sheets | sundries | — | `max(12% of paint, £25/day)` |

**Purchase-unit rounding is not a rounding detail — it is money.** Needing 6.2 L means
buying 7.5 L. The engine solves for the cheapest valid combination of tin sizes.

### Modifiers

| Modifier | Condition | Factor | Scope |
| --- | --- | --- | --- |
| Poor wall condition | `wall_condition == 'poor'` | ×1.25 | prep, walls |
| Needs lining | `wall_condition == 'lining'` | ×1.60 | prep, walls |
| High ceilings | height > 2.7 m | ×(1 + (h−2.7)×0.20), cap 1.35 | reach |
| **Hall, stairs & landing** | room type HSL | **×1.40** | all — the highest-margin-error room in decorating |
| Occupied property | occupied | ×1.10 (×1.18 children/pets) | masking, protection |
| Dark → light colour | colour change | +1 coat (not a multiplier) | coats |
| Premium paint spec | tier = premium | ×1.05 | paint |
| No lift, 3rd floor+ | floor > 2 && !lift | ×1.12 | handling |
| Pre-1960 property | property age | ×1.10 | prep |
| Commercial void, unoccupied | job type | ×0.90 | all — no masking, free run |

**Compounded modifier cap: ×2.5.** Hitting it triggers a "site visit recommended" warning.

### Risk buffers

Not surveyed +18% · photos only +8% · pre-1960 +10% · unknown substrate +8% ·
client undecided on colours +5%. Capped at +30%.

---

## Outputs

**Client-facing PDF (unbranded)** — grouped lines: Preparation · Ceilings · Walls ·
Woodwork · Materials · Extras. Each with a plain-English description and a price. Totals,
VAT (if registered), estimated duration in working days, validity (30 days), deposit terms,
standard exclusions and assumptions. **No hours, no cost rates, no margin, no contingency.**

**Internal breakdown** — hours by task, every modifier that fired with its plain-English
explanation, litres and tins to buy as a merchant shopping list, material cost vs charge,
overhead absorbed, achieved margin, effective £/hour, £/m² sanity check against the
£12–18/m² band, and the confidence range from the rate bands.

**Sanity warnings** — under £8/m²; effective rate below labour cost rate; margin under 10%;
modifier cap hit; job over 15 days with no staged payments; materials over 40% of total
with margin-in-price selected (suggest cost-plus-markup instead).
