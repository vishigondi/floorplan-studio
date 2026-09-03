// Battery for lib/kit/site-composition.ts.
//
// The module's two claims are that entry position decides which arrangements
// exist at all, and that a unit which cannot be towed out is not a vehicle.
// These checks exist so neither claim can quietly rot into decoration: the
// geometry is exercised against known answers, the tow model is proved to
// actually depend on hitch placement, and the layout recorded as unbuildable
// must keep failing for the reason given.
//
// Usage: node scripts/check-site-composition.mjs (npm run check:site-composition)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  OBSERVED_UNITS, PERMIT_FREE_WIDTH_FT, unitsBy, SKIRTING_IS_DELEGATED,
  LAYOUTS, layoutById, layoutsFor, unitCorners, lengthAxis, polysOverlap,
  towSweep, checkTowEgress, layoutTowsClear, minGapFt, MIN_SEPARATION_FT,
  TOW_SIDE_CLEARANCE_FT, TOW_EXIT_RUN_FT,
} = await import(join(root, 'lib/kit/site-composition.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}
const area = (pts) => Math.abs(pts.reduce((a, p, i) => {
  const q = pts[(i + 1) % pts.length];
  return a + (p.x * q.y - q.x * p.y);
}, 0) / 2);
const near = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

console.log('geometry primitives — exercised against answers known by hand');
const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
check('two clearly overlapping squares overlap',
  polysOverlap(sq, [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }]) === true);
check('two clearly separate squares do not',
  polysOverlap(sq, [{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 20, y: 10 }]) === false);
// The boundary case that matters: a deck butted against a unit shares an edge
// and must NOT read as an obstruction, or every sane layout fails.
check('squares sharing exactly one edge are touching, not overlapping',
  polysOverlap(sq, [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }]) === false);
check('a square fully inside another overlaps',
  polysOverlap(sq, [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }]) === true);
// Rotation must move a unit without resizing it.
const u0 = { id: 'T', model: 't', widthFt: 12, lengthFt: 42, at: { x: 0, y: 0 }, rotDeg: 0, entry: 'side', hitch: 'far-end' };
check('an unrotated unit has its catalogue footprint',
  near(area(unitCorners(u0)), 12 * 42, 0.001), String(area(unitCorners(u0))));
check('and rotating it changes nothing about its size',
  [17, 37, 90, 180, 244].every((d) => near(area(unitCorners({ ...u0, rotDeg: d })), 12 * 42, 0.001)));
check('at 0 degrees the length runs along +y',
  near(lengthAxis(u0).x, 0) && near(lengthAxis(u0).y, 1));
check('and at 90 degrees it runs along -x',
  near(lengthAxis({ ...u0, rotDeg: 90 }).x, -1) && near(lengthAxis({ ...u0, rotDeg: 90 }).y, 0));
check('the tow sweep is wider than the unit by the clearance on both sides',
  TOW_SIDE_CLEARANCE_FT === 2 && TOW_EXIT_RUN_FT === 25
  && near(area(towSweep(u0)), (12 + 4) * (42 + 25), 0.01), String(area(towSweep(u0))));

console.log('observed units — entry read off floor plans, not off the index pages');
check('three models recorded, each with a source',
  OBSERVED_UNITS.length === 3 && OBSERVED_UNITS.every((u) => /zookcabins\.com/.test(u.source)));
check('two enter on the long side, one on the end',
  unitsBy('side').length === 2 && unitsBy('end').length === 1);
check('the Nook Family is the only one that tows permit-free, at exactly the limit',
  PERMIT_FREE_WIDTH_FT === 8.5
  && OBSERVED_UNITS.filter((u) => u.towsPermitFree).map((u) => u.model).join() === 'Nook Family'
  && OBSERVED_UNITS.find((u) => u.model === 'Nook Family').widthFt === 8.5);
check('and every wider model is correctly NOT permit-free',
  OBSERVED_UNITS.every((u) => u.towsPermitFree === (u.widthFt <= PERMIT_FREE_WIDTH_FT)));
// The finding that produces the L-wrap.
check('only the A-Frame Classic has its glass on a different wall from its door',
  OBSERVED_UNITS.filter((u) => u.glassSplitFromDoor).map((u) => u.model).join() === 'A-Frame Classic');
check('the Denali ships a factory deck and the A-Frame Classic ships none',
  OBSERVED_UNITS.find((u) => u.model === 'Denali').factoryPorch !== null
  && OBSERVED_UNITS.find((u) => u.model === 'A-Frame Classic').factoryPorch === null);
check('the delegated-skirting risk is recorded with the maker\'s own wording',
  /Skirting to be done by Customer/.test(SKIRTING_IS_DELEGATED.deliveryScope)
  && /Removable panels only/.test(SKIRTING_IS_DELEGATED.instruction)
  && /Never masonry/.test(SKIRTING_IS_DELEGATED.instruction));

console.log('entry pattern decides which arrangements exist');
const buildable = LAYOUTS.filter((l) => !l.rejected);
check('seven layouts, one of them recorded as unbuildable',
  LAYOUTS.length === 7 && buildable.length === 6);
check('one, two and three unit options all exist',
  [1, 2, 3].every((n) => buildable.some((l) => l.unitCount === n)));
check('every layout\'s unit count matches the units actually placed in it',
  LAYOUTS.every((l) => l.units.length === l.unitCount));
// The central claim: a shared deck that gable ends face needs END entry.
check('the shared-deck shapes require END entry',
  ['splayed-v', 'fan-of-three'].every((id) => layoutById(id).requiresEntry === 'end'));
check('and the long-wall shapes require SIDE entry',
  ['single-l-wrap', 'parallel-open', 'contour-line-three'].every((id) => layoutById(id).requiresEntry === 'side'));
const forDenali = layoutsFor(OBSERVED_UNITS.find((u) => u.model === 'Denali')).map((l) => l.id);
const forNook = layoutsFor(OBSERVED_UNITS.find((u) => u.model === 'Nook Family')).map((l) => l.id);
check('a side-entry unit cannot be put in the fan',
  !forDenali.includes('fan-of-three') && !forDenali.includes('splayed-v'));
check('and an end-entry unit cannot be put in the parallel or L-wrap shapes',
  !forNook.includes('parallel-open') && !forNook.includes('single-l-wrap'));
check('every buildable layout is offered to exactly one entry pattern',
  buildable.every((l) => (forDenali.includes(l.id) ? 1 : 0) + (forNook.includes(l.id) ? 1 : 0) === 1));

console.log('a unit that cannot be towed out is not a vehicle');
check('every buildable layout has all its tow lanes clear',
  buildable.every((l) => layoutTowsClear(l)),
  buildable.filter((l) => !layoutTowsClear(l)).map((l) => l.id).join());
const yard = layoutById('courtyard-three');
check('the courtyard is recorded as unbuildable',
  typeof yard.rejected === 'string' && yard.rejected.length > 0);
check('and it genuinely fails — the back unit\'s lane crosses the shared deck',
  layoutTowsClear(yard) === false);
const yardBlocked = checkTowEgress(yard).filter((v) => !v.clear);
check('exactly one unit is trapped, and it is trapped by the deck',
  yardBlocked.length === 1 && yardBlocked[0].unitId === 'B' && yardBlocked[0].blockedBy.includes('deck'));
check('the rejection text names the deck and the separation, not a vague objection',
  /tow lane crosses the shared deck/.test(yard.rejected) && /minimum separation/.test(yard.rejected));
// The tow model must actually depend on hitch placement, or it is theatre.
const v = layoutById('splayed-v');
const flipped = { ...v, units: v.units.map((u) => ({ ...u, hitch: 'entry-end' })) };
check('turning the hitches to face the deck makes the splayed V fail',
  layoutTowsClear(v) === true && layoutTowsClear(flipped) === false);
check('and with the hitches reversed BOTH units are trapped, by the deck',
  checkTowEgress(flipped).filter((x) => !x.clear).length === 2
  && checkTowEgress(flipped).every((x) => x.blockedBy.includes('deck')));

console.log('units stay far enough apart to read as separate objects');
check('the minimum separation is 8 ft',
  MIN_SEPARATION_FT === 8);
check('every buildable multi-unit layout clears it',
  buildable.filter((l) => l.unitCount > 1).every((l) => minGapFt(l) > MIN_SEPARATION_FT),
  buildable.filter((l) => l.unitCount > 1).map((l) => `${l.id}=${minGapFt(l)}`).join(' '));
check('and the courtyard does not — it closes to 3 ft',
  minGapFt(yard) === 3 && minGapFt(yard) < MIN_SEPARATION_FT);
check('the splayed V leaves a walkable path between the units',
  minGapFt(layoutById('splayed-v')) === 13.7);
check('a single unit has no separation to measure',
  minGapFt(layoutById('single-end-deck')) === Infinity);

console.log('decks stay open — composition, never attachment');
check('no layout gives any deck a roof, because a DeckPlane cannot carry one',
  LAYOUTS.every((l) => l.decks.every((d) => !('roofed' in d) && Array.isArray(d.outline) && d.outline.length >= 4)));
check('the parallel shape warns about the temptation to roof its gap',
  /most tempts someone to roof the gap/.test(layoutById('parallel-open').why)
  && /single dwelling/.test(layoutById('parallel-open').why));
check('the contour shape explains why the units lie along the slope',
  /shallow, even cut/.test(layoutById('contour-line-three').why));
check('the L-wrap explains that the door and the glass are on different walls',
  /door is on the long side and the glass is on the gable/.test(layoutById('single-l-wrap').why));

if (failures > 0) { console.error(`\nsite-composition battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nsite-composition battery clean');
