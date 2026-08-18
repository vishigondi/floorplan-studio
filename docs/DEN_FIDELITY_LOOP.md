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
