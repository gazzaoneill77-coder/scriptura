# 04 — Input/Output Matrix: The Plumber's Pricing Calculator

**Quantity model:** unit counts (fixtures, radiators, valves) · linear metres (pipe runs) ·
hours-first (diagnostic and callout work) · fixed-price jobs (boiler swap, powerflush).

**Job types:** callout / repair · bathroom installation · boiler swap or install ·
radiator work · kitchen plumbing · pipework / re-pipe · unvented cylinder · emergency ·
landlord safety check.

Plumbing differs from decorating in three ways that shape the whole flow:

1. **Much of it is not measurable in advance.** The dominant variable is *what is behind the
   wall*, so the unknown-conditions buffer carries far more weight than any productivity rate.
2. **Time-of-day pricing is real.** Out-of-hours and emergency multipliers apply to labour,
   not to materials — a fitting does not cost more at 2 a.m.
3. **Certification and notifiable work carry fixed costs** independent of job size, and
   getting them wrong is a legal problem, not a pricing one.

> ⚠️ **Gas work is Gas Safe registered only. Unvented cylinders require G3. Electrical work
> in a bathroom is notifiable under Part P.** The app must capture the user's registration
> numbers at onboarding, print them on the estimate, and **refuse to produce a gas job type
> for an unregistered user** — offering instead the "subcontract to Gas Safe engineer" line.
> This is a hard product rule, not a setting.

---

## Inputs

### A. Job context

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| Job type | Cards | 9 archetypes above | Gates everything |
| Urgency | Cards | Booked in · next day · same day · emergency | Labour ×1.0 / 1.15 / 1.35 / 1.75 |
| Time of day | Segmented | Normal hours · evening · weekend · bank holiday | ×1.0 / 1.5 / 1.5 / 2.0 |
| Property type | Cards | Flat · house · HMO · commercial · landlord | Access, minimums, invoicing party |
| Property age | Segmented | Pre-1960 · 1960–2000 · post-2000 | **Primary risk driver** — lead, galvanised, imperial pipe |
| System type | Cards | Combi · system + cylinder · gravity/vented · unvented | Changes the entire task list |
| Water pressure / flow tested | Toggle + reading | — | Warns if spec is unachievable (e.g. multiple showers on low flow) |
| Stopcock located & working | Cards | Yes · seized · not found | Seized/not found → +1.5 hr and a risk flag |
| Parking / distance from van | Segmented | Outside · <50 m · restricted · congestion zone | Handling + permit/charge extras |
| Floor level / lift | Stepper | — | Material handling |
| Surveyed? | Toggle | Visited · photos · phone only | Risk buffer 0/10/22% |

### B. Fixtures and quantities (repeater)

| Input | Control | Notes |
| --- | --- | --- |
| Fixture list | Chips + steppers | Basin · WC · bath · shower · shower enclosure · bidet · kitchen sink · utility sink · outside tap · washing machine · dishwasher |
| Per fixture: supply | Segmented | Client supplies · plumber supplies | Removes/keeps material line + markup |
| Per fixture: position | Segmented | Same position · moved <1 m · moved >1 m · new position | Pipework hours ×1.0/1.4/2.0/3.0 |
| Radiators | Stepper + type | Swap like-for-like · new on existing pipework · new + new pipework · designer/vertical |
| Valves / TRVs | Stepper | Each |
| Pipe runs | Repeater | Length (m) · material (copper / plastic push-fit / PEX / MLCP) · diameter (15/22/28 mm) · bends · tees |
| Boiler | Cards | Like-for-like combi swap · conversion to combi · system → combi · relocate · new install |
| Cylinder | Cards | Vented swap · unvented install (G3) · remove |

### C. Access and making good — the cost drivers nobody quotes for

| Input | Control | Options | Feeds |
| --- | --- | --- | --- |
| Pipework access | Cards | Exposed · boxed-in · under floorboards · under laminate/engineered · under carpet · **concrete floor** · loft only | ×1.0 / 1.3 / 1.5 / 1.9 / 1.2 / **×2.4** / 1.4 |
| Chasing walls required | Toggle + linear m | — | 0.45 hr/m + dust extraction |
| Joist drilling | Stepper | Number of joists crossed | 0.15 hr each |
| Existing pipe material found | Segmented | Copper · plastic · **lead** · **galvanised steel** · imperial copper | Lead/galvanised → mandatory adaptor lines + 20% risk |
| Asbestos risk | Toggle | Pre-2000 property | **Blocks quote** → survey-required notice |
| Making good | Multi-select | None (excluded) · plastering · tiling · boxing · decorating | Each either a task or an explicit exclusion |
| Waste / old suite removal | Toggle + items | — | Tip fees, banded by item |
| Isolation possible without draining system | Toggle | — | Drain-down + refill + rebalance = 1.5–2.5 hr |

### D. Certification and compliance

Gas Safe number · G3 unvented number · Part P route (self-certify / subcontract / building
control) · Benchmark commissioning · Landlord Gas Safety Record · Water Regs notification
(WRAS/Reg 5, e.g. unvented, bidets with spray).

---

## Backend multipliers and benchmarks

### Labour — task hours

| Task | Unit | low | **typical** | high |
| --- | --- | --- | --- | --- |
| Callout — diagnostic minimum | job | 1.0 | **1.0** | 1.0 (then 0.5 hr increments) |
| Tap replacement — accessible | each | 0.6 | **1.0** | 1.8 |
| Tap replacement — seized/awkward | each | 1.2 | **2.0** | 3.5 |
| Basin — supply and fit | each | 1.8 | **2.5** | 4.0 |
| WC — close-coupled, same position | each | 1.5 | **2.2** | 3.5 |
| WC — back-to-wall / concealed cistern | each | 3.0 | **4.5** | 6.5 |
| Bath — standard, same position | each | 3.0 | **4.5** | 7.0 |
| Shower — mixer over bath | each | 1.5 | **2.5** | 4.0 |
| Shower — new enclosure + tray + waste | each | 5.0 | **7.5** | 12.0 |
| Radiator — swap like-for-like | each | 1.0 | **1.6** | 2.5 |
| Radiator — new + new pipework | each | 2.5 | **4.0** | 6.5 |
| Copper pipe run — exposed / accessible | m | 0.20 | **0.30** | 0.45 |
| Push-fit pipe run — accessible | m | 0.12 | **0.20** | 0.30 |
| Soldered joint / fitting | each | 0.10 | **0.18** | 0.30 |
| Full bathroom — strip out | job | 3.0 | **5.0** | 8.0 |
| Full bathroom — first fix | job | 6.0 | **9.0** | 14.0 |
| Full bathroom — second fix | job | 5.0 | **8.0** | 12.0 |
| Combi boiler — like-for-like swap | job | 8.0 | **11.0** | 16.0 |
| Boiler — system to combi conversion | job | 14.0 | **20.0** | 30.0 |
| Unvented cylinder install (G3) | job | 7.0 | **10.0** | 15.0 |
| Powerflush | per radiator | 0.5 | **0.75** | 1.2 (min 4 hr) |
| System drain-down and refill | job | 1.0 | **1.75** | 3.0 |
| Leak detection — no visible source | job | 1.0 | **2.0** | 4.0 |

### Materials — buffers and allowances

| Material | Rule |
| --- | --- |
| Copper pipe | **+10% length buffer** — the standard trade allowance; never quote exact run length |
| Fittings | **+15% count buffer**; if unspecified, estimate `bends = length × 0.6`, `tees = length × 0.25` |
| Solder, flux, PTFE, jointing compound, cloth | Sundries: `max(8% of materials, £18/day)` |
| Pipe clips | 1 per 1.2 m horizontal, 1 per 1.8 m vertical (15 mm copper) |
| Isolation valves | 1 per fixture supply, minimum 2 per job |
| Insulation | 100% of runs in unheated space (loft, void) — Water Regs, not optional |
| Consumables — cutting discs, drill bits, sealant | £12–25/day |
| Boiler / cylinder / suite | At cost + markup; **never** in the margin base if cost-plus is selected |

### Modifiers

| Modifier | Factor | Scope |
| --- | --- | --- |
| Emergency / same-day | ×1.75 / ×1.35 | labour only |
| Out of hours / weekend / bank holiday | ×1.5 / ×1.5 / ×2.0 | labour only |
| Concrete floor pipe run | ×2.4 | pipework |
| Under floorboards (with covering to lift) | ×1.5 (×1.9 laminate/engineered) | pipework |
| Boxed-in pipework | ×1.3 | pipework |
| Pre-1960 property | ×1.20 | all + risk |
| Lead or galvanised pipe found | ×1.35 + mandatory adaptor materials | pipework |
| Loft / restricted crawl space | ×1.4 | pipework |
| Stopcock seized or not found | +1.5 hr flat | job |
| Two-person lift (bath, cylinder, boiler) | +1 labour unit for the lift hours | handling |
| Second visit (first fix / second fix split) | +travel +0.5 hr set-up | job |

### Fixed costs (not hourly, not marked up as labour)

Gas Safe Building Regs notification · Benchmark commissioning · landlord certificate ·
Part P notification or electrician subcontract · WRAS notification · skip or tip fees for
old suite (banded by item: bath, WC, cylinder, boiler) · congestion/ULEZ charge · parking
permit.

### Risk buffers

Not surveyed +22% · photos only +10% · pre-1960 +15% · unknown pipe material +12% ·
boxed-in or inaccessible pipework +12% · system type unconfirmed +10% ·
client supplying own fixtures +8% (fit issues, missing parts, no warranty recourse).
**Capped at +35%** — higher than decorating, because the unknowns genuinely are larger.

---

## Outputs

**Client PDF** — grouped: Strip out and disposal · First fix · Fixtures and second fix ·
Materials · Certification · Extras. Plus, prominently, **what is not included** — making
good, tiling, plastering, electrical work, asbestos, and any work arising from conditions
found once panels or floors are opened. Payment schedule for jobs over £1,500 (deposit for
materials / stage payment / completion). Certification numbers printed on the document.

**Internal breakdown** — hours by phase, visits required, modifier trail, materials list as
a merchant order, achieved margin, effective £/hr against the out-of-hours multiplier, and
the risk buffer decomposition.

**Sanity warnings** — effective rate below the region's plausible band · emergency job
quoted at normal rates · gas job type selected without a Gas Safe number on file ·
unvented without G3 · making-good neither priced nor excluded (the single most common
source of plumbing disputes) · no isolation valves in the materials list ·
job over £1,500 with no staged payment schedule.
