// Battery for DEN GENERATION FIDELITY.
//
// The drawing already matches Den's conventions. What does not match is what we
// GENERATE. These metrics come from reading the Den source drawings directly
// (data/den-reference-set/source-images) across the size range — a-frame-22
// (two-storey), barnhouse-family (3 bed), cottage-tiny (studio) — and each is
// computed from the compiled artifact so it is a number that can regress.
//
// Deliberately NOT graded against the traced Den plans in the store: those ARE
// Den plans and would score well, masking the gap in our own output.
//
// Usage: node scripts/check-den-fidelity.mjs (npm run check:fidelity)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));

const BRIEFS = [
  '1 bed a-frame, 40x60 lot, 5 ft setbacks',
  '2 bed gable, 60x90 lot, 10 ft setbacks',
  '3 bed barn roof, 100x120 lot, 10 ft setbacks',
  '2 bed a-frame with loft, 40x60 lot, 5 ft setbacks',
];

const compiled = [];
for (const brief of BRIEFS) {
  const result = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'fidelity', brief);
  if (result.ok) compiled.push({ brief, artifact: result.artifact });
  else console.error(`  FAIL ${brief} does not compile: ${result.errors.join('; ')}`);
}

const typeOf = (room) => String(room.type ?? room.roomKind ?? '').toLowerCase();
const labelOf = (room) => String(room.label ?? '').toLowerCase();
const ground = (a) => (a.rooms ?? []).filter((r) => (r.levelIndex ?? 0) === 0);

/** Metrics, each returning {met, detail} for one artifact. */
const METRICS = {
  'open-core': (a) => {
    // Den keeps living + dining + kitchen as ONE room. We currently emit them
    // as separate walled rectangles, so the count of distinct public rooms is
    // the measure.
    const publicRooms = ground(a).filter((r) => /living|dining|kitchen/.test(`${typeOf(r)} ${labelOf(r)}`));
    return { met: publicRooms.length <= 1, detail: `${publicRooms.length} public room(s): ${publicRooms.map((r) => r.label ?? r.id).join(', ')}` };
  },
  'no-corridor': (a) => {
    // GEOMETRIC, not by label. Keyed on the word "hall" this was trivially
    // faked: renaming the room to "Gallery" flipped it to MET with the corridor
    // physically unchanged. An absence test that a rename can satisfy measures
    // nothing.
    //
    // A corridor is a room that runs most of the way across the building and is
    // too narrow to be anything else.
    const w = a.footprint?.widthFt ?? 0;
    const d = a.footprint?.depthFt ?? 0;
    const corridors = ground(a).filter((r) => {
      const b = r.bounds;
      if (!b) return false;
      const spansWidth = b.w >= w * 0.8 && b.d <= 6;
      const spansDepth = b.d >= d * 0.8 && b.w <= 6;
      return spansWidth || spansDepth;
    });
    return {
      met: corridors.length === 0,
      detail: corridors.length
        ? corridors.map((r) => `${r.label ?? r.id} ${r.bounds.w}x${r.bounds.d}ft`).join(', ')
        : 'none',
    };
  },
  'kitchen-adjacent-to-core': (a) => {
    const rooms = ground(a);
    const kitchen = rooms.find((r) => /kitchen/.test(`${typeOf(r)} ${labelOf(r)}`));
    const living = rooms.find((r) => /living|dining/.test(`${typeOf(r)} ${labelOf(r)}`));
    if (!kitchen || !living) return { met: true, detail: 'single-room plan' };
    // An open core resolves BOTH to the same room. They are not adjacent, they
    // are the same space -- which is the strongest form of the thing this
    // metric asks about. Reporting that as a miss made the score go DOWN when
    // the core was merged, which is the metric being wrong, not the plan.
    if (kitchen.id === living.id) return { met: true, detail: `same room (${kitchen.label ?? kitchen.id})` };
    const a1 = kitchen.bounds, b1 = living.bounds;
    if (!a1 || !b1) return { met: false, detail: 'missing bounds' };
    const touches = (Math.abs(a1.x + a1.w - b1.x) < 0.51 || Math.abs(b1.x + b1.w - a1.x) < 0.51
      || Math.abs(a1.z + a1.d - b1.z) < 0.51 || Math.abs(b1.z + b1.d - a1.z) < 0.51);
    return { met: touches, detail: touches ? 'adjacent' : 'kitchen does not touch living/dining' };
  },
  // An entry must be an INTERIOR transitional space -- Den's outpost-medium has
  // a real Entry room inside the envelope. Matching the word alone is not
  // enough: an "Entry Deck" outside the footprint flipped this metric MET on
  // two briefs while nothing about the interior changed. Same vacuous-metric
  // bug as no-corridor keying on the word "hall". Outdoor platforms are
  // excluded by type, so the name can never carry the metric on its own.
  'has-entry': (a) => {
    const outdoor = (r) => /^(deck|porch|patio|balcony|terrace)$/.test(typeOf(r));
    const hit = ground(a).some((r) => !outdoor(r) && /entry|foyer|mudroom/.test(`${typeOf(r)} ${labelOf(r)}`));
    return { met: hit, detail: hit ? 'present' : 'no entry room' };
  },
  'has-closets': (a) => {
    const n = ground(a).filter((r) => /closet|wardrobe/.test(`${typeOf(r)} ${labelOf(r)}`)).length;
    return { met: n > 0, detail: `${n} closet(s)` };
  },
  'bath-count-scales': (a) => {
    const beds = ground(a).filter((r) => /bed/.test(`${typeOf(r)} ${labelOf(r)}`)).length;
    const baths = ground(a).filter((r) => /bath/.test(`${typeOf(r)} ${labelOf(r)}`)).length;
    return { met: beds < 3 || baths >= 2, detail: `${beds} bed / ${baths} bath` };
  },
  'has-deck': (a) => {
    const hit = (a.rooms ?? []).some((r) => /deck|porch|patio/.test(`${typeOf(r)} ${labelOf(r)}`));
    return { met: hit, detail: hit ? 'present' : 'no outdoor room' };
  },
};

// The battery reports a SCORE and only fails below the recorded floor, because
// every metric starts unmet -- this measures a gap being closed, and a gate that
// demanded all of them today would simply be red forever and get ignored.
// Raise FLOOR as metrics land. It may never fall.
// Measured baseline on 2026-08-18: 7/28. The 3-bed scores 0/7 -- the same plan
// compared against Den's barnhouse-family in DEN_GAP_REVIEW.md.
const FLOOR = Number(process.env.DEN_FIDELITY_FLOOR ?? 14);

let met = 0;
let total = 0;
console.log('den fidelity: generated plans vs the Den drawings\n');
for (const { brief, artifact } of compiled) {
  const results = Object.entries(METRICS).map(([name, fn]) => [name, fn(artifact)]);
  const hit = results.filter(([, r]) => r.met).length;
  met += hit; total += results.length;
  console.log(`  ${brief}`);
  for (const [name, r] of results) console.log(`    ${r.met ? 'MET ' : '  . '} ${name.padEnd(26)} ${r.detail}`);
  console.log(`    -> ${hit}/${results.length}\n`);
}

console.log(`den fidelity score: ${met}/${total} (floor ${FLOOR})`);
if (compiled.length === 0) { console.error('FAIL no plans compiled — refusing to score nothing'); process.exit(1); }
if (met < FLOOR) {
  console.error(`\nFAIL fidelity regressed below the floor: ${met} < ${FLOOR}`);
  process.exit(1);
}
console.log('den fidelity battery clean');
