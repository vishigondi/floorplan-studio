// Battery for lib/kit/nc-classification.ts.
//
// This module holds the state's own words on whether a park model can be a
// dwelling in North Carolina. It is the governing document for the whole
// programme, so the checks here are mostly about the quotes staying quotes and
// the two routes staying distinguishable — a paraphrase that drifts is how a
// project ends up designing for a rule nobody actually wrote.
//
// Usage: node scripts/check-nc-classification.mjs (npm run check:nc-classification)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  NC_MEMO, TEMPORARY_INSTALLATION, PERMANENT_INSTALLATION, UNLABELLED_OR_SITE_BUILT,
  GROSS_TRAILER_AREA, loftCountsTowardArea, ANSI_DEFINITION, assessNcRoute,
  MANUFACTURER_GATING_QUESTIONS, RV_PARK_WASTEWATER, parkModelDdfGpd, withinLocalReview,
  OWNERSHIP_DECIDES_CLASSIFICATION, TINY_HOME_ROUTE, MOVABLE_HOUSING_ROUTES, routesThatStayMovable,
} = await import(join(root, 'lib/kit/nc-classification.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}

console.log('the memo is identified well enough to be found again');
check('issuer, date and the memo it replaces are all recorded',
  /Office of State Fire Marshal/.test(NC_MEMO.issuer) && NC_MEMO.dated === '2019-01-15'
  && /2015-10-21/.test(NC_MEMO.replaces) && /ncosfm\.gov/.test(NC_MEMO.source));
check('and its audience is named — this is what the inspector reads',
  /Building Inspectors/.test(NC_MEMO.audience));

console.log('the three sentences that govern the site');
// The one that costs the most and has nothing to do with decks.
check('no permanent electrical, plumbing or mechanical connections',
  /cannot have any permanent/.test(TEMPORARY_INSTALLATION.noPermanentConnections)
  && /electrical, plumbing or mechanical connections/.test(TEMPORARY_INSTALLATION.noPermanentConnections));
check('wheels AND axles must remain on the unit at all times',
  /wheels and axles must/.test(TEMPORARY_INSTALLATION.wheelsAndAxlesStayOn)
  && /remain on the unit at all times/.test(TEMPORARY_INSTALLATION.wheelsAndAxlesStayOn));
check('and blocking is allowed, which is the concession that makes it workable',
  /temporarily blocked up and anchored/.test(TEMPORARY_INSTALLATION.wheelsAndAxlesStayOn));
// The deck rule, from the state rather than from a tax argument.
check('accessory structures may not be supported by the unit',
  TEMPORARY_INSTALLATION.accessoryStructures
  === 'Accessory structures may not be supported by these units.');

console.log('the route to a permanent dwelling is a manufacturer capability');
check('an RVIA-only label cannot be a permanent dwelling in NC',
  /cannot be accepted as a permanent/.test(PERMANENT_INSTALLATION.rviaOnlyIsInsufficient));
check('and the route out is dual labelling, quoted',
  /dual label/.test(PERMANENT_INSTALLATION.theRoute)
  && /NC Modular Construction Program or the HUD/.test(PERMANENT_INSTALLATION.theRoute));
check('both acceptable second labels are named',
  PERMANENT_INSTALLATION.labelsRequired.length === 2
  && PERMANENT_INSTALLATION.labelsRequired.some((l) => /NC Modular Construction Validating Stamp/.test(l))
  && PERMANENT_INSTALLATION.labelsRequired.some((l) => /HUD Manufactured Housing Label/.test(l)));
check('with the foundation, anchoring and zoning conditions attached',
  /foundation\/anchoring/.test(PERMANENT_INSTALLATION.conditions)
  && /zoning/.test(PERMANENT_INSTALLATION.conditions));

console.log('and it answers whether a local builder could simply make these');
check('a non-member cannot label, and an unlabelled unit cannot be a dwelling here',
  /are not authorized\/able to certify and label/.test(UNLABELLED_OR_SITE_BUILT.whoCannot)
  && /cannot be accepted as a permanent/.test(UNLABELLED_OR_SITE_BUILT.consequence));
check('over 400 sq ft an unlabelled unit is a code violation, not merely unlabelled',
  /non-complying single family dwelling in violation/.test(UNLABELLED_OR_SITE_BUILT.hardCeiling));
check('so RVIA membership is stated as a procurement filter, not a quality signal',
  /procurement filter, not a quality signal/.test(UNLABELLED_OR_SITE_BUILT.soWhat)
  && /within trucking distance/.test(UNLABELLED_OR_SITE_BUILT.soWhat));

console.log('gross trailer area — and the correction it forces');
check('a habitable loft at 5 ft or more counts against the area',
  GROSS_TRAILER_AREA.habitableLoftCeilingFt === 5
  && /shall be included in the gross trailer areas/.test(GROSS_TRAILER_AREA.loftsCount));
// The predicate has to bite exactly at 5 ft, in both directions.
check('and the test turns exactly at 5 ft',
  loftCountsTowardArea(5) === true && loftCountsTowardArea(5.1) === true
  && loftCountsTowardArea(4.9) === false && loftCountsTowardArea(0) === false);
check('the correction it supersedes is named, not silently applied',
  /Supersedes the "lofts are free" note/.test(GROSS_TRAILER_AREA.correctionNote)
  && /Skyview 400/.test(GROSS_TRAILER_AREA.correctionNote));
check('roof overhangs are excluded and the HUD floor is 320 sq ft',
  /roof overhangs are not included/.test(GROSS_TRAILER_AREA.roofOverhangs)
  && GROSS_TRAILER_AREA.hudMinimumSqFt === 320);
check('the ANSI definition keeps BOTH limbs, including the narrow one',
  ANSI_DEFINITION.capSqFt === 400 && ANSI_DEFINITION.narrowLimbSqFt === 320
  && ANSI_DEFINITION.transportWidthFt === 8.5
  && /not exceeding 320 square feet/.test(ANSI_DEFINITION.restated));
check('and the NEC statement of intent is kept — seasonal, not permanent',
  /intended for seasonal use/.test(ANSI_DEFINITION.necIntent)
  && /not intended as a permanent dwelling/.test(ANSI_DEFINITION.necIntent));

console.log('the two routes, and what each actually costs');
const temp = assessNcRoute('temporary-rv');
const perm = assessNcRoute('dual-labelled-permanent');
check('the temporary route forbids permanent services and keeps the wheels on',
  temp.permanentUtilitiesAllowed === false && temp.wheelsMustStayOn === true
  && temp.deckMayBearOnUnit === false);
check('and it names the cost that is NOT the deck',
  /permanent electrical, plumbing and mechanical connections are not permissible/.test(temp.mechanism)
  && /nightly-rental cabin needs/.test(temp.mechanism));
check('the permanent route lifts all three limits',
  perm.permanentUtilitiesAllowed === true && perm.wheelsMustStayOn === false
  && perm.deckMayBearOnUnit === true);
// The routes must differ on every axis, or the fork is not a real fork.
check('the two routes differ on every constraint they describe',
  temp.permanentUtilitiesAllowed !== perm.permanentUtilitiesAllowed
  && temp.wheelsMustStayOn !== perm.wheelsMustStayOn
  && temp.deckMayBearOnUnit !== perm.deckMayBearOnUnit);
check('only the permanent route demands a manufacturer capability, and names it',
  temp.requiresManufacturerCapability === null
  && /Dual labelling/.test(perm.requiresManufacturerCapability)
  && /RVIA/.test(perm.requiresManufacturerCapability));
check('and it is honest that this ends the vehicle argument',
  /ends the vehicle argument/.test(perm.mechanism) && /real property/.test(perm.mechanism)
  && /tax workstream/.test(perm.mechanism));
check('five gating questions, dual labelling first',
  MANUFACTURER_GATING_QUESTIONS.length === 5
  && /dual label for North Carolina/.test(MANUFACTURER_GATING_QUESTIONS[0]));
check('and they cover delivery, the loft, and the tow bar in the order',
  MANUFACTURER_GATING_QUESTIONS.some((q) => /deliver to western North Carolina/.test(q))
  && MANUFACTURER_GATING_QUESTIONS.some((q) => /habitable loft/.test(q))
  && MANUFACTURER_GATING_QUESTIONS.some((q) => /remain on the unit, and will you say so in the order/.test(q)));

console.log('the utilities problem, resolved by a different agency');
// The OSFM memo forbids permanent connections. Read alone that looks fatal. The
// health rules give park models their own design flow inside an RV park, so the
// state plainly does contemplate a connected one — just not a connected DWELLING.
check('a park model has its own design flow, half again a traditional RV',
  RV_PARK_WASTEWATER.parkModelRvGpd === 150 && RV_PARK_WASTEWATER.traditionalRvGpd === 100
  && RV_PARK_WASTEWATER.parkModelRvGpd > RV_PARK_WASTEWATER.traditionalRvGpd);
check('and the park is sized as a park, explicitly NOT as a dwelling unit',
  /and not as a dwelling unit/.test(RV_PARK_WASTEWATER.definition)
  && /common ownership or control/.test(RV_PARK_WASTEWATER.definition));
check('flow is derived from the space count, not stored',
  parkModelDdfGpd(10) === 1500 && parkModelDdfGpd(4) === 600 && parkModelDdfGpd(0) === 0);
// Ten spaces is exactly the ceiling — the check has to bite on both sides of it.
check('ten park-model spaces is the ceiling for local-only review, and eleven is not',
  withinLocalReview(10) === true && withinLocalReview(11) === false
  && RV_PARK_WASTEWATER.parkModelMaxSpacesLocal === 10
  && RV_PARK_WASTEWATER.localReviewCeilingGpd === 1500);
// The two limits coincide at the unadjusted rate, so they must be exercised
// apart or the space cap is untested. A DDF adjustment is exactly that case.
check('the space cap still bites when an adjustment pulls the flow under the ceiling',
  withinLocalReview(14, 1400) === false);
check('and the flow ceiling still bites when the space count is legal',
  withinLocalReview(8, 1600) === false);
check('both limits satisfied together is the only way through',
  withinLocalReview(8, 1400) === true);
check('traditional RVs get more spaces on local review than park models do',
  RV_PARK_WASTEWATER.traditionalMaxSpacesLocal === 15
  && RV_PARK_WASTEWATER.traditionalMaxSpacesLocal > RV_PARK_WASTEWATER.parkModelMaxSpacesLocal);
check('high strength is the default assumption, with the cost of disproving it named',
  /assumed to be high strength/.test(RV_PARK_WASTEWATER.strengthDefault)
  && /BOD, TSS, TKN and FOG/.test(RV_PARK_WASTEWATER.strengthConsequence));
check('and the bathhouse route is recorded as closed to park models',
  /70 gpd\/campsite/.test(RV_PARK_WASTEWATER.bathhouseAlternative)
  && /Park models cannot use this route/.test(RV_PARK_WASTEWATER.bathhouseAlternative)
  && /no holding tanks/.test(RV_PARK_WASTEWATER.bathhouseAlternative));

console.log('ownership decides the classification, not construction');
check('separately owned parcels outside common control forfeit RV-park treatment',
  /separately owned parcels not under common control/.test(OWNERSHIP_DECIDES_CLASSIFICATION.forfeits)
  && /same requirements as a dwelling unit/.test(OWNERSHIP_DECIDES_CLASSIFICATION.forfeits));
check('and the surviving route — separately owned SPACES under an association — is quoted',
  /owner\'s association and bi-party agreement/.test(OWNERSHIP_DECIDES_CLASSIFICATION.survives)
  && /18E \.0204\(g\)/.test(OWNERSHIP_DECIDES_CLASSIFICATION.survives));
check('the parcels-versus-spaces distinction is stated, not left to be inferred',
  /[Ss]eparately owned PARCELS/.test(OWNERSHIP_DECIDES_CLASSIFICATION.soWhat)
  && /[Ss]eparately owned SPACES/.test(OWNERSHIP_DECIDES_CLASSIFICATION.soWhat)
  && /upstream of every design decision/.test(OWNERSHIP_DECIDES_CLASSIFICATION.soWhat));
// This module records the rule and refuses the conclusion.
check('and the tax consequence is escalated rather than decided here',
  /tax workstream/.test(OWNERSHIP_DECIDES_CLASSIFICATION.escalateTo)
  && /before a sales structure is settled/.test(OWNERSHIP_DECIDES_CLASSIFICATION.escalateTo));

console.log('the movable-housing routes, and which ones stay movable');
check('four routes recorded, and exactly two stay movable',
  MOVABLE_HOUSING_ROUTES.length === 4 && routesThatStayMovable().length === 2);
check('and the two that stay movable are the two RV-park routes',
  routesThatStayMovable().map((r) => r.id).sort().join()
  === 'park-model-in-rv-park,traditional-rv-park');
check('keeping the wheels and being a building are opposite in every route',
  MOVABLE_HOUSING_ROUTES.every((r) => r.keepsWheels === !r.isBuilding));
check('every route names its catch, including the ones that work',
  MOVABLE_HOUSING_ROUTES.every((r) => typeof r.catch === 'string' && r.catch.length > 30));
check('the park-model route names common control and the ten-space ceiling',
  /common ownership or control/.test(MOVABLE_HOUSING_ROUTES[0].catch)
  && /Ten spaces/.test(MOVABLE_HOUSING_ROUTES[0].catch));
check('tiny homes are recorded as a dead end, with the reason',
  TINY_HOME_ROUTE.classification === 'permanent single-family dwelling under the NC Residential Code'
  && /building with extra rules, not a movable asset/.test(TINY_HOME_ROUTE.notAWayAround));

if (failures > 0) { console.error(`\nnc-classification battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nnc-classification battery clean');
