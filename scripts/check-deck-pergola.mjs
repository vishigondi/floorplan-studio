// Battery for the covered screened deck around a park model.
//
// The unit is a vehicle, so the deck's whole legitimacy rests on rules that are
// binary and easy to violate silently: it must not touch the unit, its screens
// must not become walls, and a floor set to the unit's height drags guards and
// bracing in with it. The first version of this module also placed posts on
// only the OUTER girder line — leaving every inner girder bearing on the RV or
// on nothing — and every number still looked plausible. So the assertions here
// are about WHERE things are, not whether they exist.
//
// Usage: node scripts/check-deck-pergola.mjs (npm run check:deck-pergola)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { buildDeckPlan, renderDeckTender, girderSpanFt, ZOOK_A_FRAME_CLASSIC, APPENDIX_M, ZIPPER_SCREEN } =
  await import(join(root, 'lib/kit/deck-pergola.ts'));
const { CHEROKEE_WIND, CHEROKEE_GROUND_SNOW } = await import(join(root, 'lib/kit/foundation.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

const base = {
  unit: ZOOK_A_FRAME_CLASSIC,
  depthFt: { doorSide: 8, farSide: 6, endA: 6, endB: 6 },
  airGapIn: 6, pergolaClearFt: 9.5,
  wind: CHEROKEE_WIND, groundSnow: CHEROKEE_GROUND_SNOW, roofLivePsf: 20,
  screened: { doorSide: true, farSide: true, endA: true, endB: true },
};
const plan = buildDeckPlan(base);
const u = plan.unit, gap = plan.airGapIn / 12;
// The unit's footprint in the ring frame.
const ux0 = base.depthFt.doorSide + gap, ux1 = ux0 + u.widthFt;
const uz0 = base.depthFt.endA + gap, uz1 = uz0 + u.lengthFt;

console.log('the deck never touches the vehicle');
check('an air gap exists', plan.airGapIn > 0);
check('NO post stands inside the unit footprint',
  plan.postsXY.every(([x, z]) => !(x > ux0 + 0.01 && x < ux1 - 0.01 && z > uz0 + 0.01 && z < uz1 - 0.01)),
  plan.postsXY.filter(([x, z]) => x > ux0 && x < ux1 && z > uz0 && z < uz1).map((p) => p.join(',')).join(' '));
check('every post is inside the deck ring',
  plan.postsXY.every(([x, z]) => x >= -0.01 && x <= plan.outerWidthFt + 0.01 && z >= -0.01 && z <= plan.outerLengthFt + 0.01));
check('the plan says free-standing, no fastener into the vehicle',
  plan.notes.some((n) => /FREE-STANDING/.test(n) && /no fastener/i.test(n)));
check('and that screens are not walls', plan.notes.some((n) => /SCREENS ARE NOT WALLS/.test(n)));

console.log('the roof cannot pass through the unit — the bug the drawing found');
// An A-frame ridge at 13.5 ft is above a 12.5 ft beam. The first version put
// one roof over the whole ring anyway; the section showed the apex poking
// through it. Coverage is now DERIVED from the unit's height against the beam.
check('the Zook A-frame is taller than the pergola beam',
  plan.unit.transportHeightFt > plan.pergola.beamAboveGradeFt, `${plan.unit.transportHeightFt} vs ${plan.pergola.beamAboveGradeFt}`);
check('so the pergola covers the DECK only, not the unit', plan.pergola.coversUnit === false);
check('and the roof area equals the deck area, not the ring', Math.abs(plan.pergola.roofAreaSqFt - plan.deckAreaSqFt) < 0.01,
  `${plan.pergola.roofAreaSqFt} vs ${plan.deckAreaSqFt}`);
check('the note says it abuts the unit roof and is never fastened', plan.notes.some((n) => /COVERS THE DECK ONLY/.test(n) && /never fastened/.test(n)));
const lowBox = buildDeckPlan({ ...base, unit: { ...ZOOK_A_FRAME_CLASSIC, transportHeightFt: 11 } });
check('a low unit under the beam DOES get one roof over everything', lowBox.pergola.coversUnit === true
  && lowBox.pergola.roofAreaSqFt > lowBox.deckAreaSqFt);
// The drawing also showed the strips-only roof leaves the deck edge under the
// unit's runoff — an A-frame's eave is at deck level. The plan must SAY so and
// price the fix, not leave it for the first storm.
check('strips-only carries a runoff warning', plan.notes.some((n) => /RUNOFF WARNING/.test(n)));
check('and derives the clear height that would span the unit', plan.pergola.clearToSpanUnitFt > plan.pergola.clearFt
  && Math.abs(plan.pergola.clearToSpanUnitFt - (plan.unit.transportHeightFt + 1 - plan.floorAboveGradeIn / 12)) < 0.01,
  String(plan.pergola.clearToSpanUnitFt));
const spanning = buildDeckPlan({ ...base, pergolaClearFt: plan.pergola.clearToSpanUnitFt });
check('at that clear height one roof covers everything', spanning.pergola.coversUnit === true
  && spanning.pergola.roofAreaSqFt > spanning.deckAreaSqFt);
check('and the runoff warning goes away', !spanning.notes.some((n) => /RUNOFF WARNING/.test(n)));
check('but it now adds to the Part 77 declaration, and says so',
  spanning.pergola.topAboveGradeFt > spanning.unit.transportHeightFt && spanning.notes.some((n) => /declare the pergola, not the unit/.test(n)));
check('screens still fit the module at the taller clear height', spanning.pergola.clearFt <= ZIPPER_SCREEN.maxPanelHeightFt);
check('posts still within the 6x6 table at the taller height', spanning.postHeightFt <= APPENDIX_M.postMaxHeightFt['6x6']);
check('a post face never comes within 2 in of the vehicle', plan.postFaceClearanceIn >= 2, `${plan.postFaceClearanceIn} in`);
const tight = buildDeckPlan({ ...base, airGapIn: 2 });
check('a 2 in gap is reported as negative clearance for a 6x6, not hidden', tight.postFaceClearanceIn < 0, `${tight.postFaceClearanceIn} in`);

console.log('every girder line has posts — the bug the first version had');
for (const s of plan.sides) {
  check(`${s.id}: two girder lines`, s.post.lines === 2 && s.postsXY.length === s.post.perLine * 2);
  check(`${s.id}: joist span within the ${APPENDIX_M.joistSpanFt['2x10']} ft 2x10 table`,
    s.joist.spanFt <= APPENDIX_M.joistSpanFt['2x10']);
  const allow = girderSpanFt(s.post.girder, s.joist.spanFt);
  check(`${s.id}: post spacing ${s.bayWidthFt} ft within the girder table's ${allow} ft`,
    s.bayWidthFt <= allow + 0.01);
  // both lines must actually be distinct — not the same line counted twice
  const xs = new Set(s.postsXY.map(([x]) => x)), zs = new Set(s.postsXY.map(([, z]) => z));
  check(`${s.id}: the two lines are ${s.depthFt} ft apart`,
    (s.id.startsWith('end') ? zs.size : xs.size) === 2);
}
check('unique posts equal the pile count', plan.postsXY.length === plan.piles.count);
check('no two posts share a position',
  new Set(plan.postsXY.map((p) => p.join(','))).size === plan.postsXY.length);
check('the Zook default config yields 28 posts, not the 12 the outer-line-only model gave',
  plan.piles.count === 28, String(plan.piles.count));

console.log('the floor height drags the code with it — derived, not chosen');
check('at 36 in the guards are required', plan.guardsRequired && plan.guardMinIn === APPENDIX_M.guardMinIn);
check('and lateral bracing is required', plan.lateralBracingRequired);
const low = buildDeckPlan({ ...base, unit: { ...ZOOK_A_FRAME_CLASSIC, floorAboveGradeIn: 24 } });
check('at 24 in (deck-between chassis) neither is', !low.guardsRequired && !low.lateralBracingRequired);
check('the notes tie both to the floor height', plan.notes.some((n) => /GUARDS REQUIRED/.test(n) && /36 in above grade/.test(n))
  && plan.notes.some((n) => /LATERAL BRACING REQUIRED/.test(n)));
check('posts are 6x6 because they carry the pergola above the deck',
  plan.postSize === '6x6' && plan.postHeightFt > APPENDIX_M.postMaxHeightFt['4x4']);

console.log('every bay is one screen panel');
check('all bays within the screen module', plan.sides.every((s) => s.screenPanelOk && s.bayWidthFt <= ZIPPER_SCREEN.maxPanelWidthFt));
check('clear height within the screen module', plan.pergola.clearFt <= ZIPPER_SCREEN.maxPanelHeightFt);
// A long run must be split rather than exceed a panel.
const long = buildDeckPlan({ ...base, unit: { ...ZOOK_A_FRAME_CLASSIC, lengthFt: 60 } });
check('a 60 ft unit still yields bays under 25 ft', long.sides.every((s) => s.bayWidthFt <= 25));

console.log('wind goes to the frame; the mesh retracts');
check('frame designed to the site wind, screens retracted',
  plan.spec.frame.windMph === CHEROKEE_WIND.ultimateMph && /retracted/.test(plan.spec.frame.note));
check('screens deploy only to 25 mph and a wind sensor is required',
  plan.spec.screens.deployMaxMph === 25 && plan.spec.screens.windSensor === true);
check('the note says the frame, not the mesh, takes the wind', plan.notes.some((n) => /THE FRAME, NOT THE MESH/.test(n)));
check('roof governed by roof live at the site snow', plan.spec.roof.governedBy === 'roof live');
const snowy = buildDeckPlan({ ...base, groundSnow: { psf: 60, sourced: true, citation: 'test' } });
check('and snow takes over when it should', snowy.spec.roof.governedBy === 'snow');
check('piles are quoted for tension — a roof at 115 mph pulls up', plan.piles.tensionRequired === true
  && plan.notes.some((n) => /UPLIFT/.test(n)));
check('the pergola adds nothing to the Part 77 declaration',
  plan.pergola.topAboveGradeFt <= plan.unit.transportHeightFt + 0.01,
  `${plan.pergola.topAboveGradeFt} vs ${plan.unit.transportHeightFt}`);
check('sequence: unit first, deck after', plan.notes.some((n) => /deliver and level the unit FIRST/.test(n)));
check('frost depth is marked UNCONFIRMED, not assumed', plan.notes.some((n) => /UNCONFIRMED/.test(n)));

console.log('the tender is faithful and names no product');
const doc = renderDeckTender(plan, { deliverTo: 'Andrews, NC' });
for (const s of plan.sides) check(`tender carries ${s.id}`, doc.includes(`| ${s.id} |`));
check('tender carries the pile count and tension', doc.includes(`${plan.piles.count} helical piles`) && /tension capacity to be quoted/.test(doc));
check('tender requires the wind sensor', /Wind sensor \| \*\*required\*\*/.test(doc));
check('tender has a bid form with a currency column', /## Your quote/.test(doc) && /\| Currency \|/.test(doc));
for (const brand of ['zook', 'phantom', 'mirage', 'progressive', 'struxure', 'azenco', 'renson', 'magnatrack']) {
  check(`tender names no brand ("${brand}")`, !doc.toLowerCase().replace(/a-frame classic \(park model\)/, '').includes(brand));
}
check('tender says screens are not walls', /SCREENS ARE NOT WALLS/.test(doc));

if (failures) { console.error(`${failures} deck-pergola check(s) failed`); process.exit(1); }
console.log('deck-pergola battery clean');
