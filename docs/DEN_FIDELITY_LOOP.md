# The Den fidelity loop

Goal: our **generated** plans read like Den's. Not the drawing — that already
does (title block, north arrow, scale bar, chained dimensions, callouts, swing
arcs, poché, furniture). The generation.

## Why the old plans go first

The Den-derived traced plans (`gpt_proposal`, 18 proposals) would score *well* on
any Den-fidelity metric, because they ARE Den plans. Kept in the served set they
mask exactly the gap we are trying to close, and they average away the signal.

So the product serves only **our own compiler's output** (`constrained_json`).
The Den reference set and source images stay — they are the target to match, not
the thing being measured. Dropping them also removes the licensing exposure
outright, since what remains is entirely ours.

## Two halves, because "I looked at it" is not a gate

Every failure this project has had came from a check that could not fail. A
fidelity loop driven by eyeballing is exactly that. So:

### Half 1 — `check:den-fidelity`, computed from the artifact

Each metric is derived from the Den drawings and is a number that can regress:

| metric | Den, observed | today |
|---|---|---|
| public core is ONE room | universal — the studio encloses only its bathroom | 3 walled boxes |
| no corridor | Den never uses one | full-width "Hall" every time |
| kitchen adjacent to the core | always | bath sits between living and kitchen |
| entry / closet / laundry exist | throughout | absent |
| baths >= 2 when beds >= 3 | yes | 1 |
| deck | on every plan reviewed | absent |

Every metric gets a mutation test. A metric that cannot fail is not a metric.

### Half 2 — the real browser

Generate the full brief matrix, sweep it in Chrome, and read all three contact
sheets: **plan, elevations, 3D**. Numbers cannot see a plan that is technically
compliant and still wrong; that is what the sheets are for.

## Per fire

1. Take the highest-ranked unmet metric from `DEN_GAP_REVIEW.md`.
2. Implement it.
3. `check:den-fidelity` + the full ladder green. Mutation-test the new metric.
4. Regenerate the matrix; sweep in Chrome.
5. **Look at all three contact sheets** against the Den reference for that
   typology. Log what still differs, in words.
6. Commit with the fidelity numbers in the message.

Closed after **two consecutive fires that surface no new visual finding** — the
operating model this project already uses.

## The risk to name up front

The top two metrics (open core, no corridor) are one change seen from two sides,
and they **modify the room model** rather than adding to it. `WH-GRID-4FT`, the
wall-run panelisation and the entire BOM assume today's disjoint rectangles.
Expect those gates to move, and treat any that needs *loosening* as a stop-and-think
rather than a step.

---

## Findings log — 2026-08-18

Score **7 → 17 / 28** over four fires. Floor ratcheted 7 → 10 → 14 → 17; the
ratchet is mutation-tested at each step (script exits 1 one point above the
recorded floor).

### The correction that mattered most

The first fire merged living + dining + kitchen into ONE room labelled
"Living / Dining / Kitchen". **Reading the actual Den drawing showed that is not
what they do.** `a-frame-22-L1-fp.jpg` numbers Entry(1), Kitchen(2), Dining(3)
and Living(4) as four separate callouts inside one wall-free volume, with a
legend beneath. The openness is the absence of *partitions*, not the absence of
*names* — and the names are most of what makes their plans readable.

Merging won a metric by throwing away four labels. It was reverted to zones in
fire 3. **This is the argument for half 2 of the loop: the number went up while
the plan moved away from the reference.** No amount of metric-running would have
caught it; looking at the drawing did, in one glance.

The zone hooks (`semanticZone` / `physicalBoundary`, already honoured by the
grid gate) existed in the codebase and had never been produced by the generator.

### Two metrics were measuring the wrong thing

- `open-core` counted public rooms and demanded ≤ 1, which *punished* us for
  labelling the plan the way Den does. It now asks whether a wall stands between
  any two public rooms, reading the DRAWN walls — not the `semanticZone` flag the
  generator sets, which would make it a tautology.
- `kitchen-adjacent-to-core` asked whether two rectangles touch. A kitchen can
  share an edge with the living room *through a solid wall*.
- `has-entry` matched `/entry/` on the label, so naming a deck "Entry Deck"
  flipped it MET on two briefs with the interior unchanged. Third instance of
  this bug class, after `no-corridor` keying on the word "hall".

**The recurring failure is the same one every time: a metric that a rename can
satisfy.** Write them against geometry.

### Blockers found, and what they cost

- **3-bed open core is geometrically blocked.** On a 36 ft sloped-roof plan you
  cannot have all three of an open core, a rear bath, and three viable bedrooms:
  the bath cannot sit at either end of the front band (both x-edges are under the
  eave — an 8 ft bath there measures 2.1 ft, failing R305.1), and moving it to the
  rear band puts Bedroom 3 at the eave where it drops to 66 sq ft. A wider
  footprint buys it. Left split rather than loosening a habitability rule.
- **A deck is not free.** It is a structure on the lot, so envelope and coverage
  now measure the built extent, not the heated box. On the 40×60 a-frames that
  leaves 56 sq ft of coverage budget — a 12×4 entry deck, not a full-width one,
  and on a 40×58 lot no deck at all. That is the correct answer, not a failure.

### There are NO Den elevation references

The reference set (`den-reference-set/source-images/`, 62 files) is floorplans,
brochure photos, and one site plan. **Elevation fidelity to Den is not
measurable from it.** The loop's "compare elevations to Den" step cannot be run
as written; our elevations can only be checked for internal correctness until
reference elevations are sourced.

Related, and not yet acted on: `lib/elevations.ts` draws from footprint, roof and
openings and never reads rooms, so a deck can never appear in an elevation. For a
deck at floor level this is nearly moot — floor and grade coincide in the drawing,
so a flat deck has almost no front-elevation silhouette. What Den actually shows
is a *raised* deck with guard and steps, which our model cannot represent at all
because it has no floor-above-grade height. That is the real gap, and it touches
ZON-HEIGHT (measured from ground-floor level to ridge), so it is a deliberate
change, not a drive-by.

### The gate gap worth remembering

Fire 4 shipped a product blocker that the entire offline ladder called green: the
browser showed `fx-kitchen-fridge is missing anchorWallId` while `npm run gates`
reported 0 failures. The rule existed — but `check-paired-geometry` asserts wall
anchors on STORED plans only, so it could not see freshly generated ones.
**A rule that passes on the wrong population is a dead gate.** Now asserted in
`check-generation` across the brief matrix.

### Still unmet (11 of 28)

`no-corridor` on all four briefs (a 4 ft hall still runs the full width — this is
the last structural difference from Den, who reach bedrooms off the open volume);
`has-closets` on three; `open-core`, `kitchen-adjacent-to-core`, `has-entry` and
`bath-count-scales` on the 3-bed.

---

## Fire 5 — the corridor, 2026-08-23

Score **17 → 20 / 28**; floor 17 → 20. `no-corridor` MET on all three plans that
can take the change.

### What the reference actually says

"Den has no corridors" was too strong, and checking beat assuming again:
**outpost-medium HAS a Hallway** — 24×4 ft. What makes it not a corridor in our
sense is that it spans only **50%** of a 48 ft plan. And a-frame-22 has no
corridor at all: it has a **7×8 ft "Open Circulation" zone** (19% of span),
typed `open_circulation_zone` — squarish, not a ribbon.

Ours was a 4 ft hall at **100%** of the span. That was the outlier, not the
existence of circulation.

So the hall becomes an **8×8 pocket** the rear rooms open off, and — following
Den's own typing — a `semanticZone`, so no wall is derived between it and the
Entry zone. Circulation and entry are one continuous space. Bedrooms now run the
full 16 ft depth of the rear band and flank the pocket.

It keeps the id `room-hall`: that id is referenced in 20+ places and a global
room rename is exactly what hid a bug earlier in this loop.

The metric was already geometric (`w >= span*0.8 && d <= 6`) and does **not**
look at `semanticZone`, so the pocket passes on real geometry rather than on the
flag. The 3-bed, still a 36×4 ribbon, is the in-run control: it reports NOT MET
in the same run.

### Applies to 28 ft 1-bed and 2-bed only

The 3-bed and 4-bed keep the full-width hall. Their rear bands are tighter and
the 3-bed is already the known-constrained plan; converting them is its own fire,
not a rider on this one.

### Two more code-vs-reality gaps

- **Wet rooms cannot take the eave.** R305.1 gives bathrooms and laundry a hard
  6 ft 8 in minimum at their LOWEST point, unlike bedrooms which are judged on
  area clearing 5 ft. An 8×8 laundry at x20–28 measured 2.4 ft and failed. Only
  storage and closets, which carry no ceiling rule, can sit at the eave.
- **Doors were not counted as navigation connections.** Dropping the plan's only
  wall opening surfaced "Semantic JSON has no navigation connections" in the
  browser while the offline ladder stayed green. The cause was not the missing
  opening: `connections` were derived from `artifact.openings` alone, so *any*
  plan joined only by doors read as having no navigation. `openingToConnection`
  already classified door/open/sliding — doors simply were never fed to it.
  Fixed at the source rather than by re-adding an opening.

  The first attempt WAS to re-add one, spanning the pocket's open edge. An
  existing gate rejected it — "every door/window/opening sits on a wall" — and it
  was right: an opening is a hole in a wall, and two zones of one continuous
  volume have neither. That gate stopped a wrong fix.

**Third instance of the dead-gate pattern this loop**, after the fixture anchors:
a rule that exists, passes, and cannot see the population that breaks it. Now
asserted in `check-generation`; mutation-tested at 22 catches.

### Still unmet (8 of 28)

`has-closets` on the two 2-bed briefs; and the 3-bed's five (`open-core`,
`no-corridor`, `kitchen-adjacent-to-core`, `has-entry`, `bath-count-scales`).
