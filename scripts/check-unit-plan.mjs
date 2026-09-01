// Battery for the kit unit — the product itself.
//
// Everything else in lib/kit takes geometry as given and asks whether it can be
// bought, lifted or stood up. This module decides the geometry, so its errors
// are product errors, and the dangerous ones are all self-consistent: a smaller
// building that every other gate happily measures.
//
// The thesis being gated: extra sleeping space goes UP or OUT, and the ROOF
// decides which. Never both, never neither, and never independently of the roof.
//
// Usage: node scripts/check-unit-plan.mjs (npm run check:unit-plan)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  buildUnitPlan, sideZone, entryNotch, loftVerdict, isPanelised, WET_WALL_ID,
  APPENDIX_Q_MAX_SQFT, HEIGHT, MIN_AREA,
} = await import(join(root, 'lib/kit/unit-plan.ts'));
const { buildPanelSpec, roofHeightAtFt, roofProfileAreaSqFt } = await import(join(root, 'lib/kit/panel-spec.ts'));
const { buildPileSchedule, CHEROKEE_GROUND_SNOW, CHEROKEE_WIND } =
  await import(join(root, 'lib/kit/foundation.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

const TALL = [['a-frame', 1, 17.33], ['saltbox', 1, 17.33]];
const LOW = [['barn', 8, 16], ['gable', 8, 14], ['hip', 8, 14], ['shed', 8, 12]];
const ALL = [...TALL, ...LOW];
const W = 20, D = 22;
const plan = (style, eaveFt, ridgeFt, lockOff = true) =>
  buildUnitPlan({ planId: `kit-${style}`, widthFt: W, depthFt: D, roof: { style, eaveFt, ridgeFt }, lockOff });

console.log('the wet wall is not a panel');
// A SIP has no cavity and is not cut for a stack. If this ever quotes as a
// panel, a manufacturer prices a wall you cannot plumb and nobody finds out
// until the plumber is on site.
check('the wet wall is excluded from panelisation', isPanelised(WET_WALL_ID) === false);
check('every other run IS panelised', isPanelised('ext-n') && isPanelised('iw-lockoff'));
for (const [s, e, r] of ALL) {
  const u = plan(s, e, r);
  check(`${s}: the wet wall exists as a run`, u.wallRuns.some((w) => w.id === WET_WALL_ID));
  // POSITION, not presence. The original form of this check asked only whether
  // the wet wall appeared in the bearing-line list — so a wall emitted in
  // core-local coordinates, landing 3.78 ft off the ridge with its piles under
  // nothing, passed every numeric gate. It took drawing the plan to see it.
  const wet = u.interiorWalls.find((w) => w.id === WET_WALL_ID);
  check(`${s}: the wet wall is a bearing line the foundation sees`, Boolean(wet));
  check(`${s}: and it sits ON the ridge, in full-width coordinates`,
    Boolean(wet) && Math.abs(wet.span.x1 - u.foundationFootprint.widthFt / 2) < 0.01,
    `x=${wet?.span.x1} vs ridge at ${u.foundationFootprint.widthFt / 2}`);
  check(`${s}: it runs the full depth, so it clears the bearing threshold`,
    Boolean(wet) && Math.abs(wet.span.z2 - wet.span.z1 - u.config.depthFt) < 0.01);
  // The end-to-end consequence, which is the thing that actually matters.
  const sch = buildPileSchedule({
    planId: u.planId, footprint: u.foundationFootprint, interiorWalls: u.interiorWalls,
    eaveHeightFt: e, snow: CHEROKEE_GROUND_SNOW, wind: CHEROKEE_WIND,
  });
  check(`${s}: piles actually land on the wet wall`,
    sch.bearingLinesFt.some((l) => Math.abs(l - u.foundationFootprint.widthFt / 2) < 0.01),
    `lines ${JSON.stringify(sch.bearingLinesFt)}`);
  check(`${s}: no interior wall falls outside the roof span`,
    u.interiorWalls.every((w) => w.span.x1 >= -0.01 && w.span.x2 <= u.foundationFootprint.widthFt + 0.01
      && w.span.z1 >= -0.01 && w.span.z2 <= u.config.depthFt + 0.01),
    JSON.stringify(u.interiorWalls.map((w) => w.span)));
  check(`${s}: the plan says plainly it is not panelised`,
    u.notes.some((n) => /NOT PANELISED/.test(n)));
}

console.log('the foundation spans the roof, not the heated core');
// The error this catches was made while writing this module: founding only the
// enclosed core leaves the decks and the roof edge above them on nothing, while
// every other gate still passes because each measures a smaller, self-consistent
// building.
for (const [s, e, r] of ALL) {
  const u = plan(s, e, r);
  check(`${s}: foundation spans the full roof width`, u.foundationFootprint.widthFt === W,
    `${u.foundationFootprint.widthFt} vs ${W}`);
  check(`${s}: which is never narrower than the heated core`,
    u.foundationFootprint.widthFt >= u.coreWidthFt);
}
const deckPlan = plan(...TALL[0]);
check('a decked unit founds wider than it encloses',
  deckPlan.foundationFootprint.widthFt > deckPlan.coreWidthFt,
  `${deckPlan.foundationFootprint.widthFt} vs ${deckPlan.coreWidthFt}`);

console.log('up or out — the roof decides, and it is exclusive');
for (const [s, e, r] of TALL) {
  const u = plan(s, e, r);
  check(`${s}: side strip is a DECK, not a room`, u.sides.west.use === 'deck', u.sides.west.use);
  check(`${s}: because almost none of it clears ${HEIGHT.habitableFt} ft`,
    u.sides.west.usableFraction < 0.5, String(u.sides.west.usableFraction));
  check(`${s}: and the volume overhead carries a LOFT`, u.loft.possible === true, u.loft.reason);
}
for (const [s, e, r] of LOW) {
  const u = plan(s, e, r);
  check(`${s}: the wall runs full height, so a side BEDROOM works`, u.sides.west.use === 'bedroom');
  check(`${s}: there is no low side strip at all`, u.sides.west.depthFt === 0);
  check(`${s}: and no usable volume overhead, so no loft`, u.loft.possible === false);
}
// The thesis, asserted as an exclusive-or across every roof.
for (const [s, e, r] of ALL) {
  const u = plan(s, e, r);
  const up = u.loft.possible, out = u.sides.west.use === 'bedroom';
  check(`${s}: exactly one of loft / side bedroom, never both or neither`, up !== out,
    `loft=${up} sideBedroom=${out}`);
}

console.log('a side door needs a face, and gets one without cutting the roof');
for (const [s, e, r] of TALL) {
  const u = plan(s, e, r);
  check(`${s}: a notch is required`, u.notch.insetFt > 0, String(u.notch.insetFt));
  check(`${s}: and it costs floor area, which is stated`, u.notch.areaSqFt > 0);
  // The whole point of the notch over a dormer.
  check(`${s}: the door lands on a real wall, never a roof plane`,
    u.wallRuns.filter((w) => w.openings.length).every((w) => w.profile !== 'slope'));
  check(`${s}: the note says a dormer is the alternative and why it is worse`,
    u.notes.some((n) => /dormer/.test(n) && /flashing|NO hole/.test(n)));
}
for (const [s, e, r] of LOW) {
  const u = plan(s, e, r);
  check(`${s}: no notch needed — the wall already clears a door`, u.notch.insetFt === 0);
}
for (const [s, e, r] of ALL) {
  const u = plan(s, e, r);
  const doors = u.wallRuns.flatMap((w) => w.openings).filter((o) => o.type === 'door');
  check(`${s}: two doors, one per side`, doors.length === 2, String(doors.length));
  check(`${s}: on opposite walls`,
    u.wallRuns.filter((w) => w.openings.some((o) => o.type === 'door')).map((w) => w.id).sort().join(',') === 'ext-e,ext-w');
}

console.log('the code path follows the enclosed area, and the deck is what moves it');
for (const [s, e, r] of TALL) {
  const u = plan(s, e, r);
  check(`${s}: decks are outside the envelope, so enclosed < roofed`,
    u.enclosedSqFt < W * D, `${u.enclosedSqFt} vs ${W * D}`);
  check(`${s}: which lands it under ${APPENDIX_Q_MAX_SQFT} sq ft`,
    u.enclosedSqFt <= APPENDIX_Q_MAX_SQFT && u.codePath === 'appendix-q', `${u.enclosedSqFt}`);
  check(`${s}: so the loft answers to Appendix Q, not R305.1.1`,
    u.loft.codePath === 'appendix-q' && /NO headroom rule/.test(u.loft.reason));
}
for (const [s, e, r] of LOW) {
  const u = plan(s, e, r);
  check(`${s}: no deck, so the full plate is enclosed and it is full IRC`,
    u.enclosedSqFt > APPENDIX_Q_MAX_SQFT && u.codePath === 'full-irc', `${u.enclosedSqFt}`);
}
// The threshold has to actually bite in both directions.
const tiny = loftVerdict({ style: 'a', eaveFt: 1, ridgeFt: 17.33 }, 20, 22, APPENDIX_Q_MAX_SQFT, 8.42);
const big = loftVerdict({ style: 'a', eaveFt: 1, ridgeFt: 17.33 }, 20, 22, APPENDIX_Q_MAX_SQFT + 1, 8.42);
check('at exactly 400 sq ft Appendix Q applies', tiny.codePath === 'appendix-q');
check('one square foot over, it does not', big.codePath === 'full-irc');
// NOT "and that costs the loft" — that was this battery's own wrong assumption.
// One square foot over the threshold does not delete the loft at this width, it
// makes it expensive: R305.1.1 forces enough depth to put half the area at 7 ft.
// Asserting the loft vanished would have been asserting a falsehood, and the
// real effect is bigger news than the false one.
check('crossing the threshold keeps the loft but multiplies the depth it needs',
  big.possible === true && big.depthFt > tiny.depthFt * 3,
  `${tiny.depthFt} ft under Appendix Q vs ${big.depthFt} ft under full IRC`);
check('and the reason names the rule that did it',
  /R305\.1\.1/.test(big.reason) && /Appendix Q/.test(tiny.reason));

console.log('one core, six roofs, one foundation');
const scheds = ALL.map(([s, e, r]) => {
  const u = plan(s, e, r);
  return buildPileSchedule({
    planId: u.planId, footprint: u.foundationFootprint, interiorWalls: u.interiorWalls,
    eaveHeightFt: e, snow: CHEROKEE_GROUND_SNOW, wind: CHEROKEE_WIND,
  });
});
const counts = [...new Set(scheds.map((s) => s.piles.length))];
check('pile count is identical across every roof', counts.length === 1, counts.join('/'));
const loads = scheds.map((s) => s.maxServiceLoadLb);
check('and the governing load spreads under 25%',
  Math.max(...loads) / Math.min(...loads) < 1.25,
  `${Math.min(...loads)}-${Math.max(...loads)} lb`);
// The panel spec must still accept what this module emits.
for (const [s, e, r] of ALL) {
  const u = plan(s, e, r);
  const spec = buildPanelSpec({
    planId: u.planId, footprint: { widthFt: u.coreWidthFt, depthFt: D },
    wallRuns: u.wallRuns, roofPlanes: u.roofPlanes, nominalThicknessIn: 4.5,
  });
  check(`${s}: the panel spec consumes the unit unchanged`, spec.wallRuns.length === u.wallRuns.length);
}

console.log('every wall stands at the roof height for its position, never at the eave');
// The first emitter used the eave for every wall. On the a-frame that quoted
// the 7.17 ft side walls at 22 sq ft, made the lock-off divider 1 ft tall, and
// took the inset gable ends as eave-to-ridge triangles (114) instead of the
// core-line-to-ridge trapezoids they are (152). Every gate passed, because none
// asked WHERE a wall stood.
for (const [s, e, r] of ALL) {
  const u = plan(s, e, r);
  const roof = { eaveFt: e, ridgeFt: r };
  const half = u.coreWidthFt / 2;
  const w = (id) => u.wallRuns.find((x) => x.id === id);
  const sideH = roofHeightAtFt(roof, W, half);
  check(`${s}: side walls stand at the core line (${sideH.toFixed(2)} ft), area = depth x that`,
    Math.abs(w('ext-w').heightFt - sideH) < 0.02 && Math.abs(w('ext-w').grossAreaSqFt - D * sideH) < 0.1
      && Math.abs(w('ext-e').grossAreaSqFt - D * sideH) < 0.1,
    `${w('ext-w').heightFt} / ${w('ext-w').grossAreaSqFt}`);
  const across = roofProfileAreaSqFt(roof, W, -half, half);
  for (const id of ['ext-n', 'ext-s', 'iw-lockoff']) {
    check(`${s}: ${id} is the core's roof profile (${across.toFixed(1)} sq ft)`,
      Math.abs(w(id).grossAreaSqFt - across) < 0.1, String(w(id).grossAreaSqFt));
  }
  check(`${s}: the wet wall rises to the ridge`, Math.abs(w(WET_WALL_ID).heightFt - r) < 0.02, String(w(WET_WALL_ID).heightFt));
}
// On a decked variant NOTHING sits at the eave, so length x eave is always wrong.
for (const [s, e, r] of TALL) {
  const u = plan(s, e, r);
  check(`${s}: no wall is quoted at length x eave`,
    u.wallRuns.every((x) => x.grossAreaSqFt > x.lengthFt * e + 0.5),
    u.wallRuns.filter((x) => x.grossAreaSqFt <= x.lengthFt * e + 0.5).map((x) => x.id).join(','));
}
// The exact figures that were wrong, pinned.
const af = plan(...TALL[0]);
check('a-frame side wall is ~157.7 sq ft, not 22', Math.abs(af.wallRuns.find((x) => x.id === 'ext-w').grossAreaSqFt - 157.74) < 0.1);
check('a-frame core gable end is the ~152 sq ft trapezoid, not the 114 sq ft eave triangle',
  Math.abs(af.wallRuns.find((x) => x.id === 'ext-n').grossAreaSqFt - 152.41) < 0.1);
check('lock-off divider is a real wall, not 1 ft tall', af.wallRuns.find((x) => x.id === 'iw-lockoff').heightFt > 10);

console.log('the lock-off says what it is, and what it might trigger');
const locked = plan('gable', 8, 14, true);
const open = plan('gable', 8, 14, false);
check('lock-off adds a divider', locked.wallRuns.some((w) => w.id === 'iw-lockoff'));
check('and without it there is none', !open.wallRuns.some((w) => w.id === 'iw-lockoff'));
check('the divider is a bearing line too', locked.interiorWalls.some((w) => w.id === 'iw-lockoff'));
// Same coordinate trap: the divider spans the CORE, but in full-width terms.
const deckPlanLocked = plan(...TALL[0], true);
const div = deckPlanLocked.interiorWalls.find((w) => w.id === 'iw-lockoff');
check('the divider starts at the core edge, not at the roof edge',
  Math.abs(div.span.x1 - deckPlanLocked.sides.west.depthFt) < 0.01,
  `x1=${div.span.x1} vs core edge ${deckPlanLocked.sides.west.depthFt}`);
check('and ends at the far core edge',
  Math.abs(div.span.x2 - (deckPlanLocked.foundationFootprint.widthFt - deckPlanLocked.sides.west.depthFt)) < 0.01,
  `x2=${div.span.x2}`);
check('so its length equals the core width, not the roof width',
  Math.abs((div.span.x2 - div.span.x1) - deckPlanLocked.coreWidthFt) < 0.01);
check('and the two-dwelling-unit question is raised, not buried',
  locked.notes.some((n) => /two dwelling units/i.test(n) && /ask before building/i.test(n)));

if (failures) {
  console.error(`${failures} unit-plan check(s) failed`);
  process.exit(1);
}
console.log('unit-plan battery clean (the product model)');
