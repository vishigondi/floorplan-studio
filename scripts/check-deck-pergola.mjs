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
const { buildDeckPlan, renderDeckTender, girderSpanFt, ZOOK_A_FRAME_CLASSIC, APPENDIX_M, ZIPPER_SCREEN, OPEN_DECK, PREFAB_PANEL, GUARD, DECK_BOARD_DIRECTION, OBSERVED_COMPARABLE, PARK_MODEL_ENVELOPE, fitsEnvelope, CANTILEVER, checkCantilever, BALANCED_CANTILEVER, balancedSpanFor } =
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
  screened: { doorSide: true, farSide: false, endA: false, endB: false },
  pergolaZone: { side: 'doorSide', startFt: 11, lengthFt: 20 },
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

console.log('the deck stays OPEN — a tax rule, not a preference');
// The deal position is "three park models linked by open decks, no Whiteco
// argument"; the deck pods are §1245, 5-year lane. Roofing the whole deck is
// what a Whiteco inherently-permanent argument feeds on.
check('the pergola covers a zone, not the ring',
  plan.pergola.roofAreaSqFt < plan.deckAreaSqFt * OPEN_DECK.maxCoveredFraction,
  `${plan.pergola.roofAreaSqFt} of ${plan.deckAreaSqFt}`);
check(`covered fraction within the ${Math.round(OPEN_DECK.maxCoveredFraction * 100)}% working cap`,
  plan.openness.withinOpenDeckRule === true, `${Math.round(plan.openness.coveredFraction * 100)}%`);
check('the plan cites the tax rule and defers to the tax workstream',
  plan.notes.some((n) => /THE DECK STAYS OPEN, AND THAT IS A TAX RULE/.test(n) && /Whiteco/.test(n)
    && /tax workstream, not with me/.test(n)));
check('the roof never crosses the unit', plan.pergola.coversUnit === false
  && plan.notes.some((n) => /never crosses the unit and never links two units/.test(n)));
const huge = buildDeckPlan({ ...base, pergolaZone: { side: 'doorSide', startFt: 0, lengthFt: 42 } });
check('an over-large zone is flagged, not silently accepted',
  huge.openness.withinOpenDeckRule === false && huge.notes.some((n) => /OVER IT/.test(n)),
  `${Math.round(huge.openness.coveredFraction * 100)}%`);
let threw = null;
try { buildDeckPlan({ ...base, depthFt: { ...base.depthFt, endA: 0 }, pergolaZone: { side: 'endA', startFt: 0, lengthFt: 8 } }); }
catch (e) { threw = e; }
check('a zone on a side with no deck is refused', threw !== null);

console.log('the pergola carries its OWN posts');
const piles = plan.posts.filter((q) => q.support === 'pile');
check('the zone adds posts beyond the deck grid', plan.posts.length > 28, `${plan.posts.length}`);
check('at least four piles — a roof needs corners', piles.length >= 4, `${piles.length}`);
const zoneZs = piles.map((q) => q.zFt).sort((x, y) => x - y);
check('piles reach both ends of the zone',
  Math.abs(zoneZs[0] - 11) < 0.05 && Math.abs(zoneZs[zoneZs.length - 1] - 31) < 0.05, zoneZs.join(','));
check('piles sit on two girder lines',
  new Set(piles.map((q) => q.xFt)).size === 2, [...new Set(piles.map((q) => q.xFt))].join(','));
check('no pile spacing exceeds the screen module',
  Math.max(...zoneZs.slice(1).map((z, i) => z - zoneZs[i])) <= ZIPPER_SCREEN.maxPanelWidthFt);

console.log('the foundation is split by what actually loads it');
check('only pergola posts are piles', plan.foundation.pileCount === piles.length
  && plan.foundation.footingCount === plan.posts.length - piles.length);
check('gravity-only posts get a footing, not a pile', plan.foundation.footingCount === 28, `${plan.foundation.footingCount}`);
check('piles carry more than footings — they take the roof',
  plan.foundation.perPileServiceLb > plan.foundation.perFootingServiceLb);
check('tension is required only because a pergola exists', plan.foundation.tensionRequired === true);
const openOnly = buildDeckPlan({ ...base, pergolaZone: undefined });
check('an open deck needs NO piles at all', openOnly.foundation.pileCount === 0
  && openOnly.foundation.tensionRequired === false && openOnly.pergola.roofAreaSqFt === 0);
check('and says so', openOnly.notes.some((n) => /NO UPLIFT ANYWHERE, so no piles/.test(n)));
check('the note names the expensive default it avoids',
  plan.notes.some((n) => /Piling all/.test(n) && /is the expensive default/.test(n)));
check('footings cite the 12 in App M depth', plan.foundation.footingMinDepthIn === APPENDIX_M.footingMinDepthIn);

console.log('the guard is the view — a height alone does not specify it');
// R312 gives a height and a sphere and says nothing about infill, so "36 in
// guard" invites solid balusters: code-compliant, and they wall off the forest
// the unit is sold on. The observed comparable uses horizontal cable.
check('the guard carries an infill requirement, not just a height',
  plan.guard.viewPreserving === true && plan.guard.minHeightIn === GUARD.minHeightIn);
check('and the 4 in sphere that governs cable spacing', plan.guard.maxOpeningIn === 4);
check('and a durability finish for an exposed mountain site', /corrosion-resistant/.test(plan.guard.finish));
check('the note says solid balusters defeat the purpose',
  plan.notes.some((n) => /THE GUARD IS THE VIEW/.test(n) && /solid balusters/.test(n)));
// NOT `plan.boardDirection === DECK_BOARD_DIRECTION` — that is tautological, and
// emptying the constant passed it. Pin the CONTENT: it has to name a direction
// relative to the unit, and reach the tender.
check('board direction names a real direction, not an empty string',
  /perpendicular|parallel/.test(plan.boardDirection) && /unit/.test(plan.boardDirection),
  JSON.stringify(plan.boardDirection));
// The framing consequence must FOLLOW the direction, not be hardcoded: boards
// always run across their joists, so flipping one flips the other. Hardcoding
// it left the note stating the opposite of the truth when the direction changed.
const boardsPerp = /perpendicular/.test(plan.boardDirection);
check('the note derives the joist direction from the board direction',
  plan.notes.some((n) => /DECKING RUNS/.test(n)
    && (boardsPerp ? /joists run PARALLEL to the wall/.test(n) : /joists run ACROSS the deck depth/.test(n))),
  plan.notes.find((n) => /DECKING RUNS/.test(n))?.slice(0, 100));
const lowNoGuard = buildDeckPlan({ ...base, unit: { ...ZOOK_A_FRAME_CLASSIC, floorAboveGradeIn: 24 } });
check('below 30 in no guard is demanded', lowNoGuard.guard.requiredNow === false);

console.log('a cantilever is decided by statics, not by taste');
// Wood cannot do the photographed look: IRC R507 allows a quarter of the
// backspan. And a long cantilever LIFTS ITS BACK LINE — which reverses the
// "gravity-only decks need no piles" finding for this case, in a different
// place (the inner girder, not the pergola).
const small = checkCantilever(1.5, 6), big = checkCantilever(5, 6);
check('a quarter of the backspan is wood', small.woodOk && small.material === 'wood, App M tables');
// A case BETWEEN the quarter rule and a half, so the threshold itself is tested
// rather than two points either side of a much wider gap. Loosening the rule to
// 0.5 survived until this existed.
const justPast = checkCantilever(2, 6); // 33% — steel under R507, wood under a 0.5 rule
check('a third of the backspan is already past the joist rule',
  justPast.woodOk === false && /PE stamp/.test(justPast.material), `${Math.round(justPast.fraction * 100)}%`);
const atRule = checkCantilever(1.5, 6); // exactly 25%
check('exactly a quarter is still wood', atRule.woodOk === true);
check('a hair over a quarter is not', checkCantilever(1.55, 6).woodOk === false);
check('past a quarter it is engineered steel with a PE stamp',
  big.woodOk === false && /PE stamp/.test(big.material));
check('the wood case does not lift the back line', small.liftsBackLine === false && small.backReactionPlf > 0);
check('the long case does', big.liftsBackLine === true && big.backReactionPlf < 0);
check('the uplift threshold is sqrt(dead/(dead+live)) of the backspan',
  Math.abs(CANTILEVER.upliftFractionOfBackspan - Math.sqrt(10 / 50)) < 1e-9);
// The threshold has to bite in both directions on the same backspan.
const L = 12, justUnder = checkCantilever(L * 0.44, L), justOver = checkCantilever(L * 0.46, L);
check('just under the threshold still bears', justUnder.liftsBackLine === false, `${justUnder.backReactionPlf}`);
check('just over it lifts', justOver.liftsBackLine === true, `${justOver.backReactionPlf}`);
// And it has to change the FOUNDATION, not just a note.
const cantWood = buildDeckPlan({ ...base, cantileverFt: { farSide: 1.5 } });
const cantSteel = buildDeckPlan({ ...base, cantileverFt: { farSide: 5 } });
check('a lifting cantilever adds piles on its back line',
  cantSteel.foundation.pileCount > cantWood.foundation.pileCount,
  `${cantSteel.foundation.pileCount} vs ${cantWood.foundation.pileCount}`);
check('a wood-rule cantilever adds none', cantWood.foundation.pileCount === plan.foundation.pileCount);
check('the note names the tie-down and the reason',
  cantSteel.notes.some((n) => /LIFTS ITS BACK LINE/.test(n) && /TIE-DOWN/.test(n) && /different reason/.test(n)));
check('the cantilever adds deck area',
  cantSteel.sides.find((x) => x.id === 'farSide').areaSqFt
    > plan.sides.find((x) => x.id === 'farSide').areaSqFt);
check('the prefab argument is stated where the cantilever appears',
  cantSteel.notes.some((n) => /BEST PREFAB CANDIDATE HERE/.test(n) && /ONE moment connection/.test(n)));

console.log('scaling a cantilever DOWN saves; scaling it UP costs');
// Moment ∝ c², deflection ∝ c⁴, so reach is the dearest dimension on the deck.
// The saving is the opposite move: cantilever BOTH ways off the same two lines.
for (const D of [6, 10, 12, 14, 18]) {
  const b = balancedSpanFor(D);
  check(`${D} ft deck: balanced backspan is 2/3 of the depth`,
    Math.abs(b.backspanFt - D * 2 / 3) < 0.02 && Math.abs(b.cantileverFt - D / 6) < 0.02);
  check(`${D} ft deck: the balanced case never lifts its supports`,
    b.liftsSupports === false && b.backReactionPlf > 0, `${b.backReactionPlf} plf`);
  check(`${D} ft deck: the backspan is shorter than the single span`, b.backspanFt < b.singleSpanFt);
}
check('a third of a balanced deck stands on nothing',
  Math.abs(BALANCED_CANTILEVER.freeAreaFraction - 1 / 3) < 1e-9);
// The contrast that matters: single long cantilever lifts, balanced does not.
check('a single 5 ft cantilever off a 6 ft backspan LIFTS its back line',
  checkCantilever(5, 6).liftsBackLine === true);
check('the balanced equivalent does not', balancedSpanFor(11).liftsSupports === false);
// And the deeper the deck, the bigger the joist saving.
check('a 12 ft deck drops from a 12 ft span to an 8 ft backspan',
  Math.abs(balancedSpanFor(12).backspanFt - 8) < 0.02);
check('an 18 ft deck drops from beyond the 2x10 table to 12 ft, inside it',
  balancedSpanFor(18).singleSpanFt > APPENDIX_M.joistSpanFt['2x10']
  && balancedSpanFor(18).backspanFt <= APPENDIX_M.joistSpanFt['2x10'],
  `${balancedSpanFor(18).backspanFt}`);
// The advice has to reach the reader at the point they are over-reaching.
const reaching = buildDeckPlan({ ...base, cantileverFt: { farSide: 5 } });
check('an over-reaching cantilever is offered the cheaper arrangement',
  reaching.notes.some((n) => /CHEAPER ALTERNATIVE TO REACHING FURTHER/.test(n)
    && /never lifts its supports/.test(n) && /GROUND will not take a post/.test(n)));
const withinRule = buildDeckPlan({ ...base, cantileverFt: { farSide: 1.5 } });
check('a wood-rule cantilever is not lectured about it',
  !withinRule.notes.some((n) => /CHEAPER ALTERNATIVE/.test(n)));

console.log('the deck is designed to the ENVELOPE, not to one manufacturer');
// Building around one unit locks the site plan to that unit's maker — the same
// lock-in the panel spec exists to avoid, arriving through the back door.
check('the reference unit sits inside the envelope', plan.envelope.fits, plan.envelope.failures.join('; '));
check('the plan says it is designed to the envelope',
  plan.notes.some((n) => /DESIGNED TO THE ENVELOPE, NOT TO THIS UNIT/.test(n)));
// A119.5's 400 sq ft is LIVING AREA IN SETUP MODE, lofts excluded — not the
// exterior box. This module briefly enforced it against width x length and so
// rejected the Factory Expo Mexia (15 x 34 ft box, 510 sq ft, a real and legal
// park model). The exterior bounds and the ANSI rule are different measures.
check('a real 15 x 34 ft park model is accepted, not refused on box area',
  fitsEnvelope({ ...ZOOK_A_FRAME_CLASSIC, widthFt: 15, lengthFt: 34 }).fits === true,
  fitsEnvelope({ ...ZOOK_A_FRAME_CLASSIC, widthFt: 15, lengthFt: 34 }).failures.join(';'));
check('the ANSI cap is carried as context, not enforced against the box',
  PARK_MODEL_ENVELOPE.ansiLivingAreaCapSqFt === 400
  && !('maxLengthAtWidthFt' in PARK_MODEL_ENVELOPE));
check('and the distinction is stated where a reader will hit it',
  plan.notes.some((n) => /living area in setup mode/.test(n)));
check('a unit taller than the road limit is refused',
  fitsEnvelope({ ...ZOOK_A_FRAME_CLASSIC, transportHeightFt: 15 }).fits === false);
check('an out-of-envelope unit is flagged as a one-off, not silently built',
  buildDeckPlan({ ...base, unit: { ...ZOOK_A_FRAME_CLASSIC, widthFt: 20 } })
    .notes.some((n) => /OUTSIDE THE ENVELOPE/.test(n) && /one-off for one model/.test(n)));
// One design across the legal set: more of the same parts, never different ones.
for (const [W, L] of [[12, 29], [12, 33], [13.83, 29.17], [15, 34]]) {
  const p2 = buildDeckPlan({ ...base, unit: { ...ZOOK_A_FRAME_CLASSIC, widthFt: W, lengthFt: L } });
  check(`${W} x ${L}: same details, only the count changes`,
    p2.envelope.fits && p2.postSize === plan.postSize && p2.foundation.pileCount === plan.foundation.pileCount
      && p2.sides.every((x) => x.joist.size === '2x10' && x.bayWidthFt <= 25),
    p2.envelope.failures.join(';'));
}

console.log('the observed comparable is recorded as observation, not as approval');
// Photographs of the nearest working resort show posts on precast/poured pier
// blocks at grade — no piles. That supports splitting the foundation by load.
// It does NOT show what is under the blocks, and a photo cannot approve a
// footing detail, so the unresolved part has to travel with the finding.
check('the observed deck foundation is recorded', /pier blocks at grade/.test(OBSERVED_COMPARABLE.deckFoundation));
check('and reaches the plan notes', plan.notes.some((n) => /THE OPERATING COMPARABLE USES/.test(n)));
check('the note carries what a photograph cannot settle',
  plan.notes.some((n) => /THE OPERATING COMPARABLE USES/.test(n) && /12 in\s*\n?\s*below finished grade|12 in below finished grade/.test(n)
    && /Ask the operator and the inspector, not the photo/.test(n)));
check('it does not silently become permission to skip the footing depth',
  plan.foundation.footingMinDepthIn === APPENDIX_M.footingMinDepthIn);
check('the comparable notes they built no pergola', /none/.test(OBSERVED_COMPARABLE.pergola));

console.log('site labour is minimised by prefabrication');
// NOT just "> 0". A count unrelated to the area passes that, and did: replacing
// the take-off with sides.length survived. The count has to be consistent with
// the deck it is panelising.
const maxPanelSqFt = PREFAB_PANEL.maxWidthFt * PREFAB_PANEL.maxLengthFt;
check('the panel count could actually cover the deck',
  plan.prefab.panelCount >= Math.ceil(plan.deckAreaSqFt / maxPanelSqFt),
  `${plan.prefab.panelCount} panels for ${plan.deckAreaSqFt} sq ft (max ${maxPanelSqFt} each)`);
check('and is not absurdly more than the bays it lands on',
  plan.prefab.panelCount <= plan.sides.reduce((t, x) => t + x.bays, 0) * 4);
check('a bigger deck needs more panels',
  buildDeckPlan({ ...base, depthFt: { doorSide: 8, farSide: 8, endA: 8, endB: 8 } }).prefab.panelCount > plan.prefab.panelCount);
check('no panel exceeds what stacks on a truck',
  plan.prefab.maxPanelFt[0] === PREFAB_PANEL.maxWidthFt && plan.prefab.maxPanelFt[1] === PREFAB_PANEL.maxLengthFt);
check('every deck side fits the panel module',
  plan.sides.every((x) => x.depthFt <= PREFAB_PANEL.maxWidthFt && x.bayWidthFt <= PREFAB_PANEL.maxLengthFt),
  plan.sides.filter((x) => x.depthFt > PREFAB_PANEL.maxWidthFt || x.bayWidthFt > PREFAB_PANEL.maxLengthFt).map((x) => x.id).join(','));
check('the note frames field work as setting, not framing',
  plan.notes.some((n) => /SITE LABOUR/.test(n) && /SETTING panels/.test(n)));

console.log('post clearance to the vehicle');
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
check('unique posts equal the post record count', plan.postsXY.length === plan.posts.length);
check('no two posts share a position',
  new Set(plan.postsXY.map((p) => p.join(','))).size === plan.postsXY.length);
check('the deck grid alone is 28 posts, not the 12 the outer-line-only model gave',
  plan.foundation.footingCount === 28, String(plan.foundation.footingCount));

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
check('piles are quoted for tension — a roof at 115 mph pulls up', plan.foundation.tensionRequired === true);
check('the pergola adds nothing to the Part 77 declaration',
  plan.pergola.topAboveGradeFt <= plan.unit.transportHeightFt + 0.01,
  `${plan.pergola.topAboveGradeFt} vs ${plan.unit.transportHeightFt}`);
check('sequence: unit first, deck after', plan.notes.some((n) => /deliver and level the unit FIRST/.test(n)));
check('frost depth is marked UNCONFIRMED, not assumed', plan.notes.some((n) => /UNCONFIRMED/.test(n)));

console.log('the tender is faithful and names no product');
const doc = renderDeckTender(plan, { deliverTo: 'Andrews, NC' });
for (const s of plan.sides) check(`tender carries ${s.id}`, doc.includes(`| ${s.id} |`));
check('tender splits footings from piles', doc.includes(`**${plan.foundation.footingCount}** footings`)
  && doc.includes(`**${plan.foundation.pileCount}** piles`) && /tension capacity to be quoted/.test(doc));
check('tender says piling every post is not required', /is not required/.test(doc));
check('tender prices prefab panels and setting separately',
  /## Prefabrication/.test(doc) && /Shop-built deck panels, delivered/.test(doc) && /Setting panels on site/.test(doc));
check('tender states the deck stays open', /the deck stays OPEN/.test(doc));
check('tender specifies view-preserving guard infill and forbids solid balusters',
  /VIEW-PRESERVING infill/.test(doc) && /do not quote them/.test(doc));
check('tender states the board direction', doc.includes(plan.boardDirection));
check('tender requires the wind sensor', /Wind sensor \| \*\*required\*\*/.test(doc));
check('tender has a bid form with a currency column', /## Your quote/.test(doc) && /\| Currency \|/.test(doc));
for (const brand of ['zook', 'phantom', 'mirage', 'progressive', 'struxure', 'azenco', 'renson', 'magnatrack']) {
  check(`tender names no brand ("${brand}")`, !doc.toLowerCase().replace(/a-frame classic \(park model\)/, '').includes(brand));
}
check('tender says screens are not walls', /SCREENS ARE NOT WALLS/.test(doc));

if (failures) { console.error(`${failures} deck-pergola check(s) failed`); process.exit(1); }
console.log('deck-pergola battery clean');
