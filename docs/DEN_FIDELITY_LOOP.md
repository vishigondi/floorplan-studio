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
