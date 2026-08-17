// Battery for ARTIFACT DRIFT — the invariants applied to the plans we SHIP.
//
// Every other battery compiles a fresh plan and checks the result, so it only
// ever grades what the compiler does TODAY. The plans the app actually serves
// are stored JSON, written by whatever the compiler was on the day they were
// made. Fixing the compiler does not fix them, and nothing noticed: gen-001 and
// loft-showcase still carry the exact defects the envelope-placement fires
// removed (a kitchen counter under 2.36 ft of ceiling, a sofa under 3.83 ft).
//
// This is a RATCHET, not a pass/fail on absolutes. Some drift is accepted and
// says so in scripts/drift-baseline.json with a reason — gen-001's JSON is
// frozen by project guardrail, and a traced plan records a drawing someone made
// rather than something our compiler produced. What the ratchet forbids is
// drift that is NEW, and exemptions that have quietly stopped being needed.
//
// NOTE ON WHERE THE DATA LIVES: public/data/den-image-loop is a committed
// symlink to /…/dev-compiler/data/den-reference-set/image-loop. The artifacts
// are versioned by THAT repo, this baseline by this one — they can drift apart,
// and a regeneration lands in the other checkout, not in a planner commit.
//
// Usage: node scripts/check-drift.mjs (npm run check:drift)
//        node scripts/check-drift.mjs --write   (re-record the baseline)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { ceilingPlanesFromRoofPoints } = await import(join(root, 'lib/bim/envelope-clip.ts'));
const { headroomOverFt, requiredHeadroomFt } = await import(join(root, 'lib/generate/place-fixtures.ts'));
const { PLACEMENT_CLEARANCE_FT } = await import(join(root, 'lib/generate/placement.ts'));
const { facadeFor, drawnElevationViews } = await import(join(root, 'lib/elevations.ts'));

const LOOP_DIR = join(root, 'public', 'data', 'den-image-loop');
// Lives beside its battery, NOT under artifacts/ — that directory is entirely
// gitignored scratch, and a ratchet whose baseline is not committed is no
// ratchet: every clone would start from whatever it happens to find.
const BASELINE_PATH = join(root, 'scripts', 'drift-baseline.json');
const writeMode = process.argv.includes('--write');

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
  }
}

/** The plans the app serves: a plan directory with a CURRENT paired artifact.
 *  Archived plans move theirs to paired/archive/ and are not served. */
function servedPlans() {
  return readdirSync(LOOP_DIR)
    .filter((name) => existsSync(join(LOOP_DIR, name, 'paired')))
    .map((name) => {
      const dir = join(LOOP_DIR, name, 'paired');
      const file = readdirSync(dir).find((entry) => entry.endsWith('.paired.json'));
      return file ? { planId: name, path: join(dir, file) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.planId < b.planId ? -1 : 1));
}

/**
 * Violations of the universal invariants, as stable keys.
 *
 * Keys, not a count: a baseline that only records "8 violations" accepts a NEW
 * defect the moment an old one is fixed. Each key names the rule and the subject.
 */
function violations(artifact) {
  const found = [];
  const planes = ceilingPlanesFromRoofPoints(artifact.roof?.planes ?? []);
  const fixtures = (artifact.fixtures ?? []).filter((fixture) => fixture.bounds);

  for (const fixture of fixtures) {
    const have = headroomOverFt(planes, fixture.bounds);
    const need = requiredHeadroomFt(fixture.type);
    if (have < need - 1e-6) found.push(`fixture-headroom:${fixture.id}`);
  }

  for (let i = 0; i < fixtures.length; i += 1) {
    for (let j = i + 1; j < fixtures.length; j += 1) {
      const a = fixtures[i].bounds;
      const b = fixtures[j].bounds;
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
      if (ix > PLACEMENT_CLEARANCE_FT && iz > PLACEMENT_CLEARANCE_FT) {
        found.push(`fixture-overlap:${fixtures[i].id}|${fixtures[j].id}`);
      }
    }
  }

  const widthFt = artifact.footprint?.widthFt;
  const depthFt = artifact.footprint?.depthFt;
  if (widthFt && depthFt) {
    const exterior = [
      ...(artifact.doors ?? []).filter((door) => door.openingType === 'exteriorDoor'),
      ...(artifact.windows ?? []),
    ].filter((opening) => opening.span);
    const views = drawnElevationViews({ widthFt, depthFt }, exterior);
    for (const opening of exterior) {
      const facades = ['front', 'rear', 'side', 'right'].filter((view) => {
        const facade = facadeFor(view, widthFt, depthFt);
        const [c1, c2] = facade.axis === 'z'
          ? [opening.span.z1, opening.span.z2]
          : [opening.span.x1, opening.span.x2];
        return Math.abs(c1 - facade.atFt) < 0.35 && Math.abs(c2 - facade.atFt) < 0.35;
      });
      if (facades.length === 1 && !views.includes(facades[0])) {
        found.push(`opening-undrawn:${opening.id}`);
      }
      if (facades.length > 1) found.push(`opening-ambiguous-facade:${opening.id}`);
    }
  }

  return found.sort();
}

// The plans live OUTSIDE this repo: public/data/den-image-loop is a committed
// symlink to an absolute path in a sibling project. So this battery's baseline
// is versioned here while the artifacts it grades are versioned there, and on a
// machine where that path does not exist the symlink simply dangles. Say that
// out loud rather than reporting a vacuous pass over zero plans.
let plans;
try {
  plans = servedPlans();
} catch (error) {
  console.error(`  FAIL cannot read ${LOOP_DIR} — the plan store is a symlink to another checkout; `
    + `this gate needs it present. (${String(error).split('\n')[0]})`);
  process.exit(1);
}
if (!plans.length) {
  console.error(`  FAIL no served plans found under ${LOOP_DIR} — the plan-store symlink is empty or dangling, `
    + `so a "clean" result here would mean nothing was checked.`);
  process.exit(1);
}
console.log(`drift: ${plans.length} served plan(s) against today's invariants\n`);

const actual = {};
for (const plan of plans) {
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(plan.path, 'utf8'));
  } catch (error) {
    check(`${plan.planId}: artifact parses`, false, String(error).slice(0, 100));
    continue;
  }
  actual[plan.planId] = violations(artifact);
}

if (writeMode) {
  const baseline = { note: 'Accepted drift in SHIPPED artifacts. Each entry needs a reason. Shrink it, never grow it silently.', plans: {} };
  const existing = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : { plans: {} };
  for (const [planId, keys] of Object.entries(actual)) {
    baseline.plans[planId] = {
      reason: existing.plans?.[planId]?.reason ?? 'TODO: why is this drift accepted?',
      accepted: keys,
    };
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`baseline written to ${BASELINE_PATH} — fill in every reason before committing.`);
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error(`  FAIL no drift baseline at ${BASELINE_PATH} — run with --write, then justify each entry.`);
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

for (const [planId, keys] of Object.entries(actual)) {
  const entry = baseline.plans?.[planId];
  const accepted = new Set(entry?.accepted ?? []);
  const isNew = keys.filter((key) => !accepted.has(key));
  const fixed = [...accepted].filter((key) => !keys.includes(key));

  // NEW drift is a regression: a shipped artifact broke an invariant it used to hold.
  check(`${planId}: no new drift (${keys.length} known)`, isNew.length === 0, isNew.slice(0, 4).join(', '));
  // Drift that is gone must leave the baseline, or the exemption silently
  // re-authorises the defect if it ever comes back.
  check(`${planId}: baseline has no stale exemptions`, fixed.length === 0, `fixed, remove from baseline: ${fixed.slice(0, 4).join(', ')}`);
  // An exemption without a reason is just a mute button.
  if (entry) {
    check(`${planId}: accepted drift is justified`,
      typeof entry.reason === 'string' && entry.reason.length > 20 && !/^TODO/.test(entry.reason),
      entry.reason ?? 'missing');
  }
}

for (const planId of Object.keys(baseline.plans ?? {})) {
  check(`baseline entry ${planId} still refers to a served plan`, planId in actual, 'plan is no longer served');
}

console.log('');
if (failures) {
  console.error(`${failures} drift check(s) failed`);
  process.exit(1);
}
const total = Object.values(actual).reduce((sum, keys) => sum + keys.length, 0);
console.log(`drift battery clean (${total} known violation(s) in shipped artifacts, all justified)`);
