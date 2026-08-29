# External references — kit-home systems, published engineering data, and kit documents

Surveyed 2026-08-28/29 while looking at how comparable companies present a
kit-of-parts, and what technical documentation they publish that we could
actually consume.

**How to read this.** Entries are ranked by what they would change here, not by
how interesting the company is. Each Tier 1 entry names the specific thing in
this repo it bears on. Provenance is marked: *verified* means I read the source
page or document; *search-summary* means it came from a search result and has
not been confirmed at source — two claims in this survey were wrong the first
time and were only caught by going to the source, so the distinction is load-bearing.

---

## Tier 1 — engineering data that bears on gates we already run

### WikiHouse Skylark structural engineering guide  *(verified)*
<https://www.wikihouse.cc/engineering/what-is-skylark>

The system we actually model, documented by its authors. Sections: floor blocks,
wall blocks, lintels, bow ties (connections), gravity and lateral design, and a
worked single-storey house start to finish.

**Floor block spans** — <https://www.wikihouse.cc/engineering/floor-blocks>

| 250 series | span (mm) | span (ft) | | 200 series | span (mm) | span (ft) |
|---|---|---|---|---|---|---|
| XXS | 3338 | 10.95 | | XXXS | 2700 | 8.86 |
| XS | 3938 | 12.92 | | XXS | 3300 | 10.83 |
| S | 4538 | 14.89 | | XS | 3900 | 12.80 |
| M | 5138 | 16.86 | | S | 4500 | 14.76 |
| L | 5738 | 18.83 | | | | |

Also published per class: section modulus at the dovetail joint (Wⱼ) and at
mid-span, effective modulus of inertia (I), and rotational stiffness at the
dovetail (kᵣ).

> ### ⚠️ SUPERSEDED — these tables do not describe the blocks we bill
>
> **Resolved 2026-08-29, and the conclusion below was wrong.** The Skylark v1.0
> README states: *"Previous versions had standard insulation thicknesses of 200mm
> and 250mm. This version is thinner, with wall thicknesses of 150mm and 200mm."*
> The "250 series" and "200 series" tables are the **PREVIOUS generation**. The
> guide carries **no 150 table**, and the repo at our pinned commit ships only
> `SKYLARK150`. So there is no published span for the blocks we count.
>
> The blocks were measured instead — `scripts/measure-skylark-floor-span.py` —
> and the result cross-checks the published figures rather than replacing them:
> the field blocks come out in exact 1200 mm steps, each **exactly 101.2 mm**
> longer than the 250-series span for the same class (bearing, not coincidence).
> `MAX_JOIST_SPAN_FT` is now `SKYLARK150_MAX_FLOOR_SPAN_FT` = F-L's 5738 mm =
> **18.83 ft**.
>
> The original reasoning, kept because the error is instructive:

> **BEARS ON `MAX_JOIST_SPAN_FT = 16` in `lib/build-validator.ts`.** That constant
> carries no provenance comment, which is conspicuous in a codebase where the
> roof pitches got a measurement script, a pinned commit hash and a licence note.
> 16 ft sits *between* the two published series: above the 200-series maximum of
> 14.76 ft, and below the 250-series L at 18.83 ft. It is therefore either
> unsafe or needlessly conservative depending on which block a plan uses — and we
> do not model that choice at all.
>
> **Not yet actionable as a fix.** Our block ids are `E-L/E-S/E-XXS` and
> `F-L/F-S/F-XXS`; the mapping to the published 200/250 series is NOT
> established, and our wall thicknesses are 150/200 mm, a different axis.
> Asserting `E-L` = 250-L would be the same unverified inference this project
> keeps catching. The work is: establish the mapping from the Skylark repo, then
> replace the constant with per-class spans and a provenance comment.
>
> **What the error was.** I read a span table, matched the size-class letters to
> ours, and reasoned about safety margins — without checking which *version* of
> the system the table described. The letters matched; the system did not. That
> is the third time in this survey a number was taken from the wrong variant (the
> loft a-frame instead of the plain one; ÖÖD's homepage instead of its product
> pages). **Matching labels are not matching provenance.**
>
> It also cut the other way from what I claimed: 16 ft was not "possibly unsafe",
> it was needlessly conservative, and it corresponded to no block at all — F-S
> stops at 14.89 ft, so a 16 ft span already required an F-L reaching 18.83 ft.

### WikiHouse General Assembly Guide  *(verified)*
<https://www.wikihouse.cc/assembly/before-you-start>

A real build manual for the system we model: sequence (ground floor → walls →
upper floors → stairs → upper walls → roof → external envelope → internal works
→ completion), **4–6 person crew**, Genie lift (+4 m) for floor and roof blocks,
and a tool list (mallets, dead blow hammers, brad nailer, harnesses, platforms).

> **BEARS ON the deferred "assembly instructions" option.** The council's verdict
> was: do not synthesise instructions we cannot validate; link authoritative
> upstream ones. This is that link, for the exact kit we bill. It converts a
> blocked option into a hyperlink.

Companion guides: [Design](https://www.wikihouse.cc/design/what-is-wikihouse),
[Manufacturing](https://www.wikihouse.cc/guides/manufacturing).

### Insulspan technical information bulletins  *(verified — titles; contents not yet read)*
<https://www.insulspan.com/resources/technical-library/technical-information-bulletins/>

20+ free PDFs. The titles map onto our gate list almost one-to-one:

| Bulletin | Covers | Our analogue |
|---|---|---|
| TB 112 | Roof and floor panel transverse load design charts | `floor-span` |
| TB 101 | Permitted axial point loads | — |
| TB 111 | ASD and LRFD shear wall design loads | — |
| TB 116 | Roof or floor diaphragm assemblies | — |
| TB 124 | Roof panel overhang design chart | roof overhang |
| TB 113 / 115 / 117 | Wall panel design charts by spline type | `wall-module`, `wall-height` |
| TB 106 | ICC-ES Evaluation Report ESR-1295 | code-compliance path |
| TB 108 | Fire resistance rated assemblies | — |

Only load-bearing if we add a SIP kit — but if we do, this is the engineering
spine, and ESR-1295 is the compliance route the way IRC is ours.

### SIPA design resources  *(search-summary — sips.org returns 403 to fetch)*
<https://www.sips.org/resources/design> · <https://www.sips.org/publications>

Reported to include **27 SIP connection details** offered as an accepted
industry baseline, a "Design Considerations" checklist, and a generic SIP
specification. Connection details are the same class of thing our BIM component
registry encodes as `relationship` ("wall baseline is supported by a floor/deck
slab"), so a published baseline set is worth reading before we invent our own.

Free engineering guide, hosted by a member: [SIP Engineering Design Guide,
1st ed. 2019](https://epsbuildings.com/wp-content/uploads/2024/06/SIP-Engineering-Design-Guide-July2019.pdf).
Also seen: [SIPA-BEST-5 SIP layout drawings](https://www.sips.org/documents/SIPA-BEST-5-SIP-Layout-Drawings.pdf).

### Panel manufacturer specifications  *(verified)*

**Eco-Panels** — <https://old.eco-panels.com/product-information.html>
Closed-cell polyurethane, **R-7 per inch**, ~2.5 lb/ft³ density.

| Thickness | R-value |
|---|---|
| 3" | R-21 |
| 4.5" | R-26–31.5 |
| 6.5" | R-40–45.5 |
| 8.125" | R-60+ (custom) |

Wall panels standard **4′ × 8′**, max 4′ × 16′. Roof max 4′ × 16′ (12′ standard
at 8.125″). OSB skins typical; 15+ facing materials available.

> **Their 4 ft panel width is our 4 ft grid** (Skylark's 1220 mm = 4.003 ft), so
> our wall-run and roof-plane arithmetic would transfer to a SIP kit essentially
> unchanged. The structural system would not: Skylark is a plywood CNC block
> system, a SIP is a monolithic sandwich. Same module, different mechanics — a
> second kit with its own span, pitch and thickness rules, not a config flag.

**Fischer SIPs** — the supplier Mighty Small Homes names on its own FAQ
(*verified at source*; an earlier search wrongly suggested Enercept). EPS core,
**R-3.9 per inch** — roughly half the eco-panels figure per inch.

---

## Tier 2 — how a kit document is actually written

### Pluspuu "Export Delivery Contents"  *(verified — full text extracted)*
<https://www.pluspuu.fi/wp-content/uploads/2022/02/Delivery-contents-2022-Pluspuu.pdf>

The most useful single document in this survey: a real exporter's kit schedule,
and an independent confirmation of how `lib/kit/kit-schedule.ts` is built.

**Organised by building system**, not by component type: Plans and Instructions ·
Outer Wall Structure / Log Frame · Gables · Other Load-Bearing Structures ·
Dividing Walls · Base Floor · Top Floor and Rooftop Base · Roof Covering ·
Intermediate Floor · Cladding Boards · Terrace · Windows · Outer Doors.

**Three states, not two.** Every line carries a *delivery method* column:
`as installed` / `as material`. We have only "counted" vs "not supplied" — this
adds the middle state, which is what a real delivery needs.

**Exclusions sit inline, at full weight**, as the body of a section rather than
as a footnote:

> `BASE FLOOR ON TOP OF SLAB FOUNDATION — Not included`
> `TERRACE ON PILLAR FOUNDATION — Not included`
> `Space for insulation 300-500 mm (insulation material excluded)`
> `Underlay for metal roofing (Roofing does not include)`

That is exactly the equal-weight principle our kit schedule adopts, validated by
someone shipping actual kits.

**Engineering scope is disclaimed explicitly:** "If structural designing
(strength calculations, statics etc) is demanded by local authorities, the buyer
will take care of these documents at his own costs with the assistance of the
seller." Same move as our advisory's "verify with the authority".

**The line that matters most:** the plans list includes *"Log layouts
(installation drawings) per wall"*.

> **BEARS ON the exploded-view work.** That is the per-panel placement document.
> Our BOM is module arithmetic — `ceil(run / 4 ft)` — and carries no placements,
> which is why exploding our BIM yields ~5 category masses rather than individual
> panels. A real kit company ships per-wall layout drawings; that is the output
> shape the missing data should take.

Log profiles: non-settling laminated **134 mm** (unheated/occasional) or
**202 × 195 mm** (year-round heated), pine or spruce.

### Document tiering — three companies, one pattern  *(verified)*

| | Free / entry | Paid |
|---|---|---|
| **Avrame** | PDF plan views + side views with measurements — "developing your vision, family buy-in, preliminary municipal approval" | + cross-sections with elevations, foundation scheme, **AutoCAD files**, **working-hours estimation spreadsheet**, popular modifications — "permitting, contractor quotes, measuring exact quantities" |
| **Den** | Planning Package **$299** — informational drawings, construction budgeting worksheet, STR ROI calculator | Building Package **$1,999+** — full construction documents, CAD files, build licence, **materials quantities worksheet** |
| **Zook** | Floor plan PDF download per model | — (quote only) |

Two conclusions:

1. **The drawing set is the product, tiered by what it is sufficient FOR.** Not by
   page count — by whether it supports a decision, a permit, or a quote. Our
   takeaway sheet should say what it is sufficient for; the code advisory already
   half-does this.
2. **Den's $1,999 tier includes a "materials quantities worksheet" — which our kit
   schedule generates automatically, per plan, from geometry.** That is a priced
   product component we already produce as a by-product.

---

## Tier 3 — market positioning, and a correction

**Published pricing (all verified on product pages):**

| Company | What is published |
|---|---|
| ÖÖD | Glämping $54,400 / 98 ft² · Signature $139,900 / 234.6 ft² · Extended $158,700 / 290.6 ft² · Big Monolith $224,300 / 440.2 ft² → **≈ $509–596/ft²** |
| Den | $299 planning · $1,999+ building package · $133K+ prefab shell; plans also tagged by **budget band** ($100k–$250k) |
| Avrame | Kits priced in shop; drawings free/paid |
| Zook, Mighty Small Homes | No prices published |

> **Correction to an earlier claim in this survey.** I first reported that neither
> Zook nor Mighty Small Homes publishes prices and concluded "nobody publishes
> prices". That was wrong twice over: ÖÖD publishes prices on its *products*
> pages (the homepage hides them, which is why I missed it), and Den publishes a
> full tier ladder. The accurate statement is narrower and more useful:
> **nobody publishes a generated material-cost estimate; several publish product
> and document prices, and cost *bands*.**
>
> What they publish instead of estimates is a **frame for the buyer to compute
> their own**: Den ships a budgeting worksheet and tags plans by budget band,
> Avrame ships a working-hours spreadsheet. That is precisely the pattern our kit
> schedule already implements — arithmetic on a number the user supplies, never
> labelled an estimate. Three independent companies converge on it.

**Model typology worth stealing — Avrame.** Their A-frames are classed by
*section*, not size: SOLO+ and DUO are one floor plus loft; **TRIO is two full
height floors**. They make the headroom problem the primary product choice. That
is the exact constraint that forced our Bedroom 3 to 12 ft on a 36 ft a-frame —
we treat the a-frame as a roof style applied to a generic plan, they treat the
section as the product. Avrame also states "insulation materials are not part of
the kit", the same exclusion honesty as Pluspuu and our schedule.

**ÖÖD as contrast.** Steel frame, aluminium facade, road-transport dimensions
(Big Monolith: 36′3″ × 12′1.7″ × 11′1.1″, 44,092 lb) — width set by highway
limits, not a panel module. They publish no build-up, U-values or CAD, and lead
with hospitality metrics (nightly rate, occupancy) because they sell to
operators rather than builders.

---

## Licence note

We vendor none of these. WikiHouse's Skylark material is CC BY-SA 4.0 and this
repo already records measurements of it with a pinned commit hash rather than
copies of it (see `lib/kit/skylark.ts`). Anything adopted from the SIP sources
should be cited the same way — a measured or quoted figure with its source, not
a copied document.
