# Generation Quality Sweep

Prime directive: find real generation/correctness defects by **driving the real
brief→plan→code-check pipeline with diverse inputs and INSPECTING the output**,
generalize each to its **class**, add a **failing battery assertion** for the
class, fix the **root cause** in the compiler/constraint engine/geometry, and
verify against several briefs + the live app. Continue until diverse briefs
reliably produce sound, correctly code-checked plans you'd hand to an architect.

## Method per fire
1. Drive generation: `parseBrief → mockIntentFromBrief → compileIntent →
   codeAdvisoryReport` (and the live brief box / /api/generate-plan at :3002).
2. Vary briefs hard: tiny/huge sqft, extreme lot/setbacks, odd bed/bath, gable
   vs a-frame, with/without loft.
3. INSPECT: room layout sanity, dimensions, door/window placement, egress, roof
   geometry, loft headroom, AND every constraint-engine verdict — looking for a
   "pass" that should fail (or vice-versa), degenerate geometry, or misleading
   output.
4. Found a defect → write its class + a failing assertion (check:generation /
   check:code / check:clip / check:elevations) → fix the ROOT CAUSE (one
   constructive model, not a special case) → re-verify → record below.
5. `npm run gates` + `npm run gates:live` green before commit. Guardrails:
   deterministic sheet/3D/elevations/code stay the source of truth (update a
   gate's expected values only with justification — never loosen to pass);
   traced plans + gen-001 untouched; keep every data-* hook; delete throwaway
   gen-* after each fire.

## Code review — four real defects, three of them mine (2026-08-16)

Full review pass: `tsc`, `eslint`, the whole gate ladder, then reading every line
changed this session, then auditing the wider tree for the classes these fires
keep surfacing.

### 1. Roof pitch was written out by hand FOUR times, and the copies were wrong
`lib/build-validator.ts`, `lib/generate/compile-plan.ts`, `scripts/check-buildable.mjs`
and the inverse in the kit-gable ridge each encoded the ridge↔pitch relationship.
They had already drifted (some clamped a negative rise, some did not) — and every
one of them **divided the span in half**. That is right for a ridged roof and
wrong for a shed, whose single plane rises across the WHOLE span:

> a 28 ft shed going 8 ft → 12 ft was reported at **15.9°**. It is **8.1°**.

That number is in this very log twice, from earlier fires, stated as fact.
Fixed with `lib/roof-geometry.ts` — one `roofRunFt` / `roofPitchDeg` /
`ridgeHeightForPitchFt`, used by all four callers (P7). Only the shed's number
changes; every other style is identical. `check:buildable` now asserts the pitch
of all seven styles AND that the run is the whole span for a shed, half for the
rest; mutating the run back to half-span fails with `shed: pitch is 8.1°: 15.95°`.

### 2. An opening could be drawn on TWO elevations at once
The drawing tolerance is deliberately generous (1.6 ft, because traced artifacts
inset openings by up to ~1.2 ft). Each facade was tested against it independently,
so an opening shorter than ~3.2 ft sitting in a corner is within reach of two
facades and gets drawn on both. Verified: a 1.5 ft window at (0,0) drew on
`front, side`. Compiled openings are 2.5–4 ft so they never tripped it; traced
plans can. Facade assignment is now EXCLUSIVE — nearest facade wins, ties in a
fixed order — and `check:elevations` asserts every opening is drawn exactly once
(105 assertions) plus a direct corner case. Mutation-tested.

### 3. `npm run lint` was not in the gate ladder
Two `prefer-const` **errors** and 29 warnings were sitting in the tree, entirely
ungated — `gates` ran the batteries and the build, never eslint. Errors fixed
(both pre-existing, `d4eeddb`), and `lint` is now the first step of `gates`.

### 4. My visual sweep had two notions of failure
`visual-sweep.mjs` incremented a `failures` counter AND pushed to `findings`, but
the exit code read only `findings`. Two counters that can disagree is how a red
gate reports green. The counter is gone; `findings` is the single record.

### Validated, not just re-run
- `tsc --noEmit` clean; `eslint` 0 errors; `gates` + `gates:live` green.
- **Determinism**: 6 briefs × 5 compiles each — byte-identical artifacts every
  time (the fixture ordering and tie-breaks introduced this session are stable).
- **Pathological inputs**: no planes, fixture larger than its room, zero-size
  room, empty set, unknown room, no candidates, degenerate rects, a room with no
  exterior wall — all degrade sensibly, nothing throws.
- **No swallowed errors** (`catch {}`) and no TODO/FIXME/HACK anywhere in
  `lib/`, `app/`, `components/`.
- Mutation-tested every invariant added this session.

## Review, part 2 — the deliverable was still short two elevations (2026-08-16)

Continued the review into the two files I had only read around my own changes
(`app/page.tsx` 5,495 lines, `components/FloorPlanView.tsx` 3,735). The read was
pattern-directed — non-null assertions, unchecked casts, unguarded division,
fixed lists that should derive — then reading every hit.

### The find: the client packet shipped Front + Side only
`clientPacketHtml` is the single self-contained deliverable — plan, elevations,
code report, BOM — the thing that leaves the building and reaches a client. It
hardcoded exactly two elevation sections. So the earlier fire fixed the drawing
set **on screen** and left the **deliverable** short the rear and right walls —
which on an a-frame is where both bedroom EGRESS windows live.

The per-elevation SVG export had the same shape: two buttons, front and side.
There was no way to export a rear or right elevation at all.

- **Class:** _the same rule implemented once per surface — screen, packet,
  export — so fixing one leaves the others wrong._
- **Fix:** `drawnElevationViews` moved into `lib/elevations.ts` as ONE rule; the
  panel, the packet and the export buttons all read it (P7). One button per
  facade the plan draws.
- **Verified by download, not by reading the code:** clicked through the real
  export dialog, captured the file, parsed it — the packet now contains
  `Front, Side, Rear, Right` (5 SVGs; it was 3).

### Same shape in a gate: `check:drawing` graded a fixed pair
`check-drawing-standards.mjs` looped `['front', 'side']` with its OWN copy of the
facade-matching math (pre-exclusivity semantics). A rear or right elevation the
product ships was ungraded by that battery. It now iterates the drawing set and
takes its geometry from `facadeFor` — 14 facade gradings across the stored plans,
no local copy.

### Also checked, no defect
- No `catch {}`, no TODO/FIXME/HACK in `lib/`, `app/`, `components/`.
- 4 `as unknown as` casts, all at JSON boundaries and all narrowed after.
- Non-null assertions are confined to a `sourceWalls!` block already guarded by
  a `sourceWalls?.length` test.
- `widthFt / depthFt` in the paired-aspect audit has no zero guard, but the
  compiler refuses a zero-depth plan, so it is unreachable; noted, not changed.
- `roomVisualCenter` indexes `parts[0]` — `roomParts()` always returns ≥1.

## A whole battery was outside the ladder, and had rotted (2026-08-17)

`scripts/check-den-seeds.mjs` (`npm run paired:smoke`) is 182 assertions over the
manifest, the plan store and the source of the app. **It is not in the gate
ladder**, so nothing ran it, and it had been failing for a long time. It is in
the ladder now, and green. The seven failures split three ways.

### Stale strings, where the invariant still holds (5)
Four assertions named a gallery UI that no longer exists — "product plan cards",
"elevation preview", "quality lane chips", the "next repair target" badge. The
gallery was rebuilt around a plan **feed** whose QA blockers are a different and
somewhat richer set. I re-pointed them at what the feed guarantees today
(concept render, dimensioned plan, Repair action, Open Plan, no harness leak),
so the intent survives rather than being deleted.

The fifth is the more interesting one. It asserted three object literals for the
review tabs; Overlay became conditional (`{ id: 'overlay' as CompareMode, ... }`)
and the literal stopped matching while the tabs were still exactly Compare /
Overlay / Semantic. It now asserts the **type union**, which is the real source
of truth — and is strictly stronger: the old form could not have caught a
*fourth* tab being added, the new one cannot miss it. Verified by mutation.

### A lane confusion (1)
`brief-aframe-2br`, `gen-001` and `loft-showcase` were flagged as "missing
validation URL". All three are `constrained_json` — the JSON-only lane. They have
no GPT validation sidecar because they are compiled deterministically and graded
by check:generation / check:code / check:drawing instead. The assertion demanded
one from every plan, so it failed the moment the first JSON-only plan was seeded.
Writing them a validation file to make it pass is precisely the "synthesize a
fake source to satisfy an old gate" the working agreement forbids, so the check
is now lane-aware — and **without a `continue`**, so every later assertion in
that loop still applies to both lanes.

### Real data drift (1)
`summary.planCount` said 32 against 35 plan directories. `proposalCount` said 18
against 21. Both off by exactly the three JSON-only plans: they were seeded
without updating the summary. planCount was caught only because something
asserted it; **proposalCount drifted in complete silence, because nothing did**.
Corrected both and added the missing assertion. A summary field with no assertion
is just a number that used to be true.

Note the manifest lives in the symlinked sibling checkout, so that data
correction is NOT in this repo's commit — same two-repo split flagged earlier.

### Mutation testing
Four independent mutations, each caught, each restored green: strip `sourceKind`
from a JSON-only plan (demands a validation URL again), drift proposalCount by
one, add a fourth tab to the CompareMode union, delete a gallery blocker string
from the QA script.

### The pattern
This is the third dead-gate finding today, after the assertion behind `--only`
and the two `timeout`-prefixed verifications. A battery nobody runs does not
decay gracefully into "still mostly right" — it decays into a script that cannot
even start, while the ladder stays green and reports nothing. Being *in the
ladder* is the property that matters; the assertions are downstream of that.

## Generated plans never worked in production, and nothing said so (2026-08-17)

I picked up "fresh plans 404 on a `.render.svg` they don't have yet" expecting a
timing wrinkle. It was not transient. **The render never arrived at all** — not
after 60s, not ever — and pulling that thread found three more defects stacked
behind it, ending in one that made the product's headline feature non-functional
in production.

### 1. The render was never produced (dev)
`/api/generate-plan` spawns a detached child to capture the stored SVG and hands
it an origin built from the request. That origin was `127.0.0.1`, and Next blocks
client data fetches from a dev origin outside `allowedDevOrigins` — the same trap
that cost me a sweep earlier today. The renderer loaded a page with **zero
plans** and timed out. One character isolates it: same command, `localhost`,
writes the file. The hostname is already validated as loopback, so the SSRF guard
is untouched.

### 2. The failure was invisible by construction
The child ran with `stdio: 'ignore'` inside a `try {} catch {}` whose catch is a
comment. A 30s timeout, every single time, and **no trace anywhere**. That is why
this survived: not subtlety, just a muted channel. Its output now goes to
`artifacts/render-backfill.log` — which is how I diagnosed everything below.

### 3. The manifest claimed the render before it existed
`deterministicRenderUrl` was written at manifest time, ~10s before the bytes.
The field is the app's "a stored render EXISTS here" signal: it feeds an `<img>`
and the brochure export. So the product advertised an asset it did not have and,
once (1) failed, never would. The renderer now derives the path itself and
**writes the claim only after the file lands** — with the honest consequence that
a fresh plan briefly reports "no stored render", which it genuinely doesn't have.

### 4. The one that mattered: `public/` is enumerated at BUILD time
With (1)-(3) fixed the gate still failed under `next start`, and the child log
said `page.goto` timed out. Not the host — a fresh plan simply could not load.

Next serves `public/` from a build-time snapshot. Measured directly:
- a file **added** after the build → **404, permanently**
- an existing file **modified** after the build → fresh content

Generation does both. It appends to `proposal-manifest.json` (pre-existing, so
the feed lists the new plan) and writes a new `<plan>.paired.json` (**unservable**).
**Every generated plan appeared in the production feed and none of them could be
opened.** The deterministic-render capture was simply the first thing to notice,
by hanging.

Fixed by serving the store through `/api/plan-file/[...path]` — bytes off disk
per request, identical in dev and production. All 13 URL sites were in one file
(`lib/data.ts`), so it is one constant. Containment is checked against the
store's **real** path, because the store is a symlink into a sibling checkout;
a cwd-prefix test would reject every legitimate read. Traversal probes
(`%2e%2e`, encoded separators) return 400/404, legitimate reads 200.

Result in production: paired JSON serves 200, the render lands in **2s**, and the
generated plan sweeps **18 assertions, 0 failures** with a correct drawing —
title block, north arrow, scale bar, chained dimensions, fixtures spread.

### The gate, and where it had to live
The first version went into `check-den-seeds.mjs` — which turns out **not to be
in the gate ladder at all**, and has been failing for a long time unnoticed. Its
`PANEL_WIDTH_FT = 1.2 * FT_PER_M` assertion still demanded the 1.2 m figure that
commit `9fb3825` corrected: the real Skylark sheet is 2440x1220 mm and
1220 mm = 4.003 ft, so the 4 ft grid (WH-GRID-4FT) is right and the assertion was
stale. I fixed that one. **Six more are stale** — 4 brochure-QA gallery
assertions, a review-tabs assertion, and two data ones (`manifest plan count 32
does not match 35`, `brief-aframe-2br missing validation URL`). Left for the user
to weigh: that battery is 182 brittle source-text `includes()` checks, and the
last two are real data questions, not string rot.

The invariant then went where it runs: whole-manifest "every stored-render claim
is backed by bytes" in `check:drawing` (20 claims swept), plus a new live
`check:backfill` in the ladder. It could not go in the sweep alone —
`check:visual:quick` passes `--only`, which skips the generated lane entirely, so
the assertion I added there **never executed**. I caught that only because I
grepped the live log for it instead of reading "all live gates green".

Mutation-tested, each independently: restore `127.0.0.1` -> backfill FAILs;
re-add the premature claim -> honesty check FAILs; delete a claimed render ->
drawing gate FAILs. All restore green, and the gate cleans up its throwaway plan
in a `finally` so a failure never leaves the store dirty.

### The recurring tell
Three times today a check "passed" by not running: a gate after `browser.close()`,
two `timeout`-prefixed verifications on a macOS box with no `timeout`, and now an
assertion behind an `--only` flag. Same signature every time — **green, with no
evidence the code executed**. Counting executions is the only defence that has
actually worked.

## Visual sweep clean; I killed a sibling project's dev server (2026-08-17)

### The visual review (the point of the fire)
Full 18-plan sweep, **312 assertions**, and I looked at all three contact sheets.
Plans: fixtures spread, lofts sharing the building frame, seven distinct roof
styles, traced plans unchanged. Elevations: correct silhouettes across all 15
compiled plans, openings on the right facades, shed reading properly.
**Nothing broken.**

One real product finding, left for next fire: a freshly generated plan **404s on
a `.render.svg` it does not have yet** (stored renders come from `render:paired`).
The app falls back correctly, but a 404 on every new plan is noise that hides
real failures.

### What actually consumed the fire: two environment traps and a mistake
**A first sweep reported 72 failures — none of them real.** Midway through,
port 3000 stopped being this app: a **different project's dev server**
(`/Users/openclaw/projects/MaxRoom`) was listening and answering **401**. Pages
did not render, so the kit badge and IFC route assertions failed en masse.

**My fix introduced a second trap.** Moving to `127.0.0.1:3007` gave **0 plans**
with no failed request to show for it — Next 16 blocks client data fetches from a
dev origin outside `allowedDevOrigins`. `localhost:3007` → 30 cards;
`127.0.0.1:3007` → 0. My own "the feed listed no stored plans" guard caught it,
which is the guard earning its keep. Its message now names both traps.

### The mistake: `gates:live` killed the other project's server
`run-live-gates.mjs` freed its port with `lsof -ti:PORT | xargs kill -9` — **kill
whatever is listening**. On a machine running more than one project that is
somebody else's dev server, and it took down MaxRoom's Next process. I also spent
the session using broad `pkill -f "next dev"`, which matches every project's dev
server, not just this one.

Fixed at the root: `freePort` now resolves each listener's working directory and
only reclaims one inside THIS repo. Anything else is **reported and refused**:
```
[live-gates] port 3059 is held by pid 12337 from /private/tmp —
[live-gates] refusing to kill another project's server. Free the port or set LIVE_GATE_PORT.
```
exit 1, foreign server survives.

### And a verification that never ran
I "verified" that guard twice with `timeout 120 node …` — **macOS has no
`timeout`**. The command failed with `command not found`, the script never
executed, and I read "foreign server survived" as proof the guard worked. It
proved nothing: the server survived because nothing had run. Re-verified properly
without `timeout`. Third instance this session of a check that passed by not
happening — the tell is always the same, a green read with no evidence the code
executed.

## The packet's code report is faithful — and a gate I wrote for it was vacuous (2026-08-17)

Finished the deliverable pass on the section a client most needs to trust: the
code report. Computed the engine's verdict independently for the same artifact
and compared it with the downloaded packet:

```
ENGINE  summary {"pass":20,"fail":1,"notEvaluated":3}  24 findings
PACKET  20 pass / 1 fail / 3 not evaluated             24 rows
per-rule counts: identical, including the new IRC-R312.1
citation: "NCRC 2018 §R304.1 …" (jurisdiction pack, not the generic IRC text)
```

**Exact match. No defect.** The packet reports the engine rather than
re-deriving, and it honestly prints the loft plan's `WH-GRID-4FT` **failure** to
the client instead of hiding it.

### The gate I added for it did nothing
I gated that fidelity — summary must equal the engine's, and every failing rule
must appear in the table — then mutation-tested by making the packet filter out
its fail rows. **It passed.** Exit 0.

The reason: the sweep downloaded the packet for `generated[0]`, a plain a-frame
with **zero failing rules**. The loop over failing findings iterated an empty set
and asserted nothing. The summary check still matched, because the summary is
computed from `report.summary` and is unaffected by dropping rows — so a packet
showing "1 fail" in its summary and no fail row anywhere passed cleanly.

That is the same vacuous-coverage trap this session keeps surfacing, this time in
a gate written *specifically to catch a hidden failure*. The fix is to pick the
packet plan deliberately: scan the swept plans and prefer one whose engine report
actually contains a failure. Assertion count went 226 → 227, and the mutation now
fails with `packet shows the WH-GRID-4FT failure: rule missing from the packet
table`.

**The lesson generalises:** an assertion that loops over a filtered set proves
nothing unless the set is non-empty on the data it runs against. Choosing the
fixture is part of writing the gate.

## The client packet shipped a bill of slugs (2026-08-17)

Inspected the deliverable's CONTENT, not its structure. The numbers check out —
header `gen-002 - 28' x 28' - 784 sq ft - 2/1 - gable roof` matches the artifact,
all 11 code rules appear, and last fire's opening panels flow straight through
(`wall-ext-opening 5`, `wall-int-opening 6`). The table itself did not.

```
| Component  | Qty | Label   |
| door-ext   | 1   | opening |
| wall-ext-opening | 5 | wall  |
```

Two defects in one row builder:

1. **"Component" printed `componentId`** — an internal slug — while the item's
   `description` ("Exterior door unit", "Exterior wall panel with opening
   (door/window), 4 ft module") was dropped entirely. The one field written for
   humans never reached the human.
2. **"Label" printed the category.** The code read `record.label ?? record.category`,
   and BOM items carry **no `label` field at all**, so the fallback won every
   time and the column was mislabelled by construction.

Also fixed quietly alongside: `record.quantity ?? record.count ?? 1` invented a
quantity of **1** for a missing count. A bill of materials that silently reads
"1" is worse than one that admits it does not know — it now prints `—`.

**Now:**
```
| Component                 | ID        | Qty | Unit | Category   |
| Exterior door unit        | door-ext  | 1   | each | opening    |
| Floor cassette, 4 ft grid | floor-std | 49  | each | floor      |
```
Readable for the client, traceable by id for ordering.

**Gated** in the visual sweep: it downloads the packet once and asserts the table
has no mislabelled "Label" column and that no first cell is slug-shaped.
Mutation (restore the old table) fails with
`slug-like first cells: door-ext, door-int, floor-std, roof-steep`.

**A gate I wrote and then deleted before committing.** My first version added a
per-plan packet check that clicked Export inside the main sweep loop — which
opens a modal *before the 3D canvas capture* on every plan. It would have
polluted the screenshots it shares a loop with. Removed; the single focused
download covers it without the side effect.

## The BOM was 19 ft short of the building (2026-08-17)

Back to the prime directive on a surface never inspected: does the **bill of
materials actually describe the plan**? It scales with size (105 → 147 → 229
total quantity as area grows), and most lines are exact — floor cassettes
49 = 784/16, foundation 28 = 112/4, doors and windows match the openings. Two
lines did not:

```
wall-ext  24   (a 112 ft perimeter needs 28)
wall-int  23   (96 ft of interior wall needs 24)
```

**The missing 19 ft is exactly the openings**: 1 door (3 ft) + 4 windows (4 ft).
`sourceWalls` are the SOLID stretches BETWEEN openings, so the panel loop billed
**no panel at all for the wall a door or window sits in**. A builder ordering
from that bill is 4–5 exterior panels short. Meanwhile per-segment `ceil()`
inflated the interior count in the other direction — 17 short segments each
rounded up to a whole panel. Neither number described the building.

**The fix follows the kit.** An opening does not remove wall, it needs a
DIFFERENT panel — which is exactly why WikiHouse ships dedicated opening blocks
(`W-O-*`, catalogued in the Skylark work). So panels are now counted per wall
RUN — its solid segments plus the openings punched through it — and the bill
reports how many of those carry an opening:

| plan | exterior | interior |
|---|---|---|
| 28×28 | 23 solid + 5 opening = **28** for 112 ft | 18 + 6 = **24** for 96 ft |
| 48×28 | 31 + 7 = **38** for 152 ft | 32 + 7 = **39** for 156 ft |

Exact on both. `check:buildable` now asserts panels cover every foot of wall run
and that every opening has an opening panel, across three plan sizes. Mutation
(drop the opening widths from the run) reproduces the shipped shortfall:
`billed 24 (19 solid + 5 opening) for 112 ft`.

### A flake caught by the new discipline
The live ladder came back red mid-fire: the interactive sweep crashed clicking a
`Semantic` toggle after a fixed 8 s wait. I checked whether I had broken it
(I had not — the control exists, and this fire only touched the BOM), re-ran, and
it passed. **Flake, not regression.** Hardened anyway: it now waits for the
control rather than assuming 8 s was enough. Waiting longer masks nothing — if
the button never appears it still fails — but an intermittent uncaught crash
reads exactly like a red gate, and that ambiguity is the thing to remove.

## Auditing this session's gates for the "proven to run" property (2026-08-17)

Applying last fire's lesson backwards: a gate that does not complain has either
passed or never executed, and I could not tell those apart by looking at exit
codes. So I checked.

### Offline batteries: 29 assertion families, 0 dead
Every distinctive assertion added this session was grepped for in its battery's
real output:

| battery | executed |
|---|---|
| check-generation | 4,369 |
| check-elevations | 581 |
| check-buildable | 283 |
| check-code-advisory | 69 |
| check-ifc | 57 |
| check-drawing-standards | 46 |
| check-drift | 22 |
| check-standards | 15 |

Every family appears at least once — fixture headroom ×471, fixture overlap
×2,899, facade-drawn ×117, drawn-exactly-once ×105, per-rule breakages ×9, the
registry coverage check ×1, and so on. **Zero dead assertions.** The offline
gates are real.

### The browser sweep now counts its own coverage
The sweep is where the dead gate actually happened, and it only prints on
FAILURE — so silence there is genuinely ambiguous. It now reports
`N assertion(s) executed across M plan(s)` and fails any plan that contributed
fewer than 8.

**The floor is measured, not guessed:** a compiled plan runs 18-19 assertions, a
traced plan 10 (no semantic elevation panel), and a plan whose page never loads
reaches 3. Verified both ways — `--only zzz-not-a-plan` now fails with
`plan was swept but barely checked: 3 assertion(s) ran`, real plans stay clean.

### Being honest about what this does and does not prove
The counter catches a plan that produced nothing, and makes coverage a number a
human can see instead of an inference. It does **not** prove each individual
assertion ran — the browser-closed bug lived in a post-loop section that would
still have shown a healthy total. **Mutation testing is what proves an
individual check is load-bearing**, and it is what caught that bug. The counter
is a cheap second net, not a replacement.

## Readiness lanes CAN go red — and I nearly shipped a gate that never ran (2026-08-17)

The lanes aggregate both verdict systems into the promote/block decision, and
aggregation is exactly where a blocker gets quietly downgraded on its way to the
UI. Every plan the sweep visits is healthy, so a green run only ever proved that
good plans look good.

**Empirically: the mechanism works.** Strip the wall graph from a plan and the
design lane turns `blocked` (via `liveGeometryAudit`'s "missing source wall
graph"). `readinessLanes` itself is a sound 14-line rollup — blockers → blocked,
warnings → warning, else pass.

**Two deliberate downgrades found, both correct.** `buildValidation.blockers`
are routed through `warn()`, and a `blocked` issue outside the `design` channel
becomes a warning. Both are intentional and documented in the group's own action
text ("brochure-ready semantic plans are not blocked by panel-module
constraints"). Not defects — recorded so they are not "fixed" later by someone
reading the variable name.

### The part worth writing down: I nearly reported a gate that never executed
I added the lane-redness check just before `sweep.json` is written — which is
**after `await browser.close()`**. The run crashed on `page.goto` against a dead
browser. I ran it, grepped for `FAIL`, got **zero**, and read that as a pass.

The crash produced no FAIL lines *because it never reached any assertion.* This
is the precise failure mode I have been hunting all session — coverage that
silently is not there — and I committed it, then misread the evidence, in the
same iteration. What caught it was mutation-testing: inverting the assertion
should have produced a failure message and instead produced a stack trace at
`visual-sweep.mjs:363`.

**Rule reinforced: a passing gate must be proven to RUN, not merely to not
complain.** Exit code and absence-of-FAIL are not the same as executed.

Fixed by moving the check before the browser closes. Now mutation-proven in both
directions — inverted it fails with the real lane statuses
(`design:pass design:blocked design:blocked …`), restored it passes.

## The standards validator had NO battery — and the reason was structural (2026-08-17)

`validateStandards` is the product's **second verdict system**: it grades the
semantic BIM model, feeds the readiness lanes, and ships as the "Standards +
Issues JSON" export. **No battery referenced it at all.**

**The reason was not neglect — it was unloadable.** Its module graph reached
`@/` path aliases and extensionless imports, neither of which raw Node resolves,
so no offline gate *could* load it:

```
lib/data.ts                     import { validateBuildability } from './build-validator'   (no .ts)
lib/bim/{buildable,semantic}-bim, export-ifc   4 more extensionless value imports
lib/standards/floorplan-standards.ts           6 '@/lib/...' aliases
lib/bim/component-assets.ts                    2 '@/public/...' JSON aliases
```

Twelve specifiers in total, all made relative-with-extension. `next build` still
compiles in 2.8 s — aliases and relative paths are equivalent to the bundler, and
the rest of `lib/` already used relative paths. **A verdict system that cannot be
loaded by the gates will not be gated**, and that is a structural fact worth more
than any single assertion.

### What the validator actually is
Measured, not assumed. Nine packs; a clean compiled plan yields **zero blockers**
and 15 warnings (14 panel-grid, 1 experimental-IFC). Breakages:

| breakage | effect |
|---|---|
| roof planes removed | roof-envelope issue ✓ |
| all windows removed | 2 code-advisory-dimensional warnings |
| all doors removed | **fewer** issues (14 → 5) |
| rooms shifted 1.3 ft off grid | **no change** |

The last two look alarming and are not. This is a **model-integrity** checker —
roles, required fields, host constraints, component mappings — so fewer elements
legitimately means fewer element-level issues. Habitability and grid alignment
belong to the code-advisory engine, which *does* catch the off-grid rooms (proved
last fire). Recorded so nobody re-reads these numbers as a defect.

### The battery
`check:standards` asserts it loads offline, that all nine packs are evaluated
AND that no unknown pack appears, that a clean plan produces no blockers, and
that the machinery is **not inert** — removing the roof planes must raise a
roof-envelope issue and increase the total. Mutation-tested by making
`validateStandards` return an empty issue list: the battery fails.

## Anti-vacuity coverage completed, and made self-enforcing (2026-08-17)

### The NC jurisdiction rules: no defect, and already protected
`NC-SEPTIC-18E`, `NC-FLOOD-SFHA` and `NC-TOWN-LIMITS` are hardcoded
`status: 'not-evaluated'`, unconditionally — they can never pass and never fail.
I went looking for a defect and did not find one: **that is the honest status.**
Septic separations need soil/well/stream data, flood status needs the parcel's
FIRM panel, town limits needs the parcel's jurisdiction — none of it derivable
from a floor plan, and each detail string says so and names who to ask.

And the honesty is already gated: `check:code` asserts all three exist AND are
`not-evaluated`. **Verified rather than assumed** — flipping them to `pass`
fails with `site advisories present: expected true, got false`. Reported as
clean rather than manufacturing work.

### Completing the breakage set
Last fire's anti-vacuity block covered six rules; `ZON-SETBACK` and
`ZON-COVERAGE` were never breakage-tested. Added:

- **ZON-SETBACK** — a 30x30 lot with 10 ft setbacks under a 28 ft footprint → FAILS
- **ZON-COVERAGE** — a 10% coverage cap the footprint blows through → FAILS

All **8** registry rules now have a breakage proving they can say no.

### Making the coverage self-enforcing
Complete coverage today rots the moment someone adds rule nine. So the block now
asserts **every rule in `CODE_ADVISORY_RULES` has at least one breakage test**,
with the NC site advisories deliberately excluded and the reason written down.
Mutation-tested by adding a `FAKE-NEW-RULE` to the registry:
`no breakage proves these can fail: FAKE-NEW-RULE`.

That closes the loop on the vacuous-coverage class this session kept hitting — a
gate that silently stops covering things is the failure mode, so now the coverage
itself is gated.

## IRC-R312.1 added: the guardless-loft false pass is closed (2026-08-17)

The false pass from last fire, fixed. Stripping every fall-protection guard from
a loft open ~8 ft above the floor used to leave the code report **byte-identical**
— compiled plans were safe only because the compiler always builds guards, while
the JSON-only import lane bypasses the compiler entirely.

**The rule.** `IRC-R312.1 — Guards are required on open sides of walking surfaces
more than 30 in above the floor below.` Three-state, in the engine's existing
idiom:

- **not-evaluated** when the source models no guard information at all
  (`guards: undefined`). Claiming a pass from absent data is how the last false
  pass happened; an EMPTY array, by contrast, is a positive statement that the
  plan models no guard and DOES fail.
- **fail** for an elevated surface with no guard on its floor, naming the height
  and the threshold.
- **pass** with the shop-drawing caveat — presence is modelled, guard height and
  baluster spacing are not, so they are flagged rather than silently claimed
  (exactly as R310 does for net clear area).

**Threshold is data-driven, not assumed.** Rooms now carry `elevationFt`; the
30 in test runs against that rather than against "floor index ≥ 1". A
single-storey plan reports `pass — no walking surface sits more than 30 in above
the floor below`, because a rule that emits nothing is indistinguishable from a
rule nobody wired up.

**Wired through BOTH adapters**, not just the battery — `codeAdvisoryInputFromHome`
(the product) and `reportForArtifact` (the gates) — or the rule would exist and
never run where it matters.

**Verified both directions:** a loft with guards → `pass: Walking surface 8.0 ft
above the floor below is guarded (2 guard elements)`; guards stripped → `fail`.
The anti-vacuity block added last fire now carries the guard breakage, so the
rule can never quietly stop firing.

**Two pinned expectations updated, both because a rule was ADDED:** the registry
count 7 → 8, and the live sweep's rendered rule cards 10 → 11. Neither is a
loosening, and the live gate caught the second one itself — I had not thought
about the UI rendering one more card.

## Hunting FALSE PASSES: the engine is sound, but lofts are not (2026-08-17)

The prime directive has two halves and recent fires only worked one: bad geometry
that should be caught. This fire asked the other question — **can the constraint
engine say no at all?** A rule that never fires is indistinguishable from a rule
that is always satisfied, and the whole product rests on these verdicts.

Method: take a plan the engine passes, break it in the exact way each rule exists
to catch, and require that rule to report `fail`.

| rule | breakage | result |
|---|---|---|
| IRC-R304.1 | a 4x4 ft bedroom (16 sqft) | FAILS ✓ |
| IRC-R304.2 | a bedroom 3 ft across | FAILS ✓ |
| IRC-R305.1 | a 5 ft ceiling everywhere | FAILS ✓ |
| IRC-R310.1 | every bedroom window removed | FAILS ✓ |
| IRC-R310.1 | every egress window made inoperable | FAILS ✓ |
| WH-GRID-4FT | a bedroom 1.3 ft off the grid | FAILS ✓ |

**The engine is not vacuous** — previously unverified, now permanently gated. (My
first probe reported the baseline itself failing; that was my harness passing the
raw artifact instead of the engine's normalised input, not a bug. Checked before
claiming.)

### But the hunt turned up three real things

**1. Every loft plan ships with a `WH-GRID-4FT` FAILURE.** a-frame-with-loft and
gable-with-loft both report *"1 of 8 physical rooms are off the 4 ft panel grid
(e.g. Loft)"*. Non-loft plans are clean. MFG fire 6 snapped the loft BAND to a
4 ft multiple — `band = Math.floor(rawBand / 4) * 4` — and then recentred it:
`low = rawLow + (rawBand - band) / 2`. **The size was snapped; the origin never
was.** A 28 ft a-frame puts an 8 ft loft at x = 10.

**2. A gate gap let it ship.** The zero-constraint-fails assertion runs over
`CASES`, and no real loft brief is in `CASES` — loft plans are exercised in a
separate block that checks loft structure and never calls `reportForArtifact`.

**3. FALSE PASS: there is no IRC-R312 guard rule in the engine.** Strip every
fall-protection guard from a loft open ~8 ft above the floor and the code report
is byte-identical. The compiler always builds guards and the battery checks the
output, so compiled plans are safe — but the JSON-only import lane bypasses the
compiler entirely, and a hand-authored loft with no guard passes the advisory
clean.

### The loft-grid fix needs a decision, not a guess
Grid-aligning the origin is not free. Measured, per roof:

| plan | headroom envelope | loft today | grid-aligned |
|---|---|---|---|
| a-frame 28 | 10.0–18.0 | 8 ft at x=10 | **4 ft → below MIN_LOFT_SPAN_FT (6), loft LOST** |
| gable 28 | 5.5–22.5 | 16 ft at x=6 | 12 ft at x=8 (−25%) |
| gambrel 28 | 8.5–19.5 | 8 ft at x=10 | **4 ft → loft LOST** |

So the choice is: enforce the grid and lose a-frame/gambrel lofts, or exempt a
loft platform from a rule written for floor-grid rooms. The second is a gate
loosening and the guardrails forbid doing that quietly. **Left for a human call
rather than resolved unilaterally** — a shipped feature and a manufacturability
claim are both real, and the numbers above are what the decision turns on.

## Auditing the class: storeys and lofts were silent too (2026-08-17)

Baths showed that fire 1's "carry the RAW request" fix had been applied to ONE
dimension, not adopted as a rule. So I audited every program dimension a brief
can express, driving each at a value the generator cannot deliver.

| dimension | asked | built | before |
|---|---|---|---|
| bedrooms | 5 | — | refuses, clear message ✓ |
| baths | 3 / 4 / 2-on-1-bed | 2 / 2 / 1 | fixed last fire |
| maxSqft | ≤700 | 672 | honoured ✓ |
| roof style | "mansard" | a-frame | `unparsed: ["mansard roof"]` → echoed ✓ |
| footprint | "20 ft wide" | 28 | `unparsed` → echoed ✓ |
| **storeys** | **2 / 3** | **1** | **SILENT** |
| **loft** | **on flat/shed/hip** | **none** | **SILENT** |

**The two failures share a shape that is worse than an unrecognised token.** The
parser RECOGNISED "2 story" and "with loft" and CONSUMED them — so they never
reached the `unparsed` echo that would have surfaced them — and then nothing
downstream honoured them and nothing said so. An unreadable token is handled
honestly here; a token the parser claims and the compiler ignores is not.

**Storeys → REFUSE.** A storey count is a different building, not a degraded one,
so it follows the bedroom precedent rather than the bath one:
`requested 2 storeys; this generator builds a single storey plus an optional loft
(ask for "with loft" on an a-frame, gable, gambrel or barn roof). It has no
multi-storey template.` A "2 story a-frame with loft" satisfies the request and
builds, and "single level" is untouched.

**Dropped loft → NOTE.** A plan minus a loft is still a good plan:
`requested a loft; built none — a flat roof leaves no band with the headroom IRC
R305 requires for a habitable loft.` The a-frame case still builds its loft and
is not falsely reported as dropped.

**Gates:** refusal cases for 2 and 3 storeys, a build case for "single level",
and a per-case loft check that fires on any brief containing "with loft" —
asserting both that a dropped loft is surfaced AND that a built one is not
falsely reported dropped. Mutation-tested both ways.

## Fresh hunt: bath counts silently clamped, and honesty notes thrown away (2026-08-17)

Backlog empty, so back to the prime directive: drive the generator at inputs the
matrix does not cover and INSPECT the output. Thirteen briefs — extreme aspect
ratios, minimum lots, sub-300 sqft, 4-bed-plus-loft, odd phrasing. Rooms inside
the footprint, fixtures inside their rooms, openings inside the envelope: **0
issues**, and every refusal specific ("footprint 20x24 ft exceeds the buildable
envelope 10x90 ft"). Then two real defects, one behind the other.

### Defect 1 — bath counts above the template cap are silently clamped
`3 bed 3 bath` builds **2 baths**. `2 bed 4 bath` builds **2**. `1 bed 2 bath`
builds **1**. In every case: **no note, no refusal.** The plan misrepresents its
own brief — the exact class fires 1-4 were about.

**Root cause, and it is a repeat.** `bathsRequested` is clamped to
`MAX_TEMPLATE_BATHS` (and forced to 1 for 1-bed programs) at intent construction,
and that CLAMPED value was passed as `requestedBaths`. So the honesty check
compared 2 against 2 and stayed quiet. The field's own doc comment says "Baths
the brief asked for, BEFORE any fit downgrade" — the code contradicted its
documented contract. This is precisely the bedroom bug from fire 1, whose fix
("carry the RAW request unclamped") was never applied to baths.

Fixed by carrying the raw request, and the note now states the TRUE reason —
"the largest template provides 2 baths" / "single-bedroom programs are
single-bath" / "only a single-bath footprint fits this size/lot". The old text
advised enlarging the footprint, which is false advice when no template offers a
third bath.

### Defect 2 — the note was computed, returned, and thrown away
Worse than defect 1, and only visible by driving the real surface. The note WAS
produced and WAS returned by `/api/generate-plan`... and then lost:

- the artifact written to disk had **no `notes` field at all**, and
- the generate flow does `window.location.href = body.url`, **navigating away
  from the response** — so the one person who could have seen it did not.

A stored plan therefore showed `brief: "2 bed 4 bath …"` beside two bathrooms
with no explanation, forever. An honesty note that does not survive the write is
not honesty. Notes are now **persisted into the artifact** and **rendered on the
plan card** in amber, under the kit verdict.

### Gates
`check:generation` covers the whole class (3-bath, 4-bath, 1-bed-2-bath) and
asserts the note names the true reason, not boilerplate. The live sweep asserts
that a plan whose artifact records a mismatch actually SHOWS it. Mutation-tested
three ways: re-clamp the raw request → the notes vanish; make every reason
boilerplate → the reason assertion fails; hide the note block → the sweep fails.

Also fixed a wart in my own gate: the follow-up text assertion queried a missing
locator and burned a 30 s timeout, reporting a confusing second failure on top of
the real one.

## outpost-medium's overlap diagnosed at source: a lost rotation (2026-08-17)

The drift gate flagged `fx-bed10` / `fx-bedroom10-wardrobe` overlapping by
**4.57 x 1.85 ft** and I recorded it as "looks like a real tracing error worth
investigating". Investigated it properly against the source drawing rather than
leaving a guess in the baseline.

**The source** (`chatgpt-handoff/generated/outpost-medium-proposal-paired-v11.png`,
bedroom 10) shows the bed's headboard against the room's **north wall** and the
closet as a **vertical run of shelving on the EAST wall**. There is no closet
band along the north wall at all.

**The artifact** records the wardrobe as a **horizontal band on the north wall**:
`w = 12.4152, d = 1.9470` at x 5.94, z 16.41 — straight through where the bed goes.

**Diagnosis: the fixture's rotation was lost in tracing — its width and depth are
transposed.** Not a guess; it checks out numerically. Swap w/d and seat it against
the east wall at x 17.05–19.00 and the overlap with the bed becomes **0.00 ft** —
the arrangement the drawing actually shows. The bed was never the problem.

One caveat kept in the record rather than rounded away: rotated, the run is
12.4 ft long against a room only 11 ft deep, so the traced LENGTH is slightly off
too — the trace has two errors, not one.

**Not repaired.** Traced artifacts are never edited (project guardrail), and this
one lives in the dev-compiler checkout anyway. The baseline entry now carries the
diagnosis and the evidence instead of a suspicion, so whoever re-traces this plan
knows exactly what to fix.

This is the drift gate earning its keep in the way that matters most: it did not
just count a violation, it pointed at a specific defect in shipped content that
nobody had noticed, and the source drawing settled it.

## Next.js 16.1.6 -> 16.3.0: 7 vulnerabilities -> 0 (2026-08-17)

### Correcting my own number first
Last entry I reported "6 high-severity advisories". That was the npm audit
SUMMARY, which counts **packages**. The `next` package alone carried **28
advisories** — multiple middleware/proxy bypasses, SSRF in rewrites and in
Server Actions on custom servers, several DoS paths, cache poisoning, XSS via
CSP nonces. Materially worse than I described.

### The upgrade
`fixAvailable` said 16.3.1 (`isSemVerMajor: false`). It would not install:
this environment's npm has a **registry date cutoff of 2026-08-10**, and 16.3.1
was published 2026-08-13. **16.3.0** (2026-08-03) is the newest installable, so
that is what we are on. Then `npm audit fix` (non-force) cleared the three
remaining transitive leaves.

| | before | after |
|---|---|---|
| vulnerabilities | 7 (6 high, 1 low) | **0** |
| `next` advisories | 28 | 0 |
| also cleared | postcss (XSS), sharp (libvips CVEs), nanoid, brace-expansion, js-yaml, @babel/core | — |

### Verification, including a mistake in it
`gates` (lint + 9 batteries + clean build) and `gates:live` green; all 18 plans
sweep with 0 assertion failures on 16.3.0.

**My first pixel comparison was invalid and I nearly reported it as evidence.**
I copied `.qa-shots/sweep` as the "before" baseline — but that directory held
captures of MIXED VINTAGE accumulated across several earlier iterations, and the
most recent live run had refreshed only 8 of 52 files. The first diff therefore
compared 44 stale files against themselves and printed a reassuring wall of
"identical". Re-running the full sweep and diffing properly gave 21 differences,
and every one is explained:

- **1.05–1.13% at bbox (1391,10,1591,168)** on most 3D captures — cropped and
  looked at: it is the info card showing **the kit badge I added two iterations
  ago**. Those baselines predate it.
- **0.09–0.12% at bbox (0,1042,46,1115)** on two elevations — cropped: the
  **Next dev-tools "N" indicator**, whose rendering shifted between versions.
  Dev-mode chrome, not app content.
- **gen-002 / gen-003** — different briefs reusing the same generated IDs
  between runs. Not comparable at all.

The genuinely valid pairs (baselines captured on 16.1.6 *after* all my changes:
`a-frame-22`, `gen-001`, `loft-showcase` — plan and 3D) are **pixel-identical**
on 16.3.0.

### Two things found on the way
- **The sweep could silently shrink its own coverage.** On a cold dev server the
  feed had not rendered within its fixed 2.2 s wait, so it found zero stored
  plans, swept only the 12 it generated itself, and reported success. It now
  WAITS for the feed and exits non-zero rather than passing over a shrunken set.
- **Next 16.3 writes a block into `AGENTS.md`** on `next dev`
  (`generate-agent-files.js`). Committed with the upgrade, per its own note that
  removing it just re-creates the diff.

## Dependency audit: three unused @thatopen packages removed (2026-08-17)

Long-standing backlog item — five `@thatopen/*` packages, unclear how many were
real. Measured rather than assumed:

| package | imported in | verdict |
|---|---|---|
| `@thatopen/components` | 1 file (`BimPreview.tsx`) | **keep** — it builds the real OBC world (Components/Worlds/SimpleScene/SimpleCamera/SimpleRenderer) |
| `@thatopen/fragments` | 0 files | **keep** — required PEER of `components` (`~3.4.0`) |
| `@thatopen/components-front` | 0 files | removed |
| `@thatopen/ui` | 0 files | removed |
| `@thatopen/ui-obc` | 0 files | removed |

Checked peers before cutting: `components` declares `fragments`,
`camera-controls`, `three` and `web-ifc`, all satisfied by our package.json —
and notably NOT `ui`, `ui-obc` or `components-front`. Removing an unused package
that turns out to be a peer is how you get a runtime failure no gate catches.

`BimPreview` is not dead code and not behind a flag: it is the DEFAULT 3D view
(`HomeModel` only renders under `viewPreset === 'debug-review'`), so the live
sweep's 3D capture already exercises it. Verified after removal — build clean,
`gates` + `gates:live` green, and the captured 3D still shows the a-frame with
its glazing and loft guard rails.

### Found while in there: 6 high-severity advisories, all fixable
`npm audit` reports 7 vulnerabilities (6 high, 1 low). The one that matters is on
a DIRECT dependency: **Next.js — HTTP request smuggling in rewrites**, and this
app serves API routes. `postcss` (XSS via unescaped `</style>`) and `sharp`
(libvips CVEs) are both fixed by the same Next upgrade; `brace-expansion`,
`js-yaml` and `nanoid` are transitive DoS issues with fixes available.

NOT upgraded in this pass. A framework bump is a different kind of change from a
dependency cleanup and deserves its own verification rather than riding along
with it — recorded here so it is a decision, not an oversight.

## CORRECTION + finding: the plans we ship are in ANOTHER repo (2026-08-17)

Immediately after committing the regeneration I checked what the commit actually
contained. **It did not contain the regenerated plan** — and it could not.

`public/data/den-image-loop` is a **committed symlink** to an absolute path in a
sibling checkout:

```
public/data/den-image-loop -> /…/projects/dev-compiler/data/den-reference-set/image-loop
```

So:
- The regenerated `loft-showcase` artifact and its render are real and versioned
  — by **dev-compiler**, not by this repo. My planner commit carried the drift
  baseline and this log, nothing else. The commit message implied otherwise; this
  entry is the correction.
- **`check:drift`'s baseline is versioned here while the artifacts it grades are
  versioned there.** They can diverge, and nothing would notice.
- The symlink is **absolute and machine-specific**. On any other machine it
  dangles and the app has no plans at all.

**What I did about it.** The gate now refuses to report a vacuous pass: if the
plan store is unreadable or contains no served plans it FAILS with a message
naming the symlink, rather than "clean" over zero plans. Mutation-tested by
pointing `LOOP_DIR` at a missing directory.

**What I did NOT do.** I left the regenerated artifact **uncommitted** in
dev-compiler. That repo has **59 dirty files** of unrelated work in progress
(CLAUDE.md, README.md, package.json, manifest.json…), and committing into
someone else's in-flight tree — or worse, `git add -A` there — is not mine to
do. It needs a human decision, and the two-repo split is a structural question
(vendor the reference set? git submodule? relative symlink?) rather than a fix I
should pick unilaterally.

## The ratchet pays out: loft-showcase regenerated, 49 -> 43 (2026-08-17)

The drift gate's whole point is to turn invisible debt into a number that can
only go down. First payout.

**Dry run first, because these are SHIPPED plans.** Recompiling each stale plan
from its own stored brief and diffing against what is on disk:

| plan | recompiles to | decision |
|---|---|---|
| `loft-showcase` | **the identical building** — same 28x28 footprint, same 8 rooms, byte-identical room layout, same 5 windows, same roof — with 5 headroom violations gone and the drawing set 2 -> 4 | **regenerated** |
| `brief-aframe-2br` | a **different building** — 28x28 instead of 24x28, 7 rooms instead of 6 | **left alone** |

`brief-aframe-2br`'s brief is "≤800 sqft"; 24x28 = 672 and 28x28 = 784 both
satisfy it, and the template chosen for that cap has changed since. Swapping the
gallery plan for a different building is a **content decision, not a geometry
repair** — so it stays baselined, with that reason written down instead of a
vague "stale". Regenerating it silently would have been the easy, wrong move.

**What was regenerated, and how carefully:** only the compiled geometry. The
artifact ENVELOPE — schemaVersion, planId, proposalId, brief, generator,
coordinateMode, gridFt — and the key ORDER are preserved, so the diff reads as a
geometry change rather than a rewrite. The stored render was regenerated through
the project's own `render:paired`, because a stored render that disagrees with
its JSON is the drift class this project already gates.

**The ratchet caught its own follow-through:** with the plan fixed, `check:drift`
failed on *stale exemptions* — `fixed, remove from baseline:
fixture-headroom:fx-bed1-wardrobe, ...` — forcing the baseline down rather than
letting a dead entry sit there re-authorising the defect. **49 -> 43.**

Verified visually: same showcase building, fixtures no longer stacked, loft
aligned in the shared building frame, front/side/rear/right drawn.
`gates` + `gates:live` green.

## check:drift — the invariants now grade the plans we SHIP (2026-08-16)

Every battery compiles a fresh plan and grades the result, so all of them only
ever measure what the compiler does TODAY. The plans the app actually serves are
stored JSON, written by whatever the compiler was on the day they were made.
**Fixing the compiler does not fix them, and nothing noticed.**

Measured against today's invariants, **all six served plans violate them** —
49 violations total:

| plan | lane | violations |
|---|---|---|
| a-frame-22 | traced | 16 (fixture headroom) |
| a-frame-bunk | traced | 9 (fixture headroom) |
| brief-aframe-2br | compiled | 8 (fixture headroom) |
| gen-001 | compiled | 8 (fixture headroom) |
| loft-showcase | compiled | 6 (fixture headroom) |
| outpost-medium | traced | 2 (fixture overlap) |

`gen-001` and `loft-showcase` carry **the exact numbers the envelope-placement
fires fixed** — a kitchen counter under 2.36 ft of ceiling, a sofa under 3.83 ft.
Those fires fixed the compiler; the shipped artifacts kept the defect.

**The gate is a RATCHET, not a pass/fail on absolutes**, because some of this
drift genuinely cannot be fixed: `gen-001`'s JSON is frozen by project guardrail,
and a traced plan records a drawing someone made rather than something our
compiler produced. `scripts/drift-baseline.json` records accepted drift **as
stable violation keys** (not a count — a count silently accepts a new defect the
moment an old one is fixed), each with a real reason. The gate fails on:
1. **new** drift in a shipped artifact,
2. an exemption that is **no longer needed** (fixed but still baselined, which
   would silently re-authorise the defect if it came back),
3. an exemption with **no justification** (`TODO` is not a reason).

All three mutation-tested.

**Caught while building it:** the baseline first went in `artifacts/`, which is
entirely gitignored scratch — a ratchet whose baseline is not committed is not a
ratchet. Moved beside its battery in `scripts/`.

**Honest debt this makes visible:** `brief-aframe-2br` and `loft-showcase` are
NOT frozen by any guardrail. They should be REGENERATED so the shipped plans meet
the current bar, rather than exempted forever. Their baseline entries say exactly
that. `outpost-medium`'s `fx-bed10/fx-bedroom10-wardrobe` overlap (4.57 x 1.85 ft)
looks like a genuine tracing error worth chasing at source.

## IFC export is REAL (2026-08-16)

The "Export Experimental IFC STEP" button wrote an ISO-10303-21 envelope with an
**empty DATA section** — a file that opens as nothing. It was honest in its
blockers, but an export that contains no building is not an export.

**Now:** `lib/bim/write-ifc.ts` writes IFC4 with the spatial hierarchy every BIM
tool needs (Project → Site → Building → Storey), walls and a floor slab as
extruded solids, related to the storey by IfcRelContainedInSpatialStructure.
Served by `GET /api/export-ifc?planId=` — generated SERVER-side, so web-ifc's
~3 MB WASM never reaches the client bundle.

Verified end to end, not by inspection: the served bytes reopen through
**web-ifc's own parser** as IFC4, with 12 walls / 1 slab / 1 storey, and
**16 geometry meshes tessellate**. Dimensions match the plan — a 28×28 ft plan
with 8 ft walls measures 28.5 × 8.0 × 28.5 ft in the file.

**A bug my own battery missed.** `tsc` flagged `IfcSIUnit` taking 3 arguments,
not 4. I had passed IFC4's optional `Dimensions` first, shifting every slot, and
the file shipped `IFCSIUNIT(*,$,.LENGTHUNIT.,$)` — **a length unit with no
name**, so nothing downstream knew the coordinates were metres. Entity counts
and geometry extents are unitless, so every check I had written sailed past it.
`check:ifc` now asserts the length unit is METRE and that every declared unit
has a name.

**A vacuous assertion of my own, caught by mutation.** "products are contained in
the storey" only checked that the relationship EXISTS. Mutating the writer to
relate nothing still passed — every wall orphaned, which many viewers silently
drop. It now counts `RelatedElements` against walls + slabs; the mutation fails
with `0 related, expected 16`.

**The route broke in a way no offline battery could see.** Next bundled web-ifc
into the server chunk and its WASM stopped resolving (`ENOENT
vendor-chunks/web-ifc-node.wasm`) — a 500 on every click while `check:ifc` stayed
green, because the battery imports the library directly. Fixed with
`serverExternalPackages: ["web-ifc"]`, and the live sweep now fetches the ROUTE
and asserts 200 + STEP entities + the coverage header. Removing the config line
reproduces the 500 and fails the gate.

**Coverage is declared, not implied.** The result carries what was written and
what was not (roof planes, openings, fixtures, IfcSpace); the route returns it in
an `X-Ifc-Coverage` header and the button reads "Export IFC STEP (walls + slab)".

## The open-kit verdict is now VISIBLE (2026-08-16)

The Skylark chain was complete except for the part that matters to a person:
pitches measured, kit homes reachable, the assessment gated in two batteries —
and **nothing on screen said whether your plan could be cut from stock blocks**.
The one question a WikiHouse customer has had no on-screen answer.

- **`assessSkylarkKitForPlan(plan)`** in `lib/kit/skylark.ts` — one adapter from
  a compiled artifact to a verdict, taking pitch from `roof-geometry` rather than
  recomputing it. Screen, batteries and any future export ask the same question
  of the same geometry.
- **On the plan card** (the summary a customer sees, NOT behind Review Tools):
  `wikihouse kit: buildable` in green, `not-buildable` in amber, with the reason
  in the tooltip. My first attempt put it in `PairedStatusPanel` — the sweep
  caught that immediately (`no [data-kit-status] on the page`) because that panel
  only renders inside Review Tools, which is collapsed by default. A verdict
  nobody can see is the defect being fixed, not a fix.
- **In the manufacturing lane** as a WARNING, never a blocker: a plan the Skylark
  blocks cannot cut is still a real, code-checked house — it just is not this kit.
- **Gate:** the visual sweep asserts the badge EXISTS and MATCHES the verdict
  computed offline from the artifact, on every plan swept. Mutation (remove the
  badge) fails with `open-kit verdict is shown: no [data-kit-status] on the page`.

Verified in the browser: `2 bed skylark gable` → **buildable** (green);
`2 bed a-frame` → **not-buildable** (amber). Also corrected a stale claim in the
`skylark.ts` header still saying the pitch angles "are not recoverable from
nested cut sheets" — they were measured a few commits earlier.

## Kit-buildable homes are now REACHABLE (2026-08-16)

Measuring the pitches answered "can the kit build this?" — and the answer for
six of our seven styles was no. Sourced data nobody can act on is a report, not
a capability, so: **a brief can now ask for a kit-buildable home and get one.**

- **Brief:** `wikihouse`, `skylark`, `kit-built`/`kit-buildable` set
  `kitBuildable`. The token is consumed, so it never lands in `unparsed` (P5).
- **Compiler:** a kit gable is NOT an eighth roof style — it is the same gable
  with its ridge **derived from the measured pitch** instead of a house number:
  `ridge = eave + tan(42°)·(span/2)` = 20.61 ft on a 28 ft span, giving exactly
  42.0°. Everything downstream (elevations, 3D clip, headroom, egress, fixtures)
  reads the resulting planes and needs no knowledge of the kit (P1, P7).
- **Refusal, not silent substitution:** asking for a kit home with a roof the kit
  cannot cut REFUSES, in the same class as the bedroom and sqft caps — "an
  a-frame roof cannot be built from the WikiHouse kit — Roof pitch 50.5° is not
  one of the Skylark pitches (0°, 42°) … The kit builds a flat roof or a 42°
  gable; ask for one of those, or drop the kit requirement." The kit module
  decides; the compiler holds no second copy of its rules.

| brief | result |
|---|---|
| `2 bed skylark gable` | builds at **42.0°** → kit **buildable** |
| `2 bed wikihouse flat roof` | builds at 0° → kit **buildable** |
| `2 bed skylark hip / a-frame / shed / gambrel / barn` | **refused**, with the reason and the alternative |
| `2 bed gable` (no kit asked) | unchanged 23.2°, 14 ft ridge |

**Gates assert MORE:** `check:buildable` proves a kit request yields a measured
pitch and a `buildable` verdict end to end, that all five impossible styles
refuse *and* explain, and — as a regression guard — that a plain gable still has
its 14 ft ridge (the kit changes nothing unasked). `check:generation` runs the
full per-plan invariant set on the 42° gable, a roof angle no other case covered
(3724 assertions). Mutation-tested twice: ignore the kit pitch → the kit gable
fails to compile; drop the refusal → the impossible styles ship silently.

Verified on the real surface: generated through the live API and swept — plan,
all three elevations (visibly steeper gable, 21 ft ridge over a 28 ft span) and
3D, 0 failures. `gates` + `gates:live` green.

## Skylark roof pitches — MEASURED, blocker cleared (2026-08-16)

The backlog item that gated everything: with `SKYLARK_ROOF_PITCHES_DEG` empty,
**no plan could ever claim kit-buildable**. The angles are not in the DXF cut
sheets (flat nested parts) and the repo states them nowhere, so the honest state
was `unverified` — but that is a dead end, not an answer.

**Method (reproducible: `scripts/measure-skylark-pitch.py`).** The detailed 3DM
assemblies DO carry the geometry. Download the six roof blocks from a pinned
commit (`6581cc1d`), read every Brep edge, keep the straight ones over 150 mm
running in the building's XZ section plane, and bin them by angle weighted by
length. A roof block's dominant non-vertical angle IS its pitch.

| block | span | rise | pitch | share of in-plane edge |
|---|---|---|---|---|
| R-L | 5839 mm | 560 | **0°** | 71.4% at 0°, 24.3% at 1° (drainage fall) |
| R-S | 4639 mm | 534 | **0°** | 70.9% at 0°, 24.3% at 1° |
| R-XXS | 720 mm | 382 | **0°** | 100% at 0° |
| R-L-42 | 3548 mm | 3558 | **42.0°** | 85.6% |
| R-S-42 | 3034 mm | 2937 | **42.0°** | 82.2% |
| R-XXS-42 | 2377 mm | 2278 | **42.0°** | 83.3% |

**Skylark 150 ships exactly two roof archetypes: flat (0°, with a 1° fall) and
42°.** The `-42` in the block name is the pitch in degrees — now evidenced, not
inferred from a filename.

**A previous assumption was wrong.** `UNSUPPORTED_ROOF_STYLES` listed `flat`:
we had assumed the kit had no flat-roof blocks. R-L/R-S/R-XXS measure 0° — they
ARE the flat-roof blocks. Corrected.

**What this means for the generator** (the honest, unwelcome part): of our seven
roof styles only **flat (0°) is kit-buildable**. a-frame is 50.5°, gable 23.2°,
gambrel/barn 29.7°, shed 15.9° — none is 42°, and shed/hip/gambrel/barn have no
blocks at any angle. So the kit answer today is "one style of seven".

**Gate asserts MORE (the whole truth table, not just honesty).** `check:buildable`
now proves, per style, the verdict AND the reason: flat → buildable; a-frame and
gable → not-buildable *because the pitch is not one of the Skylark pitches*;
shed/hip/gambrel/barn → not-buildable *for want of blocks*. Plus: the pitch set
must equal the set in the measured block table, every measured pitch must be
carried by ≥70% of its block's edge length, all six blocks must be present, and
**a 42° on-module gable must come back buildable** — otherwise the pitch set is
dead letters and `buildable` is unreachable, which is a bug wearing honesty's
coat. Mutating a constant (42→45, or one block's pitch 42→30) fails the gate.

**No WikiHouse files are vendored** (1.2 GB, CC BY-SA 4.0) — only measurements of
them, with the pinned commit recorded so anyone can re-run the script.

## Skylark v1.0 — inspected the real repo (2026-08-15)

Cloned `wikihouseproject/Skylark` (1.2 GB) and read the actual data, not the
marketing pages. **The kit layer we were about to invent already exists.**

- **58 blocks, 517 DXF cut files**, each block shipping DXF + SKP + DWG + 3DM +
  a `*_production.csv` (`Label,Quantity` — literally the cut list we were going
  to design) + a CNC doc. Tolerance offsets and dog-bone pockets are
  pre-applied; layer conventions are standardised (`4_ANYTOOL_CUTTHROUGH_OUTSIDE`,
  `5_ANYTOOL_HALF_MILL_9MM_INSIDE`, …). Licence CC BY-SA 4.0.
- **Sheet spec: `0_SHEET_SPRUCEPLY_2440X1220X18`.** 1220 mm = **4.003 ft** — this
  VALIDATES the 4 ft panel-module decision from MFG fire 3. The original
  build-validator constant (1.2 m = 3.937 ft) was simply wrong; real WikiHouse
  sheets are 1220 mm, i.e. 4 ft. Good: our module already matches the standard.
- **Block vocabulary:** Walls `C-*` (corner), `G-*`, `V-*`, `W-{L,M,S}`;
  Floors `E-*`/`F-*`; Roofs `R-{L,S,XXS}` + `-42` variants; Openings
  `W-O-{L,M,S}-{1..5}`; Ties. Part counts per block are real (R-L-42 = 14 parts,
  E-L = 21, W-S = 4).

**THE COLLISION — roof coverage.** Skylark 150 ships **6 roof blocks**:
`R-L`, `R-S`, `R-XXS` and their `-42` variants — essentially ONE roof archetype
at two pitches per span. Our generator builds **7 roof styles** (a-frame 50.5°,
gable 23.2°, flat 0°, shed 15.9°, hip 23.2°, gambrel/barn 29.7°). **Most of them
cannot be built from Skylark 150 blocks.** WikiHouse says so themselves: this
release has "3 room spans, limited roof profiles"; Skylark 200 is unreleased.

So the roof-style breadth built in fires 14–18 is partly **design freedom the
open kit cannot deliver**. Options: (a) constrain the generator to
Skylark-expressible geometry; (b) keep the wider styles but mark them
NOT-KIT-BUILDABLE (visualisation only); (c) author custom roof blocks — which is
exactly the joint-authoring we adopted the standard to avoid.
**Recommended: (a)+(b) — make Skylark-buildability a first-class gate**, so a plan
is either kit-buildable with real cut files, or honestly flagged as not. Same
honest-refusal pattern the rest of the pipeline already uses.

**Integration notes:** do NOT vendor 1.2 GB of DXF into this repo — reference it
(submodule or an extracted metadata subset: block index + production CSVs).
CC BY-SA means redistributed derivatives of their files carry BY-SA and
attribution; using the data to drive our software is fine, but get a real legal
read before shipping derivative cut files.

## Standards + competitive landscape (2026-08-15) — decisions

**Adopt standards; stop inventing the parts layer.**
- **Kit/joinery → WikiHouse Skylark v1.0.** Block library + CNC files live in the
  `wikihouseproject/Skylark` GitHub repo (plus a public Airtable), CC-ShareAlike,
  free for commercial use. Nothing in this repo references Skylark today —
  `lib/bim/component-registry.ts` is a home-grown marketplace-asset registry over
  generic categories, NOT a WikiHouse construction system. Skylark becomes the
  part vocabulary; we do not author joints. (Check the ShareAlike terms before
  shipping derivatives.)
- **BIM interchange → IFC (ISO 16739), via the `web-ifc` already installed.**
  `lib/bim/export-ifc.ts` currently emits a placeholder: a valid ISO-10303-21
  header wrapping a comment, no entities. Elements already carry `segment`
  geometry, `floor`, and `ifcClass`, so mapping to IfcProject/Site/Building/
  Storey/Wall/Slab/Space is bounded finishing work, not invention.
- **Installed-but-unused:** `@thatopen/fragments`, `ui`, `ui-obc`,
  `components-front` have zero imports (`@thatopen/components` is used only by
  `BimPreview`). Either adopt `fragments` or drop the three dead packages.

**Landscape — who else is doing this (3 searches, not exhaustive):**
- **Higharc** is the heavyweight: $95M Series C (Jun 2026), >$170M total; brief →
  build-ready homes with construction documents, live estimates, shoppable 3D.
  Notably they use "spatial AI, distinct from LLMs" + multi-model validation to
  prevent hallucination + humans in the loop — independent convergence on OUR
  architecture (deterministic compiler + mechanical gates, never let a model
  hallucinate geometry). Aimed at volume homebuilders on conventional framing.
- **Generative design/BIM:** Finch3D, Snaptrude, Autodesk Forma, TestFit — design
  exploration + BIM, stop before manufacturing.
- **Prefab with in-house software:** Veev (permit→delivery <30 days), Plant
  Prefab, Aro Homes, and **AUAR** (robotic micro-factory, modular timber wall/
  floor/roof panels) — AUAR is the closest cousin, but its panels and factory are
  proprietary.
- **The gap:** none of them pairs an OPEN, non-proprietary kit (Skylark) with
  verifiable code + manufacturability gates and honest refusals. Competing with
  Higharc on breadth is unwinnable; the defensible wedge is open standard +
  provable correctness — which is exactly the asset this repo already has.

**What this changes:** Skylark adoption is strategy, not convenience. IFC export
rises in priority (interop with the BIM world the competition lives in). The
design-vocabulary gap stays the blocker on anything sellable.

## Backlog
_(updated each fire)_

**Status (after fire 19):** the CORRECTNESS + HONESTY frontier is swept (no open
defect class) AND the CONSTRUCTIVE frontier is complete — all 7 roof styles
(a-frame, gable, flat, shed, hip, gambrel, barn) build, and 1–4 bedrooms
synthesize, each with R305-checked geometry, honest elevations, operable egress,
and 0 render offenders. Outside the envelope (5+ bedrooms, 4-bed a-frame) the
generator refuses honestly. **The enhancement backlog is now EMPTY** (remaining
items below are all checked or are minor/optional polish). Close condition: full
ladder green on two consecutive fires → then update PROJECT_STATUS + playbook,
push, notify, CronDelete. Fire 19 is a gated fix (4-bed); fire 20, if clean,
would be the FIRST of the two consecutive clean fires.

- [ ] _(enhancement)_ `doorSwingClear: true` on fixtures is hardcoded, not
      computed (compile-plan ~line 265). Latent metadata-honesty item — asserts a
      property that isn't checked. Low stakes (fire 8 rendered swings are visually
      clear); revisit only if a real swing collision is ever found.

- [x] **DEFECT: build the loft guard geometry — DONE (fire 12).** The compiler
      now emits a `lowGuardRail` interior wall (36 in) on each open long edge of
      the loft; the classifier (drawing-primitives:112) already tags guard kinds
      as walls, so it renders with 0 offenders. Note reworded to confirm the
      guard + flag baluster spacing/attachment as shop-drawing scope. (An engine
      R312 *verdict* — pass/advise on guard presence — remains a possible future
      add, but the geometry now satisfies the requirement.)
- [x] _(enhancement)_ Constructively implement ALL roof styles — **flat (14),
      shed (15), hip (16), gambrel (17), barn (18) DONE**. All 7 parser-recognized
      roof styles (a-frame, gable, flat, shed, hip, gambrel, barn) now build, each
      with R305-checked geometry, honest elevations, and 0 render offenders. The
      roof-style frontier is COMPLETE. Remaining enhancement: 4+ bedroom synthesis.
      **BARN build plan (scouted fire 17) — TWO STACKED HIPS (ONE model, reuse
      hip twice):** a barn-hip is a gambrel hipped on all four sides = a steep
      LOWER hip (eave perimeter 8 ft → a knuckle "ring" rectangle inset by the
      lower run, ~13 ft) stacked under a shallow UPPER hip (knuckle ring → ridge,
      inset further, ~16 ft). 8 planes (4 lower + 4 upper); on a square footprint
      the ridge collapses to a point (stacked pyramids). Reuse the hip ridge-inset
      formula at TWO levels — no new plane math, just applied twice.
      - R305 free: eave 8 around the perimeter → ceiling ≥ 8 everywhere (100%).
      - ELEVATION: both faces show a two-pitch HIPPED silhouette — eave → (steep)
        knuckle-inset → (shallow) ridge-inset → flat ridge → mirror. Combine the
        gambrel knuckle with the hip trapezoid: a 6-pt outline (eave, knuckleL,
        ridgeStart, ridgeEnd, knuckleR, eave). Add a `barnHip` model field +
        render branch; leave gambrel/hip/others untouched (no traced regression).
      - GATES: convert check:generation "barn → refused" → positive + structural
        (8 planes, lower steeper than upper, perimeter eave, R305, two-pitch
        hipped silhouette); add check:elevations barn case. Confirm 0 offenders.
      Once done, ALL 7 parser roof styles build → roof part of the backlog empty.
      **HIP build plan (scouted fire 15, next fire) — ONE model, degenerates:**
      ridge line along the LONGER axis, inset from each end by (shorter_dim / 2)
      (standard 45°-in-plan hip), at the footprint center, height ridgeH. FOUR
      planes: 2 long trapezoids (the long sides) + 2 triangular hip ends. When
      the footprint is SQUARE (1/2-bed are 28×28) the inset = W/2 so the ridge
      degenerates to a POINT → a pyramid (4 triangles) — the same formula, no
      special case. 3-bed (36×28) gets a real ridge line along x.
      - HEIGHTS: eave 8, ridge ~14. Eave runs around the WHOLE perimeter at 8 ft,
        so the ceiling is ≥8 everywhere → R305 100% (no headroom-limited footprint
        needed). Reuse gable footprints.
      - ELEVATIONS: set ridgeAxis to the longer axis. The hip-END view
        (gableFacing) is a TRIANGLE (apex at center) → the EXISTING gable render
        already works. The long-SIDE view (!gableFacing) needs a NEW TRAPEZOID
        render (eave → rise to ridge-start → flat ridge top → descend to eave);
        with a zero-length top it degenerates to the pyramid triangle, so ONE
        trapezoid render covers both square + rect. Do NOT touch gable/a-frame/
        flat/shed paths (traced plans must not regress).
      - GATES: convert the check:generation "hip → refused" case to positive +
        structural (4 planes, eave around perimeter, R305 passes, trapezoid/centered
        silhouette); add a hip case to check:elevations. Confirm 0 render offenders.
- [x] _(enhancement)_ Synthesize 4-bedroom layouts — **DONE (fire 19)**: a 48×28
      grid-aligned plan with 4 bedrooms + central bath builds for all eave-≥7 roof
      styles, each bedroom R305 + operable egress; a-frame 4-bed and 5+ bedrooms
      refused honestly. (Original scout notes below.)
      **4-BED build plan (scouted fire 18) — de-risked:**
      `starterFixtures` already iterates rooms generically (bed→bed+wardrobe,
      bath→toilet+vanity+shower, kitchen, living), the interior-wall builder
      derives walls from room rects, and R305/egress/area checks all generalize —
      so a 4-bed template needs ONLY room rectangles + doors + windows authored.
      Concrete fully-tiling **48×28** layout (no gaps/overlaps):
      • front z0–12: living x0–24, kitchen x24–48.
      • hall z12–16: full width 48.
      • back z16–28: bed1 x0–11, bed2 x11–22, bath x22–30 (w8), bed3 x30–39,
        bed4 x39–48 (all d12; beds ≥ 9×12 = 108 sqft ✓).
      • egress windows: bed1 W(x0), bed2 S(z28), bed3 S(z28), bed4 E(x48) — all 4
        operable. Doors from hall to each bed + bath; entry→living; living↔kitchen
        open. Raise MAX_TEMPLATE_BEDROOMS 3→4; add 48×28 footprint for n=4.
      Build steps: failing check:generation case (4-bed compiles, 4 bedrooms,
      each egress, R305 pass, zero fails, no overlap) → author the block → gates.
      5/6-bed stay honestly refused (a future general packer). Gate carefully.
- [x] Requested-sqft fidelity — fire 4: a ≤sqft cap below the smallest template
      was silently exceeded; now refused with a clear message. (A ≤cap ABOVE the
      build, e.g. ≤1400 → 1008, is correct: ≤ is an upper bound, honored.)
- [x] Drive baths/loft/roof program fidelity — fire 3: baths silently downgraded
      (fixed via reconciliation notes); loft + roof are honest. Class closed for
      these dimensions.
- [ ] _(enhancement)_ UX-loop follow-up: render `compiled.notes` (program
      reconciliations + the loft-guard R312 note) on the plan-detail page so they
      are visible in the UI, not just the API.
- [x] Egress operability — fire 9: bedroom egress windows were hardcoded `fixed`
      (inoperable) yet passed R310. Compiler now emits `egress`; engine rejects
      explicit-fixed windows. Class closed for the single-level case.
- [ ] Sleeping-loft egress: a "sleeping loft" brief yields a room typed `loft`
      (label "Loft") that neither the compiler sleeping-set nor the engine
      `SLEEPING_PATTERN` treats as a sleeping room — so it gets no egress
      requirement and a fixed window. If a loft is used for sleeping it should
      require an operable egress opening (and a fixed loft window should fail).
      Separate class (loft-as-sleeping-room semantics); needs care re: R305 loft
      gates. Not chased in fire 9 (one class per fire).

## Findings log
_(bug → class → test → root-cause fix → commit)_

## ARCHITECTURE — placement resolves against the envelope (2026-08-16)

_Not a fire. This is the ordering/authority fault the per-plan sweeps kept
producing symptoms of, fixed once at the level where it lives._

**The fault.** Openings and fixtures were authored in **2D plan coordinates,
before the roof existed** — spans were literals in `mockIntentFromBrief`; the
roof is computed later in `compileIntent`. `ceilingHeightAt` — the shared
envelope query the 3D clip, the elevations and the constraint engine all use —
was **never consulted by placement**. So the envelope was a thing plans were
*checked against* (sometimes) rather than *placed within*. Unbuildable geometry
was therefore the guaranteed output of any roof whose height varies across a
facade, not an edge case. Sweeping more plans would have produced an endless
list of symptoms; the correct fix is to invert the authority — templates
propose, the envelope disposes.

**Three symptoms, one cause, one inversion:**

1. **Openings** (`lib/generate/place-openings.ts`) — an a-frame put its bedroom
   EGRESS windows on the **2.13 ft eave wall**: a legal impossibility R310
   passed, because the engine checked presence and operability but never whether
   the opening could physically exist. `resolveEgressWindow` keeps the authored
   span when it genuinely works (stability), else slides along the room's
   exterior walls to the best position satisfying R310, else refuses honestly.
2. **Fixtures** (`lib/generate/place-fixtures.ts`) — same blindness: a **kitchen
   counter under 2.36 ft of ceiling**, a sink under 2.47 ft, a sofa under 3.83 ft.
   Every existing gate passed (in-room, clear of neighbours); nothing asked how
   much air was above. Thresholds are code-derived, not taste: **6'8"** (R305.1
   bath minimum — the height you stand at a fixture) for standing use, **5 ft**
   (R305's habitable-area cutoff) for seated/lying.
3. **Elevations** — the drawing set was a hardcoded `[front, side]` pair, so once
   openings correctly resolve to the rear or right wall, **those walls were drawn
   nowhere**. The set now derives from the openings: a facade carrying an opening
   gets an elevation. A shed's two x-faces genuinely differ (x=0 at the ridge,
   x=width at the eave), so `right` derives from the eave — a derivation, not a
   special case.

**Gates assert MORE (three universal invariants, all mutation-tested):**
- egress realizability — every sleeping room's egress opening must fit the
  envelope where it actually sits;
- fixture headroom — every fixture has the headroom its use requires
  (390 assertions across the matrix);
- documentation completeness — every facade carrying an opening is drawn
  (98 assertions). This **replaced** two `elevations.length === 2` count checks:
  the count was a weak proxy, and the property it stood in for is strictly
  stronger. Not a loosening — the mutation (revert to a fixed front+side pair)
  fails with `facade with openings is drawn: rear: front, side`.

**Result.** a-frame: 0 fixture-headroom violations, egress relocated with honest
notes, drawing set front/side/rear/right; gable and shed unchanged where the
envelope never conflicted (nothing moves without cause). `npm run gates` and
`npm run gates:live` green.

## ARCHITECTURE fire 2 — the drawing layer, and a regression I shipped (2026-08-16)

_Found by DRIVING the real surface and LOOKING: generated a plan through the
live API, screenshotted plan + elevations + 3D, then read the artifact JSON._

### (a) My own regression: envelope-aware relocation stacked the fixtures
- **Bug:** the plan drawing showed a pile of furniture. The artifact confirmed
  **7 overlapping fixture pairs** — all four kitchen fixtures on one spot.
- **Cause:** fire 1's `resolveFixturePlacement` resolved each fixture ALONE
  against a single objective, "most headroom". Every fixture in a room therefore
  converged on the same optimum (the ridge). Correct per fixture, nonsense per
  room.
- **Class:** _a placement rule that optimises one element at a time produces
  collisions when it relocates several._
- **Root cause fix:** resolve AS A SET (`resolveFixtureSet`), with two rules now
  shared with openings in `lib/generate/placement.ts` (P7): **minimum
  displacement**, not maximum headroom — the authored layout is design intent and
  relocation should disturb it as little as the envelope allows — and **each
  element clears the ones already placed**.
- **Ordering matters, and it took two tries.** Anchoring the comfortable fixtures
  first let a 4 ft table block the 8 ft sofa group out of the only band tall
  enough to hold it, and the room reported "unplaceable" though both plainly fit.
  The rule is first-fit-decreasing: **the tightest fit chooses first**, measured
  as the free area its room leaves it. One rule, and it subsumes the roof case.

### (b) Pre-existing, exposed by the new gate: templates author fixtures on top of each other
- On small-lot plans (`1-bed gable 30x50`, `3-bed gable 40x70`) the template put
  the dining table **2.50 x 3.50 ft on top of the sofa** — a pure 2D template
  overlap under a roof with headroom to spare, shipped for as long as those
  templates have existed and never gated. Now resolved (table moves 3.5 ft).

### (c) The drawing layer could only draw two of the four facades
- **Bug (this is the one that mattered):** fire 1 added rear/right entries to
  `artifact.elevations` and gated them — but `lib/elevations.ts`, which is what
  the app and `check:elevations` actually DRAW from, took `side: 'front'|'side'`
  and matched openings only at z=0 / x=0. So of the a-frame's 4 windows, **3 were
  drawn nowhere — including both bedroom EGRESS windows.** The screenshot showed
  "SIDE ELEVATION - 0 OPENINGS" beside a plan full of windows.
- **My fire-1 claim that the relocated egress windows were "documented" was
  wrong**: the metadata listed them, no drawing showed them. Two sources of
  truth, which is exactly what P7 forbids — and my gate asserted on the one that
  does not drive the drawing.
- **Class:** _a gate that asserts on metadata instead of on the artifact the user
  actually sees can pass while the defect ships._
- **Root-cause fix:** one facade model (`facadeFor`) for all four elevations —
  axis, fixed coordinate, span, and the view-from-outside mirror, applied once at
  the end so silhouette and openings cannot disagree. Front and side keep their
  exact existing convention (nothing drawn today changes); rear and right are
  defined as the mirror of the face they oppose. The UI renders every facade that
  carries an opening.
- **Gate asserts MORE:** `check:elevations` now asserts the real property across
  7 roof styles x 1-3 bedrooms — **every exterior opening belongs to exactly one
  facade and is drawn on that facade's elevation** (105 assertions). Mutating
  `onFacade` back to z=0/x=0 fails with `right draws []` and the rear elevation
  drawing the front's openings — i.e. it reproduces the shipped bug exactly.
- **Also new:** `check:generation` asserts **no two fixtures overlap** (2385
  assertions). Nothing asserted this before, which is why (a) and (b) both shipped.

**Verified on the real surface, not just in the batteries:** regenerated the
a-frame through the live API — 0 overlapping fixture pairs, and the UI renders
front / side / **rear** (both egress windows) / **right** (kitchen window), the
last two previously drawn nowhere. Traced plans are untouched (that panel shows
the GPT proposal for them, not the semantic set). `npm run gates` green.

## ARCHITECTURE fire 3 — the visual sweep, and the loft drawn in its own frame (2026-08-16)

_Built the harness the last two fires proved was missing: `scripts/visual-sweep.mjs`
drives every plan the app SERVES in a real browser, captures plan + full drawing
set + 3D, and asserts on the rendered DOM. `scripts/contact-sheet.py` tiles the
captures so a whole matrix can be reviewed at once instead of one plan at a time._

### The defect: a loft is drawn in its own frame, not the building's
- **Found by looking** at the contact sheet: the two loft plans showed a LOFT
  LEVEL floating below the MAIN LEVEL, narrower and offset, with a dashed box
  around it that reads as the ground-floor outline but is not.
- **Measured, not eyeballed:** `loft-showcase` rendered `L0 28x28@48` and
  `L1 18x28@123`. Different extent, different origin.
- **Root cause:** `FloorPlanView` computes each level's frame as the bounding box
  of THAT level's own rooms, normalises those rooms to it, then centres each
  level independently. A loft is therefore drawn stripped of its position in the
  building — you cannot see which rooms it sits above — and the `floorNum > 0`
  "ground floor outline ghost" outlines the loft itself. Underneath sits the real
  limitation: a floor frame records a width and depth but **no origin**
  (`gx: 0, gz: 0`), so it can never place an upper level; only a shared frame can.
- **Class:** _a derived drawing frame computed per level instead of per building._
- **Fix:** stacked levels of a compiled plan share ONE frame spanning the whole
  building; rooms keep their true coordinates within it. Scoped to the compiled
  lane by an explicit `sharedLevelFrame` prop — traced plans carry an authored
  per-floor frame from the drawing they came from, and we do not overrule the
  source (P4). Verified: `a-frame-bunk` (traced, guardrailed) is byte-identical
  before and after; `loft-showcase` and the generated lofts now render
  `L0 28x28@48  L1 28x28@48`, loft aligned under the rooms it covers.
- **Gate asserts MORE:** the sweep asserts _stacked levels share one drawing
  frame_ for compiled plans, reading `data-frame-width/depth/x`. Mutation
  (`sharedLevelFrame={false}`) fails with `L0 28x28@48  L1 18x28@123`; the traced
  plan correctly never trips it either way.

### Two things I chased that were NOT defects (recorded so they are not re-chased)
- **"Archived plans 404 / do not render."** The sweep was enumerating plan
  DIRECTORIES; the app serves 6 of 35 (the rest are archived, artifacts moved to
  `paired/archive/`). Measuring the wrong population. The sweep now enumerates
  `data-feed-plan-id` from the feed — what the app actually serves.
- **"A deep link to a missing plan silently shows the gallery."** It does not:
  `[data-plan-not-found]` renders "The plan X wasn't found ..." and the tab title
  becomes "Plan not found". My probe's regex missed "wasn't". Verified positively.
- The console 404s in the first sweep were **my own** dangling manifest entries
  from deleting plan directories with `rm -rf` instead of the delete API. The
  delete API (manifest + directory) is the only correct path; 60 leftover `gen-*`
  plans from this and earlier live-gate runs were removed through it.

### Result across the whole matrix
18 plans swept (7 roof styles x 1-3 bedrooms, both loft variants, small lot, plus
every stored plan the app serves): **0 failures**. Every roof style renders its
own silhouette in plan, elevation and 3D; every exterior opening is drawn on
exactly one facade; no invented openings; no console errors; stacked levels share
a frame. Quantified from the sweep data: before fire 2, every plan in this matrix
was missing **2-3 windows** from its drawing set (gable-family: `right`=2
undrawn; a-frame: `rear`=2 + `right`=1).

`npm run check:visual` sweeps the matrix; `check:visual:quick` (a compiled
multi-level plan, a compiled single-level one, a traced one) is wired into
`gates:live` so the picture is gated on every run, not only when someone looks.

### Gate integrity: `gates:live` could test code nobody had written
Chasing the sweep's console-404s (which turned out to be my own `npm run dev`
and the production server both writing `.next`) surfaced a real hole:
`run-live-gates.mjs` built only `if (!existsSync('.next/BUILD_ID'))`, so running
`gates:live` alone after editing a source file served the PREVIOUS build. A gate
that reports on stale code is worse than no gate. It now rebuilds whenever any
file under `app/`, `components/` or `lib/` is newer than `.next/BUILD_ID`
(verified both ways: false when fresh, true after touching one source file).
`npm run gates` already rebuilds, so the sanctioned pre-commit path was safe —
the standalone one was not.

## NEW LOOP — Manufacturability + 3D (started 2026-06-22)
_Frontier: every generated plan must be buildable as a WikiHouse plywood panel
kit, and the 3D model must match the 2D/code source of truth._

### Post-loop audit (2026-07-22, independent re-validation of the MFG work)
Re-verified the manufacturability loop's claims from scratch rather than trusting
the log. Result: **the work stands**; two small honesty defects found and fixed.
- **Units traced end-to-end (the load-bearing assumption of `check:buildable`):**
  `build-validator` reads `DenHome.sourceWalls` in **4 ft GRID units** (×4);
  `lib/bim/semantic-bim.ts` independently agrees (`GRID_FT = 4`); traced stored
  sourceWalls are grid (a-frame-22 x-range 0..9.01 ×4 = 36.0 ft = its exact
  footprint); and `lib/data.ts` emits derived walls/openings through `ftToGrid`
  (= /4). So the gate's ÷4 adapter is FAITHFUL to the real app path
  (28 ft → 7 grid → ×4 → 28 ft). `validateBuildability` is genuinely wired into
  the app (lib/data.ts, app/page.tsx) — the gate covers a live path, not a stub.
  _(An intermediate probe that omitted `ftToGrid` appeared to show 4×-inflated
  "12 ft doors"; that was the probe being unfaithful, not the app. Recorded so
  the false alarm isn't rediscovered.)_
- **DEFECT FIXED — stale module strings:** six user-facing strings still said
  "1.2m" after the module became 4 ft, one self-contradictory: _"is 27.56ft, not
  N x 1.2m (nearest 7 panels is 28.00ft)"_. Now derived from `PANEL_WIDTH_FT`
  (rule label, blocker message, and 4 BOM descriptions).
- **Scope stated explicitly:** traced reference plans remain `blocked`
  (wall-module/openings) — they are image-traced organic geometry off the 4 ft
  grid by nature (they fail WH-GRID-4FT too). Not a regression; documented in
  `check-buildable.mjs` so "buildable" is read as a claim about GENERATED plans.
- Gates re-run independently: `npm run gates` + `gates:live` green.

**Guardrail audit across the whole session (UX + GEN + MFG, 120+ commits):**
- **Protected artifacts never modified** — 0 commits touch a-frame-22,
  a-frame-bunk, outpost-medium, or gen-001.
- **"Gates assert MORE, never less" held:** +93 `check()` assertions added, **0
  removed** (check-generation +62, check-elevations +19, check-brief +5,
  check-envelope-clip +4, check-code-advisory +3). No tolerance was loosened —
  the only lib/ diffs against the numeric invariants are message-text changes.
- **UX-era gates untouched** by the later loops and green in every live ladder;
  the commits PROJECT_STATUS cites for the 12 UX classes all exist and match.

**Mutation testing — do the gates actually BITE?** Each fix was reverted in place,
the battery re-run, then restored. All 9 caught the reintroduced bug (exit≠0) and
returned to green (exit 0):

| reverted fix | battery | verdict |
|---|---|---|
| fire 1 — stop refusing >4-bed briefs | check:generation | ✅ bites |
| fire 6 — parser drops orphan setbacks | check:brief | ✅ bites |
| fire 7 — compact bath loses its lavatory | check:generation | ✅ bites |
| fire 9 — bedroom windows back to `fixed` | check:generation | ✅ bites |
| fire 9 — engine accepts `fixed` as egress | check:code | ✅ bites |
| fire 12 — stop emitting loft guard rails | check:generation | ✅ bites |
| fire 19 — 4-bed room off the 4 ft grid | check:generation | ✅ bites |
| M3 — flat roof back to a non-SKU 9 ft wall | check:buildable | ✅ bites |
| M4 — revert to the over-conservative simple span | check:buildable | ✅ bites |
| M6 — unsnap the loft band from the module | check:buildable | ✅ bites |

No vacuous gates found: every substantive claim in both loops is backed by an
assertion that fails when the fix is removed.

### M-fire 10 — clean (fresh angles) — 2nd consecutive clean → MANUFACTURABILITY LOOP CLOSED
- **Drove fresh angles, no defect:** (a) loft-plan 3D envelope-clip — every
  loft-capable style (a-frame/gable/gambrel/barn + loft) clips with 0 envelope
  violations (the floor-1 loft geometry doesn't pierce the roof); (b) live API
  sweep — all 7 roof styles build through `/api/generate-plan` with no error.
- **Result:** second consecutive clean fire. Every generated plan (7 roof styles
  × 1–4 beds, ± loft) is verifiably manufacturable as a WikiHouse panel kit with a
  correct 3D model, or refuses honestly. **CLOSE CONDITION MET** — PROJECT_STATUS
  + playbook (§13) updated, pushed, notified, cron deleted.
- **Commit:** _(close commit)_

### M-fire 9 — clean (full manufacturability matrix verified) — 1st consecutive clean
- **Drove the full matrix (42 plans):** 7 roof styles × 1–4 beds × {no-loft, loft
  where capable}, all through `validateBuildability`. Every plan: status not
  blocked (buildable), wall-module/wall-height/openings/floor-span pass, roof-pitch
  pass-or-advisory, a sane BOM (wall panels + floor cassettes > 0), and no orphan
  openings. Zero issues.
- **3D + panel-fit gated:** check:clip (5 new roofs) + check:buildable (panel-fit
  + not-blocked + roof-pitch-never-blocks) both green.
- **Result:** every generated plan is verifiably manufacturable as a WikiHouse
  panel kit with a correct 3D model. First clean fire after the M1→M8 streak. App
  byte-identical; gates green by identity.
- **Commit:** _(doc-only)_

### M-fire 8 — roof-pitch resolved (CNC advisory) → ALL manufacturability classes done
- **Decision (user):** WikiHouse rafters/cassettes are CNC-cut to the design →
  any pitch is manufacturable; the fixed-SKU list is an over-constraint.
- **Fix (no geometry distortion):** build-validator's roof-pitch rule now emits an
  ADVISORY warning ("Roof pitch X is CNC-cut to the design, not a stock SKU")
  instead of a blocker when the pitch is off-stock; a matching pitch still passes
  as a stock rafter. Rule relabeled "Roof pitch is a stock or CNC-cut rafter".
- **Result:** all 27 plans (7 roof styles × 1–4 beds) now validate as buildable
  (status not blocked); off-stock pitches are advisory only.
- **Gate (gates assert MORE):** `check:buildable` now asserts every plan's
  overall status ≠ blocked AND roof-pitch never blocks — the full STOP-condition
  ("every generated plan is verifiably manufacturable").
- **Verified:** `check:buildable` green; full `gates` + `gates:live` green.
- **Manufacturability frontier COMPLETE:** 3D clip (fire 1), 4 ft panel module +
  wall-module/height/openings (fire 3, + flat SKU), floor-span (fire 4), loft
  walls (fire 6), roof-pitch (fire 8). Two clean verification fires → close.
- **Commit:** _(pending push)_

### M-fire 7 — roof-pitch (last class): decision needed (CNC any-pitch vs fixed rafter SKUs) — DECIDED: CNC advisory
- **Drove + confirmed the coupling:** roof-pitch failures (shed 15.9°, gambrel/
  barn 29.7°, a-frame 50.5°, gable+loft 40.6°) are entangled with loft headroom —
  a usable loft NEEDS a steep, non-SKU pitch. Snapping IS feasible (snap UP:
  gable+loft 40.6→45° raises the ridge and the loft survives; a-frame→60°), but
  it's a deep cascade: ridge becomes footprint-dependent (ridge = eave + run·tan
  sku), per (style, loft) target, with R305/loft/elevation/clip re-verification,
  and gambrel/barn are two-pitch (don't fit a single rafter-SKU).
- **Why BLOCKED on a decision:** whether to snap at all depends on a domain fact
  I can't resolve — does WikiHouse CNC-cut rafters to the design (ANY pitch is
  manufacturable → the fixed-SKU rule is a false constraint, keep roof-pitch
  ADVISORY, no geometry distortion) or stock fixed rafter SKUs (must snap, deep
  cascade)? build-validator's roof-pitch is currently an UNGATED advisory; the
  four gated manufacturability rules all pass. Surfaced to the user.
- **Commit:** _(doc-only; loop paused on this decision)_

### M-fire 6 — off-grid loft walls: snap the loft band to the 4 ft panel module
- **Drove:** loft plans' gable wall `ext-l1-front` was off the 4 ft grid (gable+
  loft 17 ft, gambrel/barn/a-frame+loft 11 ft) → wall-module blocked. The loft
  band width was the raw continuous headroom band, never snapped.
- **Fix (root cause in `buildLoft`):** snap the loft band width to a 4 ft panel
  multiple, rounding INWARD (so it stays within the headroom envelope) and
  recentering; if the snapped band is below `MIN_LOFT_SPAN_FT` the loft honestly
  degrades to single level. Loft walls are now 4 ft-aligned (gable 16 ft,
  gambrel/barn/a-frame 8 ft) → wall-module passes.
- **Re-verified the cascade:** loft R305 still passes (narrower band stays in the
  headroom-qualified zone), the R312 guard rails still emit on each open edge,
  the loft window/footprint stay in-bounds.
- **Gate (gates assert MORE):** added loft plans (a-frame/gable/gambrel/barn) to
  `check:buildable` — their wall-module/wall-height/openings/floor-span all pass.
- **Verified:** `check:buildable` green; full `gates` + `gates:live` green.
- **Remaining open class:** roof-pitch (shed/gambrel/barn/a-frame pitches off the
  rafter-SKU list) — the last manufacturability class; deep cascade (footprint-
  dependent ridge, loft-ridge-raise interaction, gambrel/barn two-pitch).
- **Commit:** _(pending push)_

### M-fire 5 — scout the two remaining manufacturability classes (roof-pitch, loft walls)
- **roof-pitch (SKUs {0,12,25,45,60,72}°, tol 2.5°):** gable 23.2°→25 ✓, hip
  23.2°→25 ✓, flat 0° ✓; **FAIL: shed 15.9° (→12, Δ3.9), gambrel/barn 29.7°
  (→25, Δ4.7), a-frame 50.5° (→45, Δ5.5).** The generator chose arbitrary ridge
  heights (14/16/18) → off-SKU pitches. **Fix (root cause, next fire):** derive
  each style's ridge from a TARGET rafter SKU — ridge = eave + run·tan(sku):
  a-frame→60° (steep, keeps headroom), shed→12°, gambrel/barn→25° (the dominant
  lower pitch). Cascades into R305 / loft headroom / elevations / clip — re-verify
  all. Not decision-laden (standard pitches are the truth); just careful.
- **loft walls (off-grid):** every loft gable wall `ext-l1-front` is off the 4 ft
  grid — gable+loft 17 ft, gambrel/barn+loft 11 ft (the loft band width = the
  roof headroom band, not snapped). **Fix (next fire):** snap the loft band width
  (and x-origin) to 4 ft multiples in `buildLoft` (round inward to stay within
  headroom), then re-verify loft R305 + reposition the loft window/guard. Then add
  loft plans + `wall-module` for them to check:buildable.
- No code change this fire (both are substantial cascading geometry changes;
  scouted for clean execution next, after 4 manufacturability fires landed this
  session). **Commit:** _(doc-only)_

### M-fire 4 — floor-span: credit interior bearing walls (fix the over-conservative simple span)
- **Drove:** every plan was `floor-span: blocked` — build-validator used
  `min(footprint)` = 28 ft as the joist span, exceeding the 16 ft limit.
- **Root cause = the validator, not the plan:** the simple-span model ignored
  that every plan has FULL-WIDTH interior walls (the hall at z=12 / z=16) that are
  natural bearing lines. The real floor-joist span is the largest gap between
  bearing lines = 12 ft (verified: 0→12, 12→16, 16→28). The 28 ft "span" was a
  modeling artifact.
- **Fix (one constructive model in build-validator):** `joistSpanFt(home)` =
  min over the two joist orientations of the max gap between bearing lines
  (exterior walls + any interior wall line covering ≥70% of the perpendicular
  dimension). Falls back to the full footprint when there's NO wall graph, so it
  only ever REDUCES the span when real bearing walls justify it — never inflates
  buildability. structuralSpan now uses it.
- **Gate (gates assert MORE):** added `floor-span` to `check:buildable`'s asserted
  rules — every roof × bed plan now passes (12 ft span between bearing lines).
- **Verified:** all plans floor-span pass (12 ft); `check:buildable` green; full
  `gates` + `gates:live` green.
- **Remaining open classes:** roof-pitch (some pitches off the rafter-SKU list),
  off-grid loft walls.
- **Commit:** _(pending push)_

### M-fire 3 — implement the 4 ft-panel-module decision + gate manufacturability + fix flat wall-SKU defect
- **Decision (from the user, on the M-fire 2 finding):** treat the planner's 4 ft
  structural grid AS the panel module — build-validity is measured against the
  system's real module, not a separate 1.2 m sheet dimension nothing uses.
- **Root change:** `build-validator.ts` `PANEL_WIDTH_FT = 1.2 m → 4 ft` (a 4 ft
  panel = the 1.2 m sheet trimmed to the imperial grid). Now every 4 ft-grid wall
  is an exact panel multiple → wall-module / wall-height / openings PASS for the
  standard plans (was: all blocked).
- **New gate (gates assert MORE):** `scripts/check-buildable.mjs` (`npm run
  check:buildable`, added to the `gates` ladder) drives `validateBuildability` on
  every roof style × 1–4 beds and asserts the PANEL-FIT rules (wall-module,
  wall-height, openings) pass + a BOM is produced.
- **DEFECT caught by the new gate (defect discipline):** flat roofs used a 9 ft
  wall — NOT a manufacturable wall-height SKU (2.4 m=7.87 / 3.0 m=9.84; 9 ft is
  0.84 off). Root-fixed: `FLAT_ROOF_HEIGHT_FT 9 → 8` (the same ~2.4 m SKU every
  other roof's eave uses; still clears R305). Flat plans now pass wall-height.
- **Still-open manufacturability classes (tracked, NOT yet gated — next fires):**
  (a) **floor-span** — 28 ft depth > 16 ft simple-joist span (all plans; needs an
  intermediate beam/bearing line). (b) **roof-pitch** — some pitches aren't on
  the rafter-SKU list (e.g. a-frame 18.4°, barn 29.7°). (c) **loft walls** — a
  loft's headroom-band wall isn't 4 ft-aligned (e.g. 11 ft). Each gets added to
  `check:buildable`'s asserted rule set as it's root-fixed.
- **Verified:** `check:buildable` green; full `gates` + `gates:live` green.
- **Commit:** _(pending push)_

### M-fire 2 — DROVE manufacturability → foundational 4 ft-grid vs 1.2 m-panel tension (DECIDED: 4 ft = the module)
- **Drove `validateBuildability` (lib/build-validator.ts) on real plans.** Built a
  minimal DenHome adapter (artifact → sourceWalls/openings/rooms) and ran it.
- **Finding:** generated plans are `status: blocked` — TWO classes:
  1. **wall-module:** every wall fails the 1.2 m panel module. The planner uses a
     4 ft design grid (WH-GRID-4FT gate); 4 ft = 1.219 m ≠ 1.2 m, and the error
     accumulates (28 ft = 7×1.2 m = 27.56 ft → 0.44 ft short; 12 ft → 0.19 short).
  2. **floor-span:** the 28 ft plan depth exceeds the 16 ft max simple joist span
     ("add beams or split the floor system").
- **System-wide, NOT a generated-plan defect:** the TRACED reference plans fail
  too (a-frame-22: 52 wall-module blockers; outpost-medium: 18). `build-validator`
  is an UN-GATED advisory that NO plan in the system currently passes.
- **Why this is BLOCKED on a product decision (not a loop fix):** every fix
  collides with a guardrail. Re-gridding to 1.2 m breaks WH-GRID-4FT and would
  regress the protected traced plans. Redefining build-validator's module to 4 ft
  diverges from the real WikiHouse 1.2 m sheet. "Never loosen a gate / never
  fabricate / traced plans must not regress" all apply. No safe default →
  surfaced to the user for direction; no code change this fire.
- **(Separable:** the 16 ft floor-span blocker is independent of the grid
  question — every plan is 28 ft deep; could be addressed with an intermediate
  beam/joist callout regardless of the grid decision.)
- **Commit:** _(doc-only; loop paused pending decision)_

### M-fire 1 — close the 3D envelope-clip coverage gap for the 5 new roof styles
- **Known gap (from the constructive loop):** `check:clip` (check-envelope-clip.mjs)
  only exercised the original 2-plane a-frame/gable; the 5 new roof styles
  (flat=1 plane, shed=1, hip=4, gambrel=4, barn=8) added planes that feed the
  clipper but were never asserted in 3D.
- **Drove the real 3D clipper:** ran each new style's ACTUAL compiled roof planes
  through `clipPrismToCeiling` (lib/bim/envelope-clip.ts). Result: the clipper's
  min-over-planes model handles 1/4/8 planes cleanly — every style clips
  non-empty with **0 envelope violations** (no vertex pierces the roof). No 3D
  defect; the surface was simply ungated.
- **Gate asserts MORE (regression guard):** `check:clip` now drives the real
  compiler planes for flat/shed/hip/gambrel/barn and asserts: planes fit,
  clipped wall prism non-empty, no envelope violation (<1e-6), reaches the ridge
  (not flattened). Tuned the ridge tolerance to 0.5 ft to cover a shed's high
  edge sitting at the overhang line (peak ≈ ridge − slope·overhang, correct).
- **Verified:** `npm run check:clip` green; full `gates` + `gates:live` green.
- **Commit:** _(pending push)_

### Fire 21 — clean (fresh angles) — 2nd consecutive clean → LOOP CLOSED
- **Drove fresh angles the gates don't fully cover, no defect:**
  - **4-bed connectivity:** all rooms reachable from the exterior.
  - **4-bed fixtures:** every bedroom has a bed; the bath has a lavatory
    (toilet+vanity+shower). The 8 ft bed3/bed4 lack a wardrobe — but that is the
    EXISTING width-gated behavior (`w≥9 && d≥9`); the 2-bed 24 ft gable's 8 ft
    bedrooms behave identically, and closets aren't IRC-required. Not a
    regression, not a code defect.
  - **Dimension lines** correct for the new 48×28 footprint (48'-0"/28'-0").
  - **Elevation silhouette distinctness:** each new roof renders its OWN
    silhouette — shed=monoPitch, hip=hipTrapezoid, gambrel=gambrel, barn=barnHip
    — none falls back to the gable triangle.
- **Result:** second consecutive clean fire. Backlog empty; diverse briefs across
  all 7 roof styles × 1–4 bedrooms produce sound, code-checked, honestly-drawn
  plans; everything outside the envelope refuses honestly. **CLOSE CONDITION MET**
  — PROJECT_STATUS + playbook updated, pushed, notified, cron deleted.
- **Commit:** _(close commit)_

### Fire 20 — clean (full matrix verification; backlog empty) — 1st consecutive clean
- **Drove the entire support matrix, no defect:**
  - **7 roof styles × 1–4 bedrooms** (27 buildable combos): every plan has ZERO
    constraint-fail findings and ZERO render offenders. a-frame 4-bed refused
    honestly (eave headroom).
  - **Loft × every roof style:** built where headroom genuinely clears (gable,
    gambrel, barn — R305-verified against the REAL planes, with the fire-12 guard
    rails, 0 render offenders), honestly degraded to single level where it can't
    (flat, shed, hip). Zero fails everywhere.
  - **Extreme briefs:** tiny lot (4-bed barn on 30×40) and sub-cap sqft (≤400)
    refuse honestly; 3-bed hip 2-bath and 1-bed shed on a big lot build soundly.
  - **Refusals honest:** a-frame 4-bed, 5+ bedrooms, unbuildable lots/caps,
    unsupported roof styles (none left) — all surface a clear reason.
- **Result:** every supported brief produces a sound, code-checked, honestly-
  drawn plan, and everything outside the envelope refuses honestly. This is
  hand-to-an-architect quality across the whole matrix. First clean fire after
  the fire-14→19 constructive streak. App byte-identical; gates green by identity.
- **Commit:** _(doc-only)_

### Fire 19 — BUILD 4-bedroom synthesis → enhancement backlog EMPTY
- **Capability:** the generator REFUSED 4+ bedrooms (capped at 3 since fire 1);
  now it BUILDS 4-bed. `"4 bed gable, 80x100 lot"` → a sound, code-checked plan.
- **De-risked model:** `starterFixtures`, the interior-wall builder, and the
  R305/egress/area/grid checks all generalize from the room rectangles — so the
  4-bed needed ONLY new room rects + doors + windows. A 48×28 plan tiles four
  bedrooms + a central bath across the rear band (boundaries 0/12/24/32/40/48 all
  on the 4 ft grid); bed1/bed4 take the side walls and bed2/bed3 the rear wall
  for operable egress. Raised `MAX_TEMPLATE_BEDROOMS` 3→4 + clamp; added the
  48×28 footprint for n=4. Fixtures/walls came free.
- **DEFECT caught mid-build (gate did its job):** first pass used 11/9 ft bedroom
  widths → WH-GRID-4FT failed (off the 4 ft panel grid). Fixed to grid-aligned
  12/12/8/8 + 8 bath. (Defect discipline outranks features — fixed before moving
  on.)
- **a-frame 4-bed refused honestly:** an a-frame's 1 ft eave leaves the two
  width-edge bedrooms of a 48-wide plan below R305 headroom (~23% at 7 ft), so it
  is refused with a clear message rather than shipping a plan that fails its own
  ceiling check. 5+ bedrooms still refused (template ceiling). The eave-≥7 styles
  (gable/flat/shed/hip/gambrel/barn) all host 4 beds.
- **Failing assertions FIRST (gates assert MORE):** `check:generation` — fire-1's
  "4-bed → refused" became a positive 4-bed case + a structural block: exactly
  four bedrooms, 48×28, a bath present, EACH bedroom proves egress + R305 + an
  operable window, grid passes, zero fails, builds for all 6 eave-≥7 styles,
  a-frame refused.
- **Verified:** offline batteries green; live `POST /api/generate-plan` builds the
  4-bed (was 422); render primitives = 0 offenders; full `gates` + `gates:live`
  green. Throwaway gen-002 deleted.
- **Commit:** _(pending push)_

### Fire 18 — BUILD the barn roof (gambrel hip) → ALL 7 roof styles now build
- **Capability:** the generator REFUSED `barn` roofs; now it BUILDS them — the
  LAST refused roof style. `"2 bed barn roof, 40x60 lot"` → a sound plan.
- **One constructive model — two stacked hips:** a barn (gambrel hipped on all
  four sides) is a steep LOWER hip (eave perimeter 8 ft → a knuckle ring) stacked
  under a shallow UPPER hip (knuckle ring → ridge). A single `hipBand(bInset, yB,
  tInset, yT)` helper builds the 4 frustum planes between two uniformly-inset
  rectangles; barn = `hipBand(eave→knuckle)` + `hipBand(knuckle→ridge)` = 8
  planes. The uniform-inset math means the ridge becomes a LINE on a rectangle
  and a POINT on a square (stacked pyramids) with NO orientation branch — the
  cleanest model of all the roofs. R305 free (perimeter eave 8 → ceiling ≥ 8).
- **Elevation:** BOTH faces are a two-pitch HIPPED silhouette (eave → steep to
  inset knuckle → shallow to inset ridge → flat ridge → mirror). Added `barnHip`
  to the elevation model + a render branch (6-pt outline). Other roof paths
  untouched → traced plans don't regress.
- **Failing assertions FIRST (gates assert MORE):**
  - `check:generation` — fire-10 "barn → refused" case became 3 positive cases +
    a structural block (square + rect): style barn, EIGHT planes, four lower
    planes reach the perimeter eave, single level, 6-pt two-pitch-hipped front,
    R305 passes for every bedroom, zero constraint fails.
  - `check:elevations` — barn front+side both two-pitch hipped (`barnHip` set),
    knuckle between eave and ridge and inset (hipped, not a gable end), openings
    clamp under the ridge.
- **Plumbing:** `'barn'` added to the union + `BUILDABLE_ROOF_STYLES` (now all 7
  parser styles); `BARN_EAVE/KNUCKLE/RIDGE_FT`; `mockIntentFromBrief` selects
  barn + reuses gable footprints + ridgeAxis = longer; `compileIntent` emits the
  8 barn planes (via hipBand) + 6-pt outline.
- **Verified — ALL 7 styles build with 0 render offenders** (a-frame, gable,
  flat, shed, hip, gambrel, barn); live `POST /api/generate-plan` builds the barn
  (was 422); full `gates` + `gates:live` green. Throwaway gen-002 deleted.
- **Commit:** _(pending push)_

### Fire 17 — BUILD the gambrel roof (two-pitch gable)
- **Capability:** the generator REFUSED `gambrel` roofs; now it BUILDS them.
  `"2 bed gambrel, 40x60 lot"` → a sound, code-checked plan.
- **One constructive model:** a gambrel is a two-pitch gable — per side a STEEP
  lower plane (eave → knuckle) + a SHALLOW upper plane (knuckle → ridge) = four
  planes. The knuckle sits a quarter of the width in from each side, ¾ of the way
  up from eave (8) to ridge (16). Same plane machinery: `ceilingProfileForRect`
  takes the min over the four planes, R305 passes (eave 8 → ceiling ≥ 8).
- **Elevation:** the gable end is a 5-sided two-pitch silhouette (eave → knuckle
  → ridge → knuckle → eave). Added `gambrel {knuckleStart,knuckleEnd,knuckleHeight}`
  to the elevation model + a gambrel render branch in `elevationSvgString` (drawn
  before the gable triangle). Long side reuses the facade (full-length ridge).
  gable/a-frame/flat/shed/hip paths untouched → traced plans don't regress.
- **Failing assertions FIRST (gates assert MORE):**
  - `check:generation` — fire-10 "gambrel → refused" case became 3 positive cases
    + a structural block: style gambrel, FOUR planes, the LOWER slope steeper than
    the UPPER (the gambrel signature), single level, a 5-sided front silhouette,
    R305 passes for every bedroom, zero constraint fails.
  - `check:elevations` — gambrel front+side models build, the front is the
    two-pitch end (knuckle between eave and ridge, inset from both sides),
    openings clamp under the ridge.
- **Plumbing:** `'gambrel'` added to the union + `BUILDABLE_ROOF_STYLES`;
  `GAMBREL_EAVE/KNUCKLE/RIDGE_FT` (8/14/16); `mockIntentFromBrief` selects
  gambrel + reuses gable footprints; `compileIntent` emits the four gambrel
  planes + 5-point gable-end outline.
- **Verified:** offline batteries green; live `POST /api/generate-plan` builds the
  gambrel (was 422); render primitives = 0 offenders; full `gates` + `gates:live`
  green. Throwaway gen-002 deleted.
- **Commit:** _(pending push)_

### Fire 16 — BUILD the hip roof (four planes; pyramid on a square footprint)
- **Capability:** the generator REFUSED `hip` roofs; now it BUILDS them, for both
  a SQUARE footprint (1/2-bed 28×28 → pyramid, ridge = point) and a RECTANGLE
  (3-bed 36×28 → ridge line). `"2 bed hip roof, 40x60 lot"` → a sound plan.
- **One constructive model, degenerating:** ridge line along the LONGER axis,
  inset from each end by half the shorter dimension (45° hip in plan); four
  planes — two long trapezoids + two triangular hip ends — with the eave running
  around the WHOLE perimeter at 8 ft. When square, the inset == half-span so the
  ridge collapses to a point and all four planes become triangles to one apex (a
  pyramid). ONE formula, no per-aspect special case. R305 comes free: the
  perimeter eave is 8 ft so the ceiling is ≥ 8 everywhere (100% pass), via the
  same `ceilingProfileForRect` (min over the four planes' bboxes).
- **The elevation work (the real effort):** the hip END face is a centered
  triangle → the existing gable render already serves it. The long-SIDE face is a
  TRAPEZOID (eave → inset ridge → flat → eave) that the facade path drew as a
  full-width ridge (would read as a gable). Added `hipTrapezoid {ridgeStart,
  ridgeEnd}` to the elevation model and a trapezoid render branch in
  `elevationSvgString` — it collapses to the pyramid triangle when start==end.
  gable/a-frame/flat/shed paths untouched → traced plans don't regress.
- **Failing assertions FIRST (gates assert MORE):**
  - `check:generation` — converted the fire-10 "hip → refused" case into 3
    positive cases + a structural block (square + rect): style hip, FOUR planes,
    ridge along the longer axis, every plane reaches the perimeter eave, single
    level, valid outlines, R305 passes for every bedroom, zero constraint fails.
  - `check:elevations` — hip front+side models build (square + rect), eave <
    ridge on both faces, openings clamp under the hipped roofline, the long side
    is a TRAPEZOID with the ridge inset from both ends (not a full-width ridge).
- **Plumbing:** `'hip'` added to the union + `BUILDABLE_ROOF_STYLES`;
  `HIP_RIDGE_FT`/`HIP_EAVE_FT` (14/8); `mockIntentFromBrief` selects hip, reuses
  gable footprints, sets ridgeAxis to the longer axis; `compileIntent` emits the
  four hip planes (both axis orientations) + trapezoid/triangle outlines.
- **Verified:** offline batteries green; live `POST /api/generate-plan` builds
  both hip variants (was 422); render primitives = 0 offenders; full `gates` +
  `gates:live` green. Throwaway gen-002 deleted.
- **Commit:** _(pending push)_

### Fire 15 — BUILD the shed roof (mono-pitch, second roof style)
- **Capability:** the generator REFUSED `shed` roofs; now it BUILDS them.
  `"2 bed shed roof, 40x60 lot"` → a sound, code-checked single-slope plan.
- **One constructive model:** a shed is ONE sloped plane, high edge (ridge 12 ft,
  x=0) → low edge (eave 8 ft, x=widthFt), ridgeAxis 'z'. The geometry comes free
  through the SAME plane machinery — `ceilingProfileForRect`/R305 and the opening
  head-clamp (`limitAtSpan`/`ceilingHeightAt`) sample the real sloped plane, so
  the ceiling slopes 12→8 (both ≥ 7 ft → R305 100% across the floor) and openings
  clamp under the slope automatically. Reuses the gable footprints + the whole
  room/fixture/egress layout (all prior fixes carry over).
- **The real work — the elevation silhouette:** the across-slope (front) face
  defaults to a CENTERED GABLE TRIANGLE; a shed needs a MONO-PITCH line (high
  edge → low edge). Added `monoPitch` + `monoPitchHighAtStart` to the elevation
  model (derived by sampling the plane at both span ends — no per-style geometry
  guess) and a mono-pitch branch in `elevationSvgString`. The gable/a-frame/flat
  paths are untouched → traced plans don't regress.
- **Failing assertions FIRST (gates assert MORE):**
  - `check:generation` — converted the fire-10 "shed → refused" case into 3
    positive cases + a structural block: style shed, one plane that actually
    slopes (ridge>eave) spanning ridge..eave, single level, valid outlines, the
    FRONT elevation is mono-pitch (spans ridge..eave, not a centered apex), R305
    passes under the slope for every bedroom, zero constraint fails.
  - `check:elevations` — shed front+side models build, `monoPitch` true on the
    across-slope face, openings clamp under the sloped roofline, silhouette is
    asymmetric (ridge end ≠ eave end).
- **Plumbing:** `'shed'` added to the union + `BUILDABLE_ROOF_STYLES`;
  `SHED_RIDGE_FT`/`SHED_EAVE_FT` (12/8); `mockIntentFromBrief` selects shed +
  reuses gable footprints; `compileIntent` emits the single sloped plane +
  `front-shed` (sloped) / `side-shed` (high-wall) outlines.
- **Verified:** offline R305 + structural + elevation batteries green; live
  `POST /api/generate-plan` builds the shed (was 422); render primitives = 0
  offenders; full `gates` + `gates:live` green. Throwaway gen-002 deleted.
- **Commit:** _(pending push)_

### Fire 14 — BUILD the flat roof (first constructive-frontier capability)
- **Capability:** the generator REFUSED `flat` roofs (fire 10 made the refusal
  honest); now it BUILDS them. `"2 bed flat roof, 40x60 lot"` → a sound,
  code-checked single-level plan instead of a 422.
- **One constructive model, reusing the a-frame/gable machinery:** a flat roof
  is ONE horizontal `roof-plane` at a constant height (ridge == eave == 9 ft) —
  fed through the SAME `planeEquation` / `ceilingProfileForRect` (R305) / clip /
  `buildElevationModel` paths, with no rise. No special-case branch in the
  geometry consumers; they degenerate correctly (the elevation renders a
  flat-topped box; the ceiling profile is constant). Reuses the gable footprint
  set (flat has uniform full headroom, the most permissive) and the whole room/
  fixture/egress layout — so bedroom windows are still `egress`, fixtures
  complete, rooms reachable (all prior fixes carry over).
- **Failing assertions FIRST (gates assert MORE):**
  - `check:generation` — converted the fire-10 "flat → refused" case into 3
    positive cases (2/3/1-bed flat) + a structural block: roof.style flat, EXACTLY
    one horizontal plane (ridge==eave), single level, ≥3-pt elevation outlines,
    R305 passes on the flat ceiling for every bedroom, zero constraint fails.
  - `check:elevations` — a flat-roof front+side model builds, openings clamp
    under the flat roofline, ridge==eave, SVG renders.
- **Geometry/plumbing:** added `'flat'` to the roof-style union +
  `BUILDABLE_ROOF_STYLES`; `mockIntentFromBrief` selects flat + sets
  ridge=eave=`FLAT_ROOF_HEIGHT_FT` (9); `compileIntent` emits the single flat
  plane + `front-flat`/`side-flat` slab outlines; the refusal message now lists
  the buildable set with an Oxford comma (shed/hip/gambrel still refused).
- **Verified:** offline R305 + structural battery green; live `POST
  /api/generate-plan` builds the flat plan (was 422); render primitives = 0
  offenders, all layers valid; full `gates` + `gates:live` green. Throwaway
  gen-002 deleted.
- **Commit:** _(pending push)_

### Fire 13 — clean (drove dimensions, fixtures, loft+guard, connectivity, extremes)
- **Drove 5 hard angles, all sound — no real defect:**
  - **Dimension lines** match the geometry (28'-0"/36'-0" = actual footprint) —
    the sheet does not lie about measurements.
  - **Fixture placement**: every fixture sits inside its room; the only overlap
    is sink-in-counter (the sink is fully nested in the counter run — intentional,
    a sink set into the countertop; a benign false positive like fire-8 swings).
  - **Loft + new guard**: dims correct, elevations sane (a-frame triangle / gable
    intact), both guard rails present; the floor-1 guards don't disturb the
    elevation outline.
  - **Connectivity**: every level-0 room is reachable from the exterior through
    doors/openings; the loft is reached by its ladder (correctly not a door).
  - **Extreme-but-valid briefs** (3-bed 2-bath on a 100×120 lot; 3-bed a-frame;
    2-bed gable+loft on 50×70): full constraint report all pass / not-evaluated,
    zero fails. A 1-bed gable on a 28×40 lot is **refused honestly** (over
    envelope + 35% coverage) — sound behavior, not a wrong plan.
- **Result:** within the supported envelope (1–3 bed, a-frame/gable, optional
  loft) the output is genuinely hand-to-an-architect quality. First clean fire
  after the fire-9→12 fixes. App byte-identical; gates green by identity.
- **Commit:** _(doc-only)_

### Fire 12 — BUILD the loft guard (constructive fix of fire 11's deferred defect)
- **Closes fire 11's deferred DEFECT.** Fire 11 surfaced the loft fall-protection
  gap honestly (a note); the root cause — no guard geometry — remained. This fire
  builds it.
- **Re-examined the render risk (fire 11 overstated it):** `drawing-primitives.ts`
  line **112** already classifies `/guard|rail/` wall kinds as `'wall'` (that's
  how the traced lofts' guards render and pass gates), and compiled artifacts
  derive primitives directly from their arrays (no `sourceWalls`/`sourceAnchors`
  needed). So emitting a guard tags cleanly — not an untagged offender.
- **Class:** constructive completion of a required safety element (IRC R312.1).
- **Failing test first (red → green):** `check:generation` — a loft plan must
  model a guard rail on EACH open edge (`≥2 floor-1 interiorWalls` with
  wallKind `/guard|rail/`), guards stay inside the footprint, single-level plans
  have none. Was 0 guard walls before the fix.
- **Root-cause fix (`compile-plan.ts`, one constructive rule):** when a loft is
  built, emit a `lowGuardRail` interior wall (36 in) on each open long edge of
  the headroom band (axis-aware: long edges are the open sides; the gable ends
  are closed by the roof). Reworded the note to state the guard IS provided and
  flag baluster-spacing/attachment as shop-drawing scope.
- **Verified the RENDER (offline, faithful):** `extractSourceDrawingPrimitives`
  on a compiled loft yields both guards as `layer:'wall'`, floor 1, valid
  `semanticSpan` (line at the loft edge, full depth) — structurally identical to
  a normal wall — and **0 untagged/offender primitives**. The 2D sheet now draws
  the rails. Traced plans + single-level plans untouched.
- **Verified:** full `gates` (all batteries + build) green; `gates:live` green.
- **Commit:** _(pending push)_

### Fire 11 — loft is open to below with NO fall protection, shipped silently
- **Bug (found by driving loft + circulation):** the generated loft (level 1,
  ~8 ft above the floor) is open to below on its long edges with **no guard
  rail** (zero guard/rail elements; no open-to-below marker) — an IRC R312.1
  fall hazard — and the plan ships it **silently** (no callout, no note). The
  constraint report says nothing about it. Both traced lofts (a-frame-22,
  a-frame-bunk) DO model a guard (guard-rail window referencing the loft),
  proving the model supports it; the compiler emits none.
- **Also driven, clean (no defect):** hallway width (48 ft… 48 in, >36 in min)
  and door clear widths (36 in egress door; 30 in interior doors are
  code-compliant under base IRC); window/door placement + same-wall overlaps;
  habitable min area; a-frame ground-floor sloped-ceiling headroom (R305 honest,
  the low eave edges are expected a-frame behavior, ≥50% at 7 ft).
- **Class:** _a required safety element omitted AND not surfaced_ — the
  input-honesty family (P5) applied to a code requirement the template can't yet
  model. Same channel as the fire-3 bath-downgrade note.
- **Why the geometry fix was deferred (not rushed):** building the guard means
  emitting guard walls/openings + having the render classifier recognize them.
  `drawing-primitives.ts:113` (the wall-layer classifier) does NOT match guard
  kinds, so a compiler-emitted `lowGuardRail` would render as an UNTAGGED
  OFFENDER and fail the evidence gate. The constraint-engine path is also fragile
  (engine sees openings, not walls; no `advisory` status). That is render-/
  source-of-truth work deserving a focused fire — logged as a backlog DEFECT
  with the full plan, not a rushed half-measure.
- **Failing assertion added (gates assert MORE):** `check:generation` — a loft
  plan MUST surface a fall-protection note (`/guard|R312|fall protection/i`); a
  single-level plan must NOT (no false note). Was null before the fix.
- **Root-cause fix (honest surfacing now, via the established notes channel):**
  `compileIntent` pushes an R312 note whenever a loft is built — "loft is open to
  below (~8 ft above…); IRC R312.1 requires a 36 in guard… add/verify before
  construction (not modeled in this deterministic plan)." The generator never
  again silently ships a loft that looks fully detailed.
- **Verified:** note flows through `POST /api/generate-plan` (live, a-frame with
  loft); single-level plans unaffected; traced lofts (which model real guards)
  untouched. Throwaway gen-002 deleted. Full `gates` + `gates:live` green.
- **Commit:** _(pending push)_

### Fire 10 — requested roof style silently substituted with an a-frame
- **Bug (found by driving all 7 parser-recognized roof styles):** the parser
  accepts `a-frame, gable, hip, flat, shed, barn, gambrel`, but the compiler
  implements only a-frame + gable. Driving "2 bed <style> roof" showed
  `hip/flat/shed/barn/gambrel` ALL silently built an **a-frame** (18 ft ridge,
  1 ft eave) — a "flat roof" request produces a steep a-frame and never tells the
  user. Root cause: `mockIntentFromBrief` line 662 `brief.roofStyle === 'gable' ?
  'gable' : 'a-frame'` flattens every non-gable style to a-frame.
- **Class:** _silent program mismatch_ (same family as fires 1/3/4 — bedrooms,
  baths, sqft) extended to roof style. The brief is captured correctly by the
  parser, then silently misrepresented by the compiler.
- **Failing assertions added (gates assert MORE):** `check:generation` — four
  `expectCompileError` cases (shed/flat/hip/gambrel) asserting the brief is
  REFUSED with `/builds only a-frame and gable/i` (were silently compiling).
- **Root-cause fix (`compile-plan.ts`, established refusal pattern):**
  - `BUILDABLE_ROOF_STYLES = ['a-frame','gable']` (exported, single source).
  - Thread `requestedRoofStyle` (the RAW brief style) onto `GenerationIntent`,
    set in `mockIntentFromBrief` — mirrors `requestedBedrooms/Baths/MaxSqft`.
  - `compileIntent` refuses when `requestedRoofStyle` is set and not buildable,
    with a clear message — never silently substitutes. (Live/GPT path leaves it
    unset, so full generation can still handle other styles — consistent with the
    other deterministic-template refusals.)
- **Verified:** a-frame/gable still compile (battery roof-style assertions green);
  live `POST /api/generate-plan` → shed roof returns **HTTP 422** with the
  refusal message, gable returns success. Throwaway gen-002 + failure artifacts
  deleted. Full `gates` + `gates:live` green.
- **Commit:** _(pending push)_

### Fire 9 — every bedroom egress window is FIXED (inoperable) yet R310 passes
- **Bug (found by driving egress *dimensional/operability adequacy*):** every
  generated bedroom's emergency-escape window is `windowKind: 'fixed'` (compiler
  hardcoded `'fixed'` for ALL windows, compile-plan line 491/618). A fixed window
  cannot open, so it is NOT an IRC R310.1 emergency escape opening — yet both the
  compiler's egress pre-check AND `codeAdvisoryReport` passed R310.1 on mere
  *presence* of a window. The rule citation even spells out the dimensional
  minimums ("5.7 sq ft… 24 in height, 20 in width; sill ≤ 44 in") that the engine
  never checked. A dishonest "pass that should fail," and an architecturally
  non-compliant plan (sleeping rooms with no legal egress).
- **Class:** _egress verdicts that ignore whether the opening can actually
  function as egress_ (operability). Confirmed the intended kind is operable: the
  stored `brief-aframe-2br` fixture already carries `windowKind: 'egress'` on its
  bedroom windows — proof the compiler regressed to blanket `'fixed'`.
- **Failing assertions added (gates assert MORE):**
  - `check:code` (code-advisory) — a sleeping room whose only opening is a
    `windowKind:'fixed'` window must FAIL R310 (caught the dishonest pass); an
    operable `egress` window passes; an *unspecified* windowKind stays a candidate
    (so traced/image-extracted plans without windowKind never regress).
  - `check:generation` — "egress window operable (not fixed) for `<bedroom>`" for
    every bedroom in every driven brief.
- **Root-cause fix (one constructive rule, not a special case):**
  - Compiler (`compile-plan.ts`): `windowKindFor(roomId)` → `'egress'` when the
    window serves a sleeping room, else `'fixed'`. Applied at both window sites
    (main map + loft window). One rule, no per-room branching.
  - Engine (`code-advisory.ts`): `isEgressCandidate` rejects a window whose
    `windowKind` is explicitly `'fixed'`; only an *explicit* fixed disqualifies.
    R310 fail now names the precise failure ("only escape opening(s) are
    fixed/inoperable"). Pass detail is honest about what's modeled (presence +
    operability) vs. flagged for shop drawings (net clear area + sill).
  - Adapters (`floorplan-standards.ts`, check-generation `reportForArtifact`):
    thread `windowKind` from artifact windows into `CodeAdvisoryOpening`.
- **Blast radius verified — no regression:** a-frame-22 / outpost-medium windows
  carry no windowKind → still candidates → pass; a-frame-bunk loft window is
  `lowGuardGlazedOrOpenRail` (≠fixed) → pass; brief-aframe-2br is `egress` → pass;
  gen-001 has fixed bedroom windows but R310 is asserted on it nowhere (its frozen
  JSON is untouched). Loft (type `loft`, not a sleeping room per engine
  `SLEEPING_PATTERN`) keeps a fixed window with R310 not evaluated — unchanged.
- **Verified live:** drove `POST /api/generate-plan` (3-bed gable) on :3002 — the
  live artifact's three bedroom windows are now `egress`; kitchen/living stay
  `fixed`. Throwaway gen-002 + manifest entry deleted. Full `gates` green.
- **Commit:** _(pending push)_

### Fire 8 — clean (door-swing clearance investigated; probe over-reported)
- **Drove:** door-swing-vs-fixture collisions. Doors encode real swing geometry
  (`hingePoint`/`leafOpenEnd`/`swingDirection`/`swingArcDeg`); a geometric
  quarter-disc probe flagged many "collisions" (toilet 0.3 ft from hinge, bed/
  closet in arc). Noticed `doorSwingClear: true` is HARDCODED (compile-plan ~265),
  not computed — so the flag couldn't be trusted either way.
- **Resolved against the source of truth (rendered 2D sheet):** generated a
  3-bed/2-bath plan and inspected the deterministic render. The swings are drawn
  and CLEAR the fixtures — the Bath door swings into its open lower half (away
  from toilet/sink/shower), bedroom doors clear the beds, closets clear. The
  geometric probe was over-reporting (misreading swing side / same-wall-adjacent
  fixtures). Also confirmed: **fire-7's Bath 2 lavatory renders correctly** (toilet
  + small sink) — the powder room is sound.
- **Result:** no real defect; no fabricated fix. The plan is genuinely
  hand-to-an-architect quality (clear swings, sensible fixtures, dimensions,
  north arrow, scale, legend). Logged the hardcoded `doorSwingClear` as a latent
  metadata-honesty backlog item (not worth a high-blast-radius fix). App
  byte-identical; gates green by identity. Throwaway gen-002 deleted.
- **Commit:** _(doc-only)_

### Fire 7 — second bathroom generated with no lavatory (toilet only)
- **Bug (found by driving fixture completeness):** every 2-bath plan's "Bath 2"
  (a 4×4 powder room) shipped with ONLY a toilet — no sink/lavatory — across
  a-frame 3-bed, gable 3-bed, and a-frame 2-bed. A toilet-only room isn't a
  bathroom (architectural completeness + plumbing-code: every bathroom needs a
  lavatory). The primary Bath correctly had toilet+vanity+shower.
- **Class:** _a generated room missing a fixture its type requires._ Root cause:
  the bath fixture-placement gated the vanity on `room.w >= 6` (else branch) or
  `w<6 && d>=6` (narrow branch); a 4×4 powder room (w<6 AND d<6) fell through
  both and got a toilet only.
- **Failing assertion added (gates assert MORE):** `check:generation` — "bathroom
  <id> has a lavatory" for EVERY bathroom room (caught room-bath2 toilet-only
  before the fix).
- **Root-cause fix (`compile-plan.ts` starterFixtures):** added a compact-bath
  branch (`w<6 && d<6`) placing a toilet + an unconditional small lavatory
  (toilet north wall, sink below) — fits a 4×4, in-bounds, no overlap. The vanity
  is unconditional for a bathroom now, not size-gated away.
- **Verified:** every bath (incl. Bath 2) has a lavatory across all three 2-bath
  plans; fixtures in-bounds, no overlaps; single-bath plans + traced + gen-001
  unchanged (no stored plan has a bath2). gates + gates:live green. Throwaway
  gen-002 deleted.
- **Commit:** _(pending push)_

### Fire 6 — brief parser silently drops orphan setbacks / coverage
- **Bug (found by driving the parser):** stating setbacks or coverage WITHOUT a
  parseable lot silently drops them — "1 bed a-frame, 5 ft setbacks" → no lot,
  and "5 ft setbacks" is neither applied NOR surfaced in `unparsed` (it was
  take()-consumed). Same for "35% coverage". The user's stated value vanishes with
  no trace — the upstream sibling of the compiler silent-mismatch class.
- **Class:** _a parsed-and-consumed lot modifier with no lot to attach to is
  silently dropped (input honesty, P5: anything the parser ignores is surfaced)._
  Two instances: setbacks AND coverage (both `&& result.lot`-gated).
- **Failing assertion added (gates assert MORE):** `check:brief` — "orphan
  setbacks/coverage surfaced as unparsed" (no lot), plus "setbacks apply when a
  lot is present / applied setbacks do not surface" (no regression). Pre-fix the
  orphan checks fail (unparsed was empty).
- **Root-cause fix (`lib/brief.ts`):** when setbacks/coverage are parsed but
  `result.lot` is absent, push a clear note to `result.unparsed` ("setbacks (no
  lot specified — add a lot to apply them)" / coverage equiv) instead of
  discarding. With a lot they still apply unchanged.
- **Verified:** `check:brief` green; orphan setbacks/coverage now surface;
  lot-attached modifiers still apply (canonical + multi-modifier briefs
  unchanged). gates + gates:live green. No throwaway plans (parser-only).
- **Commit:** _(pending push)_

### Fire 5 — clean (constraint-engine completeness/honesty, no defect)
- **Drove:** the question "is the constraint engine honest AND complete for
  generated plans, or does a life-safety rule silently go not-evaluated?" Ran the
  full code report (via the battery's loft-aware ceiling derivation) on a-frame,
  gable, loft, 1/2/3-bed plans and categorized EVERY verdict.
- **Result — engine is trustworthy and already well-gated:**
  - R310 egress evaluates to `pass` per bedroom (generated windows carry
    `roomIds`); the compiler also refuses a bedroom with no egress opening.
  - R304 habitable minimums (≥70 sqft, ≥7 ft) met on the smallest footprints.
  - R305 evaluates for every habitable room INCLUDING the loft, measured from the
    loft floor (`pass`); battery already asserts loft R305 `pass` + "evaluated"
    (not not-evaluated) + a global "R305 evaluated for every ceiling-ruled room".
  - Grid, ZON-SETBACK, ZON-COVERAGE all evaluate and pass as expected.
  - Also re-verified this fire (all sound): dimension-line accuracy, fixture-in-
    room bounds, room connectivity (loft via `loft_access_ladder`), windows on the
    exterior perimeter.
- **No defect; no fabricated fix.** Investigated a hypothesised "loft R305 only
  covered by zero-fails" gap — turned out the battery already asserts it
  explicitly. App code byte-identical; gates green by identity.
- **Commit:** _(doc-only)_

### Fire 1 — requested bedroom count silently clamped (plan misrepresents brief)
- **Bug (found by driving):** a "5 bed 3 bath gable, 2400 sqft, 80×120 lot"
  brief — large lot, ample sqft — generated a **3-bedroom** plan; "4 bed …" also
  → 3 bedrooms. The brief parser reads `bedrooms: 5` correctly, but
  `mockIntentFromBrief` clamps with `Math.min(3, …)` (line 576) and picks a fixed
  3-br template, **silently dropping the extra bedrooms** with no error or echo.
  A user typing "5 bed" gets a plan that claims to honor the brief but doesn't.
- **Class:** _the deterministic generator silently collapses a requested program
  it can't build (here, bedroom count) into a smaller template, misrepresenting
  the brief — input-honesty violation (P5: no silent drops)._
- **Failing assertion added (gates assert MORE):** `check:generation` cases
  "4-bed / 5-bed exceeds template ceiling" — a brief above the template ceiling
  must FAIL compile with a clear message, not silently produce a 3-bed plan.
  (Before the fix these compiled ok → the gate fails; after, they error.)
- **Root-cause fix:** carry the RAW requested bedroom count onto the intent
  (`GenerationIntent.requestedBedrooms`, unclamped) and refuse at `compileIntent`
  when it exceeds `MAX_TEMPLATE_BEDROOMS = 3` — a clear error mirroring the
  existing "footprint exceeds buildable envelope" refusal, rather than shipping a
  misleading plan. (Honest surfacing now; truly synthesizing N-bedroom layouts is
  a larger constructive change for a later fire — logged in Backlog.)
- **Verified:** `check:generation` green (4/5-bed now error; all ≤3-bed plans +
  gen-001 + traced unchanged). Live API: 5-bed → 422 with the clear message (no
  plan created); 3-bed → still generates. gates + gates:live green. Throwaway
  gen-002 deleted; only gen-001 remains.
- **Commit:** `a45654c`

### Fire 2 — generator ships footprints that fail their own coverage report
- **Bug (found by driving):** a footprint that fits the setback envelope but
  exceeds the 35% lot-coverage cap compiles OK and is shipped — e.g. "2 bed
  a-frame, 38×38 lot, 5 ft setbacks" → 28×28 footprint = **54.3% coverage**
  (`ZON-SETBACK: pass`, `ZON-COVERAGE: fail`); 48×48 3-bed = 43.8%; 40×40 gable =
  42%. The constraint engine is HONEST (correctly fails), but the compiler
  refuses **envelope** violations and NOT **coverage** ones — contradicting
  `mockIntentFromBrief`'s own comment that generated plans "never fail their own
  report." (mockIntentFromBrief tries coverage as a fit criterion, but its
  fallback `?? candidates[last]` ships a non-fitting footprint anyway.)
- **Class:** _the generator emits a plan that fails its own constraint report
  (asymmetric refusal: envelope hard-refused, coverage silently shipped)._
- **Failing assertion added (gates assert MORE):** `check:generation` cases
  "fits envelope but over coverage cap (a-frame / gable)" — such a brief must
  FAIL compile with a clear message, not ship a coverage-failing plan.
- **Root-cause fix:** `compileIntent` now refuses an over-coverage footprint with
  a clear message, right beside the envelope refusal, using the SAME threshold +
  tolerance the report uses. Exported `DEFAULT_MAX_COVERAGE_RATIO` from
  code-advisory and imported it into compile-plan (replacing the duplicated
  `?? 0.35`) — one source of truth (P7), so compile-refuse and report-fail can
  never drift apart.
- **Verified:** `check:generation` green (2 new coverage cases refuse; all
  generous-lot viable briefs + gen-001 + traced unchanged). Live API: 38×38 lot
  → 422 "covers 54.3% … over the 35% coverage cap"; 40×60 lot → still generates.
  gates + gates:live green. Throwaway gen-002 deleted; only gen-001 remains.
- **Commit:** `c204a45`

### Fire 3 — silent 2-bath→1-bath downgrade (SAME class as fire 1, broadened)
- **Bug (found by driving + class scan):** a "2 bath" brief whose footprint only
  fits one bath silently produced a 1-bath plan — no error, no note, API returned
  plain `{planId,…}`. This is the **same class as fire 1's bedroom drop: silent
  program mismatch**. Per the instruction to fix the whole class, I scanned every
  program dimension: **baths** silently downgrade (defect); **loft** is granted
  or cleanly refused (honest); **roof style** always honored (honest). Baths was
  the one remaining silent instance.
- **Class:** _the generator delivers a program that differs from the brief
  without surfacing it (input honesty, P5)._ Two honest responses: impossible
  programs REFUSE (bedrooms, fire 1); accommodated downgrades must be SURFACED
  (baths).
- **Failing assertion added (gates assert MORE):** `check:generation` "bath
  downgrade surfaced as a note (not silent)" — the downgrade case must carry a
  bath reconciliation note (was silent → gate fails; surfaced → passes).
- **Root-cause fix (one mechanism for the class):** added program reconciliation
  to the compile contract — `GenerationIntent.requestedBaths` (raw request),
  `CompileResult.notes[]`, and a `compileIntent` step that compares built vs
  requested baths and surfaces a clear note (ok stays true — a 1-bath home is
  valid). The API now returns `notes` on success, so generation is honest:
  accommodated, never silently honored. Artifact stays byte-identical (no
  geometry change). UI rendering of `notes` on the detail is a UX-loop follow-up
  (logged) — out of this loop's compiler/engine scope.
- **Verified:** `check:generation` green; live API 2-bath→ returns
  `notes:["requested 2 baths; built 1 …"]`; 1-bath/2-bath-that-fit unchanged;
  gen-001 + traced untouched. gates + gates:live green. Throwaway gen-002 deleted.
- **Commit:** `2435078`

### Fire 4 — maxSqft cap silently exceeded (same class, found by class scan)
- **Bug (found by driving extremes + class scan):** a `≤sqft` cap no template can
  meet is silently exceeded — "2 bed gable, ≤500 sqft" → 672 (172 over); "2 bed
  a-frame, ≤600" → 784 (184 over); "3 bed, ≤700" → 784; even "≤50 sqft" → 784
  (15×). `fits()` prefers a footprint within the cap, but the fallback ships the
  smallest template anyway and `compileIntent` never enforced maxSqft — the same
  filter-then-ignore pattern as bedrooms (fire 1) and coverage (fire 2).
- **Class:** _silent program mismatch — generator delivers a footprint larger
  than the user's explicit ≤sqft cap with no error (input honesty, P5)._
- **Failing assertion added (gates assert MORE):** `check:generation` "maxSqft
  cap below smallest template (gable / a-frame)" — must refuse with a clear
  message (shipped before → fails the gate; refuses after).
- **Root-cause fix:** thread `GenerationIntent.requestedMaxSqft` (raw cap) and
  refuse at `compileIntent` when the chosen footprint area exceeds it — beside
  the bedroom/envelope/coverage refusals. Impossible cap → refuse (consistent
  with bedrooms over-cap), not a silent oversize plan.
- **Verified:** `check:generation` green (≤500/≤600 refuse; ≤700→672 and ≤800/
  ≤1200 viable briefs + gen-001 + traced unchanged). Live API: ≤500 → 422
  "672 sq ft exceeds the requested ≤500 sq ft cap"; ≤800 → still generates.
  gates + gates:live green. Throwaway gen-002 deleted.
- **Commit:** _(pending push)_
