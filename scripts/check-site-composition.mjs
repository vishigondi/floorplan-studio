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
  doorFacing, doorPoint, pointInPolygon, doorOpensOntoDeck, everyDoorLands,
  mirroredUnits, requiresMirroring, isOrthogonal, ORTHOGONAL_ONLY,
  PAD_SPEC, PROHIBITED_FOUNDATIONS, foundationAllowed, DELIVERY_ACCESS,
  cornerClearanceFt, cornerSavingFt, CUSTOMISATION, customisationAvailableAt,
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
check('eight layouts, one of them recorded as unbuildable',
  LAYOUTS.length === 8 && buildable.length === 7);
check('one, two and three unit options all exist',
  [1, 2, 3].every((n) => buildable.some((l) => l.unitCount === n)));
check('every layout\'s unit count matches the units actually placed in it',
  LAYOUTS.every((l) => l.units.length === l.unitCount));
// The central claim: a shared deck that gable ends face needs END entry.
check('the spoke shapes require END entry — a short-wall door can only point inward',
  ['l-pair', 'trident-three'].every((id) => layoutById(id).requiresEntry === 'end'));
check('and the true U requires SIDE entry — only a long-wall door can line a court edge',
  layoutById('u-court').requiresEntry === 'side');
check('and the other long-wall shapes require SIDE entry too',
  ['single-l-wrap', 'parallel-open', 'contour-line-three'].every((id) => layoutById(id).requiresEntry === 'side'));
const forDenali = layoutsFor(OBSERVED_UNITS.find((u) => u.model === 'Denali')).map((l) => l.id);
const forNook = layoutsFor(OBSERVED_UNITS.find((u) => u.model === 'Nook Family')).map((l) => l.id);
check('a side-entry unit cannot be put in the spoke shapes',
  !forDenali.includes('trident-three') && !forDenali.includes('l-pair'));
check('and an end-entry unit cannot be put in the parallel or L-wrap shapes',
  !forNook.includes('parallel-open') && !forNook.includes('single-l-wrap'));
check('every buildable layout is offered to exactly one entry pattern',
  buildable.every((l) => (forDenali.includes(l.id) ? 1 : 0) + (forNook.includes(l.id) ? 1 : 0) === 1));

console.log('a unit that cannot be towed out is not a vehicle');
check('every buildable layout has all its tow lanes clear',
  buildable.every((l) => layoutTowsClear(l)),
  buildable.filter((l) => !layoutTowsClear(l)).map((l) => l.id).join());
const yard = layoutById('trident-hitched-in');
check('the courtyard is recorded as unbuildable',
  typeof yard.rejected === 'string' && yard.rejected.length > 0);
check('and it genuinely fails — the back unit\'s lane crosses the shared deck',
  layoutTowsClear(yard) === false);
const yardBlocked = checkTowEgress(yard).filter((v) => !v.clear);
check('exactly one unit is trapped, and it is trapped by the deck',
  yardBlocked.length === 1 && yardBlocked[0].unitId === 'B' && yardBlocked[0].blockedBy.includes('deck'));
check('the rejection isolates ONE variable — same geometry, one hitch turned',
  /Same geometry as the working/.test(yard.rejected) && /one placement decision/.test(yard.rejected)
  && JSON.stringify(yard.units.map((u) => [u.at, u.rotDeg]))
     === JSON.stringify(layoutById('trident-three').units.map((u) => [u.at, u.rotDeg])));
// The tow model must actually depend on hitch placement, or it is theatre.
const tri = layoutById('trident-three');
const flipped = { ...tri, units: tri.units.map((u) => ({ ...u, hitch: 'entry-end' })) };
check('turning every hitch inward makes the working trident fail',
  layoutTowsClear(tri) === true && layoutTowsClear(flipped) === false);
check('and all three are then trapped, by the deck they face',
  checkTowEgress(flipped).filter((x) => !x.clear).length === 3
  && checkTowEgress(flipped).every((x) => x.blockedBy.includes('deck')));

console.log('units stay far enough apart to read as separate objects');
check('the minimum separation is 8 ft',
  MIN_SEPARATION_FT === 8);
check('every buildable multi-unit layout clears it',
  buildable.filter((l) => l.unitCount > 1).every((l) => minGapFt(l) > MIN_SEPARATION_FT),
  buildable.filter((l) => l.unitCount > 1).map((l) => `${l.id}=${minGapFt(l)}`).join(' '));
// The rejected layout deliberately passes every OTHER test. Its gaps are fine,
// its shape is fine; one hitch was turned. If it ever starts failing on
// separation too, the example has stopped isolating its variable.
check('the rejected layout passes separation — it fails on one thing only',
  minGapFt(yard) === 12.7 && minGapFt(yard) > MIN_SEPARATION_FT
  && everyDoorLands(yard) === true && isOrthogonal(yard) === true
  && layoutTowsClear(yard) === false);
check('the trident leaves a walkable path between the units',
  minGapFt(layoutById('trident-three')) === 12.7);
check('a single unit has no separation to measure',
  minGapFt(layoutById('single-end-deck')) === Infinity);

console.log('decks stay open — composition, never attachment');
check('no layout gives any deck a roof, because a DeckPlane cannot carry one',
  LAYOUTS.every((l) => l.decks.every((d) => !('roofed' in d) && Array.isArray(d.outline) && d.outline.length >= 4)));
check('the parallel shape warns about the temptation to roof its gap',
  /most tempts someone to roof the gap/.test(layoutById('parallel-open').why)
  && /single dwelling/.test(layoutById('parallel-open').why));
check('the true U explains why its deck is split into two planes',
  /narrows to stay out of the side units/.test(layoutById('u-court').why));
check('and carries the one-compound caution rather than deciding it',
  /reading as one compound/.test(layoutById('u-court').why) && /tax workstream/.test(layoutById('u-court').why));
check('the contour shape explains why the units lie along the slope',
  /shallow, even cut/.test(layoutById('contour-line-three').why));
check('the L-wrap explains that the door and the glass are on different walls',
  /door is on the long side and the glass is on the gable/.test(layoutById('single-l-wrap').why));

console.log('every door has to land on a deck, not on a drop');
// The check the first draft of these layouts did not have. Six doors across
// three layouts opened onto nothing, and only mirroring fixed them.
check('every buildable layout lands every door on a deck',
  buildable.every((l) => everyDoorLands(l)),
  buildable.filter((l) => !everyDoorLands(l)).map((l) => l.id).join());
check('point-in-polygon agrees with hand-checked cases',
  pointInPolygon({ x: 5, y: 5 }, sq) === true && pointInPolygon({ x: 15, y: 5 }, sq) === false
  && pointInPolygon({ x: -1, y: 5 }, sq) === false);
// Mirroring must move a SIDE door and must NOT move an END one.
const sideU = { id: 'S', model: 's', widthFt: 12, lengthFt: 42, at: { x: 0, y: 0 }, rotDeg: 0, entry: 'side', hitch: 'far-end' };
const endU = { ...sideU, entry: 'end' };
check('mirroring flips a side door to the opposite long wall',
  near(doorFacing(sideU).x, 1) && near(doorFacing({ ...sideU, mirrored: true }).x, -1));
check('but mirroring cannot move an END door — it is in the gable',
  near(doorFacing(endU).y, -1) && near(doorFacing({ ...endU, mirrored: true }).y, -1));
// The whole reason mirroring is worth buying.
check('mirroring leaves the exit direction untouched',
  JSON.stringify(towSweep(sideU)) === JSON.stringify(towSweep({ ...sideU, mirrored: true })));
check('whereas rotating 180 degrees moves the door AND reverses the exit',
  near(doorFacing({ ...sideU, rotDeg: 180 }).x, -1)
  && JSON.stringify(towSweep(sideU)) !== JSON.stringify(towSweep({ ...sideU, rotDeg: 180 })));
check('the door sits on the face of the unit, not at its centre',
  near(doorPoint(sideU).x, 6) && near(doorPoint(endU).y, -21));

console.log('mirroring is a volume unlock, so it is recorded as a constraint');
check('three layouts need reversed plans, and the rest do not',
  buildable.filter(requiresMirroring).map((l) => l.id).sort().join(',')
  === 'contour-line-three,parallel-open,u-court');
check('the contour line needs all three units reversed',
  mirroredUnits(layoutById('contour-line-three')).length === 3);
check('customisation unlocks at ten units, and nine is not ten',
  CUSTOMISATION.unlockAtUnits === 10
  && customisationAvailableAt(10) === true && customisationAvailableAt(9) === false);
check('the single-unit position is quoted, not paraphrased',
  /[Nn]ot customizable when ordered as a single unit/.test(CUSTOMISATION.singleUnit));
check('and what mirroring actually buys is stated',
  /without spending tow direction/.test(CUSTOMISATION.whatMirroringBuys));

console.log('units sit square — no angled pads, no bevelled framing');
check('orthogonal-only is declared and every layout obeys it',
  ORTHOGONAL_ONLY === true && LAYOUTS.every(isOrthogonal));
check('and the check would actually catch a splayed unit',
  isOrthogonal({ units: [{ rotDeg: 14 }] }) === false && isOrthogonal({ units: [{ rotDeg: -90 }] }) === true);

console.log('the manufacturer\'s own pad and access requirements');
check('the pad is stone 4-5 in or concrete 4-6 in, running 1 ft past the unit',
  PAD_SPEC.stoneDepthIn[0] === 4 && PAD_SPEC.stoneDepthIn[1] === 5
  && PAD_SPEC.concreteDepthIn[0] === 4 && PAD_SPEC.concreteDepthIn[1] === 6
  && PAD_SPEC.marginPastUnitFt === 1);
// The finding that settles the elevated-cabin question on non-tax grounds.
check('the maker forbids pier and beam, crawl space and pit foundations',
  PROHIBITED_FOUNDATIONS.length === 3
  && ['pier and beam', 'crawl space', 'pit'].every((f) => PROHIBITED_FOUNDATIONS.includes(f)));
check('so a post frame under the unit is not an allowed foundation',
  foundationAllowed('timber pier and beam frame') === false
  && foundationAllowed('crawl space') === false
  && foundationAllowed('crushed stone pad') === true);
check('and the wheels stay attached, blocked up rather than bearing',
  /must remain ATTACHED to its wheels/.test(PAD_SPEC.wheelsStayOn)
  && /not RESTING on its wheels/.test(PAD_SPEC.blocking));
check('access is 18 ft wide with 16 ft of clearance both ways',
  DELIVERY_ACCESS.straightWidthFt === 18 && DELIVERY_ACCESS.straightClearanceFt === 16
  && DELIVERY_ACCESS.verticalClearanceFt === 16);
// The corner figure is not a constant — it is the road argument, quantified.
check('corner clearance is DERIVED from the unit width, not stored',
  cornerClearanceFt(8.5) === 24.5 && cornerClearanceFt(12) === 28 && cornerClearanceFt(0) === 16);
check('and the narrow unit saves real width at every corner',
  cornerSavingFt(13.83, 8.5) === 5.33 && cornerSavingFt(12, 8.5) === 3.5
  && cornerSavingFt(8.5, 8.5) === 0);
check('delivery is curbside by default and site prep is the customer\'s scope',
  DELIVERY_ACCESS.notes.some((n) => /Curbside is the delivery policy/.test(n))
  && DELIVERY_ACCESS.notes.some((n) => /does not do site preparation/.test(n)));

if (failures > 0) { console.error(`\nsite-composition battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nsite-composition battery clean');
