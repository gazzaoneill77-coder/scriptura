# 07 — Mobile UX and Professional Handoff

The competitive claim is **"quoted before you leave the driveway."** Every UX decision is
measured against one number: **time from opening the app to a PDF in the client's WhatsApp.
Target: under four minutes for a typical job.**

The user is standing in someone's hallway, holding a phone in one hand and a tape measure
in the other, possibly with the client watching. They are not at a desk. They may have one
bar of signal. This is why the product is a calculator with a conversation flow, not a form.

---

## The flow

```
  Trade ▸ Job type ▸ Site basics ▸ Measure ▸ Condition ▸ Review ▸ Send
   (set once)   3 taps      4 taps      the work    3 taps    scan   2 taps
```

**A running price is on screen from the first answer.** It updates on every input, animated,
never blocking. This is possible only because the engine runs client-side, and it is the
single most important interaction in the product — it turns a form into a tool and gives
the user something to reason with rather than a wait to endure.

### Input controls

| Input kind | Control | Why |
| --- | --- | --- |
| Dimensions | Big numeric pad, one field at a time, auto-advance | Thumb-reachable, no keyboard switching, works with gloves |
| Counts (doors, radiators, posts) | Large −/+ steppers, 56 px targets | No keyboard at all |
| Condition, quality, access | Full-width **cards** with a plain-English sub-label | Reading beats guessing; "Lots of filling and sanding" not "Grade C" |
| Ranges (ceiling height, distance) | Slider with a live numeric readout and snap points | Fast approximate entry, precise when it matters |
| Multi-choice (surfaces, elements) | Chip grid, multi-select | One glance, one tap each |
| Yes/no | Segmented toggle, never a checkbox | Bigger target, unambiguous state |
| Rooms, fence runs, fixtures | **Repeater with duplicate** | "Same as last bedroom" is one tap, and most houses are repetitive |

Non-negotiables: minimum 48 px touch targets, primary actions in the bottom third
(thumb zone), sticky price bar and Next button above the keyboard, no modal dialogs during
capture, no field that requires two hands, and **autosave on every change** — a phone call
mid-quote must never lose work.

### Reducing the questions

The fastest input is the one not asked.

- **Property-size seeding.** "3-bed semi" pre-fills a room list with typical dimensions the
  user adjusts rather than enters. Most rooms need no edit at all.
- **Progressive disclosure.** Ask 6–8 questions to a defensible price. Everything else lives
  behind "Fine-tune" for the users who want it. A calculator that demands 40 answers before
  showing a number will lose to a scribbled figure on the back of a business card.
- **Learn the user.** Their last five jobs seed defaults: usual paint tier, usual coats,
  usual access assumption.
- **Photos are capture, not input.** Snap the room, attach to the quote for the user's own
  reference. No AI measurement claims in MVP.

---

## Review — the trust screen

Two tabs, and the second is why they subscribe.

**Client view** — exactly what the client will receive. Grouped lines, plain English,
prices. Editable descriptions (users have their own wording, and forcing generic copy makes
the tool feel like it isn't theirs). Lines can be marked **optional** (priced separately,
shown as "if required") or **excluded** (shown as explicitly not included) — both of which
prevent the arguments that cost trades money and reputation.

**Your numbers** (internal, never printed) — hours, every modifier that fired with its
plain-English explanation, cost vs price, overhead absorbed, achieved margin, effective
£/hour, and a materials list ready to hand to a merchant. Plus the sanity checks from each
trade's matrix, surfaced as amber banners, not blockers: *"This works out at £9.20/m². Most
decorators need £12–18/m² to make money."*

That screen is the product's real value. Anyone can multiply area by a rate; showing a
tradesperson the honest economics of their own quote is what earns £4.99 every month.

---

## The PDF

**Unbranded by default.** The estimate must look like it came from *their* business, not
from a tool they bought. No app logo, no "made with", no footer link. This is
non-negotiable and is a stated feature — the user's own logo is optional and theirs alone.

Contents: their business details and registrations (Gas Safe, G3, insurance) · client and
site address · quote reference and date · validity period · grouped itemised lines ·
optional items priced separately · subtotal, VAT if registered, total · estimated duration ·
payment terms and deposit schedule · **assumptions and exclusions verbatim from the pack** ·
acceptance line.

Generated **client-side** so it works with no signal; the edge function generates the
canonical stored copy and the version behind the share link. A4 portrait, one page for
typical jobs — a two-page estimate for a bathroom reads as padding.

## Sharing

1. **WhatsApp / native share sheet** — `navigator.share()` with the PDF as a file
   (Web Share Level 2). This is the primary path: it is how this trade actually communicates
   with clients, and it is the reason a PWA beats an app store download here.
2. **Share link** — `/q/{token}`, a mobile-friendly web view of the quote with a
   "Download PDF" button and an **Accept** button that timestamps acceptance and notifies
   the user. Tokenised, expiring, revocable.
3. **Email** — pre-filled `mailto:` with the link, or server-sent from the edge function
   with a proper template for users who want a record.
4. **Print / save** to Files or the camera roll.

The **Accept** button matters more than it looks: it converts a PDF into a tracked event,
turns the quote list into a genuine pipeline, and gives the app a reason to be opened on
days when nobody is quoting anything.

---

## Paywall placement

Free: unlimited calculations, on-screen prices, saved drafts, the internal breakdown.
**Paid: PDF export, share links, client records, job history, receipts.**

The free tier is deliberately generous on the *calculator*, because the calculator is the
hook and the marketing. The paywall lands at the moment of realised value — a document
about to go to a client — where a £4.99 decision is trivial against a job worth hundreds or
thousands. A trial that expires before the user has quoted anything real converts far worse
than a limit that binds exactly when they need it.

Mechanically: three free PDFs, then paywall. Never hold the calculation hostage — a user
who cannot get a number will not come back to find out whether they would have paid for it.

## Onboarding — five screens, once

1. **Trade** → which calculator.
2. **What do you want to earn?** Day rate or hourly, with the regional benchmark shown
   alongside. Framed as take-home, then converted to a cost rate.
3. **What does the business cost to run?** Six fields with trade-specific defaults, then the
   reveal: *"Your overheads are £6.06 in every hour you work. Most people never count
   this."* This is the emotional core of the onboarding and the best marketing line the
   product has.
4. **Profit margin.** Explained as "what's left after everything, including paying
   yourself", with markup shown next to margin so the difference is unmissable.
5. **VAT, minimum job, travel.** Defaults sensible, skippable.

Then straight into a first quote. **No empty state, ever** — a blank quote list on day one
is a churn event.

## Accessibility and field conditions

Legible in direct sunlight (high contrast, no thin greys on white) · large default type ·
dark mode for lofts and basements · usable one-handed · tolerant of wet or gloved fingers
(no small targets, no precise gestures, no swipe-only actions) · full keyboard and
screen-reader support for the desktop path, which exists mostly for evening admin ·
never blocks on the network.
