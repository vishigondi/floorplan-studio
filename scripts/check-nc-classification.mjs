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
  MANUFACTURER_GATING_QUESTIONS,
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

if (failures > 0) { console.error(`\nnc-classification battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nnc-classification battery clean');
