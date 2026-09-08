# 08 — Input/Output Matrix: The Electrician's Pricing Calculator

**Quantity model:** unit counts (points, accessories, circuits) · linear metres (cable,
containment) · fixed-price jobs (consumer unit change, EICR) · hours-first (fault finding).

**Job types:** consumer unit replacement · full rewire · partial rewire · additional circuit ·
EV charger · lighting · sockets and accessories · fault finding · EICR / inspection and
testing · outbuilding or garden supply.

> **Implemented as** [`trade-packs/electrician.pack.json`](trade-packs/electrician.pack.json).
> Rates below are the source of truth for the pack.

Electrical work differs from the three trades before it in one structurally important way,
and it is the reason this trade was sequenced fourth.

> ⚠️ **Part P is not a block — it is a fork.** Gas work without Gas Safe registration is
> simply illegal, so the Plumber's pack refuses it. Notifiable electrical work in a
> dwelling is different: a registered competent person (NICEIC, NAPIT, ELECSA, STROMA)
> **self-certifies**, and everyone else **notifies building control and pays a fee** —
> typically £200–400, often more than the job's profit. Both routes are lawful. The
> calculator's job is to price the right one, not to refuse the work.
>
> This forced a genuine spec change: see
> [`requires` / `orElse`](02-trade-pack-spec.md#spec-v3--v4-what-the-electrician-forced).

Scope note: Part P applies in **England and Wales**. Scotland works to building warrants
and Northern Ireland to its own regulations, so the notification logic is gated on
sub-region, not on `region: "GB"`.

---

## Inputs

### A. Job and property context

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| Job type | Cards | 10 archetypes above | Gates everything |
| Property type | Cards | Flat · house · HMO · commercial · landlord | Minimums, certification, invoicing party |
| **Property age** | Segmented | Pre-1966 · 1966–1980 · 1980–2005 · post-2005 | **Primary risk driver** — rubber/VIR cable, no CPC, no RCD |
| Sub-region | Segmented | England & Wales · Scotland · NI | Notification route and fee |
| Occupied? | Toggle | Empty · occupied | ×1.20 — rewiring around furniture and people |
| Floor level / lift | Stepper | — | Material handling |
| Surveyed? | Toggle | Visited · photos · described | Risk buffer 0 / 10 / 20% |

### B. Existing installation — the questions that decide the price

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| Consumer unit | Cards | Rewireable fuses · MCBs, no RCD · split-load RCD · dual RCD · RCBO board | Upgrade need; remedial likelihood |
| **Earthing arrangement** | Cards | TN-S · TN-C-S (PME) · TT · Unknown | TT needs a rod and different RCD strategy; PME blocks a simple EV install |
| Main protective bonding | Segmented | Present and adequate · absent · unknown | Bonding upgrade is near-universal on older CU changes and routinely forgotten |
| Existing cable type | Segmented | PVC · **rubber / VIR** · lead-sheathed · unknown | Pre-1966 cable means rewire, not repair |
| Circuits on the board | Stepper | 1–20 | EICR and CU pricing driver |
| As-built information | Toggle | Available · none | Risk buffer |

### C. Work content

| Input | Control | Notes |
| --- | --- | --- |
| Points (repeater) | Chips + steppers | Single socket · double socket · light point · downlight · switch · spur · cooker outlet · shower outlet · smoke/heat alarm · extractor · outdoor socket · data point |
| Per point: mounting | Segmented | Existing back box · new, surface · new, **chased** · new, dry-lined |
| Circuits added | Stepper + type | Ring final · radial · lighting · cooker · shower · EV · outbuilding |
| Cable runs (repeater) | Length + size | 1.0 / 1.5 / 2.5 / 4 / 6 / 10 / 16 mm² |
| Containment | Multi-select + length | Surface trunking · conduit · **SWA** · capping |
| Distance CU to work area | Slider | Drives cable, and on EV jobs it drives everything |

### D. Access and making good

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| Wall construction | Cards | Plasterboard/dot-and-dab · **solid masonry** · lath and plaster · concrete | Chasing ×1.0 / 1.4 / 1.25 / 1.9 |
| Floor access | Cards | Boards liftable · laminate/engineered · **concrete** · carpet | Cable route hours |
| Loft access | Segmented | Good · boarded/insulated · restricted · none | ×1.0 / 1.25 / 1.4 / route redesign |
| Chasing (linear m) | Slider | — | 0.40 hr/m + making good |
| Making good | Multi-select | None (excluded) · plastering · decorating | Same trap as plumbing — price it or exclude it |

### E. EV charger specifics

Distance from CU · supply capacity (60/80/100 A) and main fuse rating · existing maximum
demand · **earthing arrangement** (PME requires an O-PEN device or a TT rod and separation) ·
tethered or socketed · load management required · DNO notification or application ·
OZEV/grant eligibility · off-street parking confirmed · surface to cross (drive, lawn, wall).

### F. Certification

Scheme membership and number · EIC / MEIWC / EICR selection · Part P route (self-certify /
building control notification) · number of circuits to test · landlord EICR (5-yearly,
England) · DNO application.

---

## Backend multipliers and benchmarks

### Labour

| Task | Unit | low | **typical** | high |
| --- | --- | --- | --- | --- |
| Fault finding — minimum | job | 1.0 | **2.0** | 4.0 |
| Socket — existing back box | each | 0.25 | **0.40** | 0.60 |
| Socket — new, surface | each | 0.50 | **0.75** | 1.10 |
| Socket — new, **chased and buried** | each | 1.00 | **1.60** | 2.40 |
| Light point — replace | each | 0.40 | **0.65** | 1.00 |
| Light point — new | each | 0.80 | **1.25** | 2.00 |
| Downlight — per unit, existing ceiling | each | 0.35 | **0.50** | 0.85 |
| Switch — replace / new | each | 0.25 / 0.70 | **0.40 / 1.10** | 0.60 / 1.70 |
| Mains-interlinked smoke/heat alarm | each | 0.70 | **1.00** | 1.60 |
| Extractor fan — with new supply | each | 1.20 | **2.00** | 3.20 |
| **Rewire — per point, whole house** | point | 1.20 | **1.50** | 1.90 |
| First fix — per point | point | 0.45 | **0.60** | 0.85 |
| Second fix — per point | point | 0.35 | **0.50** | 0.70 |
| New circuit — cooker or shower | each | 3.0 | **4.0** | 6.0 |
| New circuit — ring final | each | 3.5 | **5.0** | 7.5 |
| New circuit — lighting | each | 2.5 | **3.5** | 5.5 |
| **Consumer unit change — like for like** | job | 4.0 | **5.5** | 8.0 |
| CU change — with remedials and bonding | job | 6.0 | **8.5** | 13.0 |
| Main protective bonding — per bond | each | 0.75 | **1.25** | 2.20 |
| EV charger — short run, TN-C-S + O-PEN | job | 3.0 | **4.0** | 6.0 |
| EV charger — long run or **TT rod required** | job | 6.0 | **8.5** | 13.0 |
| EICR — per circuit | circuit | 0.25 | **0.35** | 0.55 |
| EICR — set-up, report and issue | job | 0.75 | **1.25** | 2.00 |
| Chasing walls | m | 0.30 | **0.40** | 0.65 |
| Lift and relay floorboards | m² | 0.18 | **0.25** | 0.40 |
| Cable run — clipped direct, accessible | m | 0.06 | **0.10** | 0.16 |
| Cable run — **fished through fabric** | m | 0.20 | **0.35** | 0.60 |
| SWA — dug, laid and terminated | m | 0.30 | **0.45** | 0.70 |
| Testing and certification — per circuit | circuit | 0.15 | **0.25** | 0.40 |

**Rewire sanity rule.** A whole-house rewire is priced per point, not per room. A typical
3-bed semi runs 55–75 points; if the point count implies a price outside £3,500–6,500 for
that size, the quote gets a warning.

### Materials

| Material | Rule |
| --- | --- |
| T&E cable 2.5 mm² / 1.5 mm² | +10% waste; 50 m and 100 m drums — **buy to drum size** |
| 6 / 10 / 16 mm² | +10%; drums or cut lengths |
| SWA | +12% (terminations eat length); glands **2 per run**, always |
| Back boxes | 1 per point, +5% |
| Accessories | 1 per point; tier by range (standard / brushed / screwless) |
| Consumer unit | 18th Edition, metal-clad, SPD; **RCBO per circuit** is now the default spec |
| RCBOs | 1 per circuit + 2 spare ways — quote the board with spare capacity or you'll be back |
| Earth rod and clamp | Required on TT and on PME EV installs without an O-PEN device |
| Fixings, glands, sleeving, ferrules, labels | Sundries: `max(6% of materials, £15/day)` |

### Modifiers

| Modifier | Factor | Scope |
| --- | --- | --- |
| **Pre-1966 property** | ×1.35 | all + risk — rubber/VIR cable, no CPC to lighting |
| 1966–1980 | ×1.15 | all |
| Occupied property | ×1.20 | all — furniture, dust sheets, power off in stages |
| Solid masonry walls | ×1.40 | chasing |
| Lath and plaster | ×1.25 | chasing, routes |
| Concrete floors | ×1.90 | routes |
| Loft boarded / insulated / restricted | ×1.25 / ×1.40 | routes |
| No loft access at all | route redesign — a warning, not a multiplier | — |
| TT earthing | +rod, +testing | materials, testing |
| Commercial / HMO | ×1.15 | testing, certification |

### Risk buffers

Not surveyed +20% · photos only +10% · pre-1966 +18% · cable type unknown +15% ·
earthing arrangement unknown +12% · no as-built information +10% · concealed routes
unknown +12% · occupied +8%. **Capped at +35%.**

---

## Outputs

**Client PDF** — grouped: Consumer unit and supply · First fix · Second fix · Circuits ·
Testing and certification · Materials · Extras. Certification route stated explicitly
(self-certified under Part P, or building control notification with its fee shown as a
line). Scheme membership number printed. Exclusions: making good, redecoration, asbestos,
and any remedial work arising from defects found during testing.

**Internal breakdown** — hours by phase, point count and £/point against the rewire band,
cable schedule as a wholesaler order, certification cost, achieved margin, and the
notification route's effect on profit.

**Sanity warnings** — notifiable work with no route selected · CU change without a bonding
check · EV on PME with neither O-PEN device nor rod · rewire £/point outside band ·
EICR priced below the per-circuit floor · new circuits without spare ways on the board ·
making good neither priced nor excluded · load added without a maximum-demand check.
