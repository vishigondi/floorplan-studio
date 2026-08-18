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

const EPS = 0.01;
/** The shared edge of two rectangles, or null when they only touch at a corner. */
function sharedEdge(a, b) {
  const A = a.bounds; const B = b.bounds;
  if (!A || !B) return null;
  for (const [p, q] of [[A, B], [B, A]]) {
    if (Math.abs(p.x + p.w - q.x) < EPS) {
      const lo = Math.max(p.z, q.z); const hi = Math.min(p.z + p.d, q.z + q.d);
      if (hi - lo > 0.5) return { axis: 'x', at: q.x, lo, hi };
    }
    if (Math.abs(p.z + p.d - q.z) < EPS) {
      const lo = Math.max(p.x, q.x); const hi = Math.min(p.x + p.w, q.x + q.w);
      if (hi - lo > 0.5) return { axis: 'z', at: q.z, lo, hi };
    }
  }
  return null;
}
/** Does a drawn interior wall stand on that edge? */
function wallOn(artifact, edge) {
  return (artifact.interiorWalls ?? []).some((wall) => {
    const sp = wall.span ?? wall;
    if (!sp || !Number.isFinite(sp.x1)) return false;
    const vertical = Math.abs(sp.x1 - sp.x2) < EPS;
    if (edge.axis === 'x') {
      if (!vertical || Math.abs(sp.x1 - edge.at) > EPS) return false;
      return Math.min(Math.max(sp.z1, sp.z2), edge.hi) - Math.max(Math.min(sp.z1, sp.z2), edge.lo) > 0.5;
    }
    if (vertical || Math.abs(sp.z1 - edge.at) > EPS) return false;
    return Math.min(Math.max(sp.x1, sp.x2), edge.hi) - Math.max(Math.min(sp.x1, sp.x2), edge.lo) > 0.5;
  });
}
const isOutdoor = (r) => /^(deck|porch|patio|balcony|terrace)$/.test(typeOf(r));
/** Rooms reachable from `start` through shared edges that carry NO wall.
 *
 * Outdoor platforms are NOT traversable. They carry no interior walls by
 * design, so leaving them in let the deck bridge the 3-bed's walled-off
 * Living and Kitchen -- the metric reported one open volume for a plan with a
 * bathroom physically between them. Going outside and back in is not what
 * makes a core open. */
function openVolume(artifact, rooms, start) {
  const seen = new Set([start.id]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const other of rooms) {
      if (seen.has(other.id)) continue;
      const edge = sharedEdge(cur, other);
      if (edge && !wallOn(artifact, edge)) { seen.add(other.id); queue.push(other); }
    }
  }
  return seen;
}
const isPublic = (r) => /living|dining|kitchen|great/.test(`${typeOf(r)} ${labelOf(r)}`);
const labelOf = (room) => String(room.label ?? '').toLowerCase();
const ground = (a) => (a.rooms ?? []).filter((r) => (r.levelIndex ?? 0) === 0);

/** Metrics, each returning {met, detail} for one artifact. */
const METRICS = {
  // Den's core is ONE VOLUME, not one room: a-frame-22 numbers Entry, Kitchen,
  // Dining and Living separately inside a single wall-free space. So the
  // measure is not how many public rooms there are -- counting them punished us
  // for labelling the plan the way Den does -- but whether a wall stands
  // between any two of them.
  //
  // This reads the DRAWN interior walls, not the semanticZone flag the
  // generator sets. Keying on our own flag would make the metric a tautology:
  // it would go MET the moment we claimed openness, whether or not a wall was
  // still there. Re-deriving a partition across the core fails this.
  'open-core': (a) => {
    const publicRooms = ground(a).filter(isPublic);
    if (!publicRooms.length) return { met: false, detail: 'no public rooms' };
    const reach = openVolume(a, ground(a).filter((r) => !isOutdoor(r)), publicRooms[0]);
    const split = publicRooms.filter((r) => !reach.has(r.id));
    return {
      met: split.length === 0,
      detail: split.length === 0
        ? `${publicRooms.length} public zone(s) in one open volume: ${publicRooms.map((r) => r.label ?? r.id).join(', ')}`
        : `walled off from the core: ${split.map((r) => r.label ?? r.id).join(', ')}`,
    };
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
  // Touching is not the question -- a kitchen can share an edge with the living
  // room through a solid wall and be a separate room in every way that matters.
  // The question is whether you can see and walk between them, so this asks the
  // same thing open-core asks: are they in one volume with no wall between.
  // A kitchen merged into a single living room still passes, since a room is
  // trivially in its own volume.
  'kitchen-adjacent-to-core': (a) => {
    const rooms = ground(a).filter((r) => !isOutdoor(r));
    const kitchen = rooms.find((r) => /kitchen/.test(`${typeOf(r)} ${labelOf(r)}`));
    const living = rooms.find((r) => /living|dining/.test(`${typeOf(r)} ${labelOf(r)}`));
    if (!kitchen || !living) return { met: true, detail: 'single-room plan' };
    if (kitchen.id === living.id) return { met: true, detail: `same room (${kitchen.label ?? kitchen.id})` };
    const open = openVolume(a, rooms, kitchen).has(living.id);
    return {
      met: open,
      detail: open
        ? `${kitchen.label ?? kitchen.id} opens onto ${living.label ?? living.id}`
        : 'kitchen is walled off from living/dining',
    };
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
const FLOOR = Number(process.env.DEN_FIDELITY_FLOOR ?? 17);

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
