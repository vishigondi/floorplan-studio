# scripts/

47 files, and they are not all the same kind of thing. This note exists because
five of them look abandoned and are not — one coherence pass nearly deleted the
provenance for data the build validator reads.

## Gates — 42 scripts, run by `npm run gates` / `gates:live`

Anything `package.json` invokes. These are the ladder: they must be green before
a commit, and a failing one is a stop, not a warning. `npm run gates` is the
offline set; `gates:live` drives a real browser and needs `LIVE_GATE_PORT`.

The batteries pair with what they guard:

| Battery | Guards |
|---|---|
| `check:generation` | brief → plan: geometry, program honesty, referential integrity, elevation honesty |
| `check:buildable` | panel fit, wall heights, the SIP span envelope, the BOM |
| `check:code` | the IRC/zoning constraint engine, and that its rules still bite |
| `check:fidelity` | how close generated plans sit to the Den reference drawings |
| `check:kit` / `check:panel-spec` / `check:sourcing` | the tender chain: parts schedule, provider-neutral specification, who can bid |
| `check:elevations` / `check:clip` / `check:drawing` | the drawing set and the 3D envelope |
| `check:licensing` | that Den-derived plans are never publicly servable |

## One-shot provenance tools — DO NOT DELETE AS DEAD CODE

These are unreferenced by `package.json` and untouched for months, which makes
them look abandoned. They are not: they produced data that is committed, live,
and read at runtime. Deleting them would leave that data with no record of where
it came from.

- **`extract-source-primitives.mjs`** and
  **`materialize-source-primitive-overrides.mjs`** — derived the `sourceWalls`
  and `sourceOpenings` on the traced artifacts. That data is consumed by
  `lib/data.ts` and by `lib/build-validator.ts`, where the bearing-line
  calculation behind the joist-span gate reads it. Run once per traced plan;
  the output is committed.
- **`seed-loft-showcase.mjs`** — seeded the persistent `loft-showcase` plan that
  still sits in the plan store. Cited as provenance in `PROJECT_STATUS.md`.

## Diagnostics — run by hand

- **`qa-shots.mjs`** — screenshot sweep of the live app.
- **`contact-sheet.py`** — assembles plan/elevation/3D contact sheets for
  eyeballing a batch against the reference drawings.

## Removed

`measure-skylark-pitch.py` and `measure-skylark-floor-span.py` measured the
WikiHouse Skylark block library from a pinned commit. Skylark was removed on
2026-08-29 — it ships roof blocks at 0 and 42 degrees only, and six of seven
generated roof styles are neither — so both scripts went with it. They are in
git history if a future kit needs the same measurement technique.
