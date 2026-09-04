// Battery for lib/kit/unit-program.ts.
//
// The whole program rests on one invariant — every fit-out is the same legal
// object — because the moment a unit stops being a park model it stops being
// movable property and the depreciation goes with it. Most of these checks guard
// that invariant, since it is the thing a well-meaning design change breaks.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  CLASSIFICATION_INVARIANT, FIT_OUTS, fitOut, freeAreaBeds, sleeps, likelyFlowGpd,
  compoundFor, KITCHEN_IS_THE_LEVER, SUB_FIVE_LOFT_IS_FREE, FUNCTIONAL_ONE_DWELLING_RISK,
} = await import(join(root, 'lib/kit/unit-program.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}

console.log('the invariant — every fit-out is the same legal object');
check('every unit is an A119.5 park model, titled, wheels on, cord-and-plug',
  /ANSI A119\.5/.test(CLASSIFICATION_INVARIANT.everyUnitIs)
  && /NCDMV title/.test(CLASSIFICATION_INVARIANT.everyUnitIs)
  && /cord-and-plug/.test(CLASSIFICATION_INVARIANT.everyUnitIs));
// The line that must not move: strip the bed or bath and it becomes a building.
check('sleeping and a bath are named as what may NOT vary',
  /Sleeping facilities and a bath/.test(CLASSIFICATION_INVARIANT.whatMayNot)
  && /39-year real property/.test(CLASSIFICATION_INVARIANT.whatMayNot));
check('and furniture is named as what may',
  /Furniture/.test(CLASSIFICATION_INVARIANT.whatMayVary));
// Therefore: no fit-out may be bedless. The Study is the one that tempts it.
check('EVERY fit-out keeps sleeping — none is a bedless office',
  FIT_OUTS.every((f) => f.sleeps > 0));
check('and every one keeps a bath',
  FIT_OUTS.every((f) => f.bath === 'full' || f.bath === 'half'));
check('the Study is explicitly still a park model, with the reason',
  /STILL A PARK MODEL/.test(fitOut('study').notes)
  && /strip them and it becomes a building/.test(fitOut('study').notes));

console.log('three fit-outs, and the kitchen is what separates them');
check('three fit-outs with three different kitchen states',
  FIT_OUTS.length === 3
  && [...new Set(FIT_OUTS.map((f) => f.kitchen))].length === 3);
// Kitchen state drives the characterisation, and that is the point.
check('only the fixed-kitchen unit reads as a cottage; the others as campsites',
  FIT_OUTS.filter((f) => f.likelyFlowRow.startsWith('cottage')).map((f) => f.id).join() === 'hearth'
  && fitOut('hearth').kitchen === 'full-fixed'
  && fitOut('bunk').kitchen === 'compact-removable'
  && fitOut('study').kitchen === 'none');
check('the kitchen lever names both costs, including the sprinkler disagreement',
  KITCHEN_IS_THE_LEVER.costsIfPresent.length === 2
  && KITCHEN_IS_THE_LEVER.costsIfPresent.some((c) => /double the allocation/.test(c))
  && KITCHEN_IS_THE_LEVER.costsIfPresent.some((c) => /Records disagree/.test(c)));
check('and it insists the removable detail is drawn, because a sink has a drain',
  /still needs a drain/.test(KITCHEN_IS_THE_LEVER.detailToDraw)
  && /drawn, not assumed/.test(KITCHEN_IS_THE_LEVER.detailToDraw));

console.log('the sub-5 ft loft is free area, and it is how the Bunk sleeps four');
check('the rule and its consequence are both recorded',
  />=5 ft ceiling\) counts/.test(SUB_FIVE_LOFT_IS_FREE.rule)
  && /Five foot one costs its whole footprint/.test(SUB_FIVE_LOFT_IS_FREE.consequence));
check('only the Bunk uses it, and it is what takes it to four beds',
  FIT_OUTS.filter((f) => f.subFiveFootLoftSleeps > 0).map((f) => f.id).join() === 'bunk'
  && fitOut('bunk').sleeps === fitOut('bunk').bedrooms * 2 + fitOut('bunk').subFiveFootLoftSleeps);
check('free-area beds are summed across a mix, not assumed',
  freeAreaBeds([fitOut('bunk'), fitOut('bunk')]) === 4
  && freeAreaBeds([fitOut('hearth')]) === 0
  && freeAreaBeds([]) === 0);
check('and four beds matches NC\'s own four-occupants-per-RV planning figure',
  fitOut('bunk').sleeps === 4 && /four-occupants-per-RV/.test(fitOut('bunk').notes));

console.log('compounds for the parties actually being sold to');
const fam = compoundFor('family-of-four');
const two = compoundFor('two-families');
const corp = compoundFor('corporate');
check('a family of four needs ONE unit, at the lightest flow row',
  fam.mix.length === 1 && fam.sleeps === 4 && fam.heads === 4 && fam.flowGpd === 100);
check('two families of eight get ten beds across three units',
  two.mix.length === 3 && two.heads === 8 && two.sleeps === 10);
check('and the corporate compound adds the Study, the only kitchenless unit',
  corp.mix.length === 4 && corp.mix.some((m) => m.id === 'study')
  && corp.mix.filter((m) => m.kitchen === 'none').length === 1);
// Every compound must sleep at least its party, or it is not a product.
check('every compound sleeps at least its party size',
  [fam, two, corp].every((c) => c.sleeps >= c.heads));
check('flow is derived from the mix, not stored',
  likelyFlowGpd([fitOut('hearth'), fitOut('bunk'), fitOut('bunk')]) === 400
  && likelyFlowGpd([fitOut('study')]) === 100
  && likelyFlowGpd([]) === 0
  && two.flowGpd === likelyFlowGpd(two.mix));
check('and exactly one Hearth appears in each multi-unit compound',
  [two, corp].every((c) => c.mix.filter((m) => m.id === 'hearth').length === 1));

console.log('the risk in composing them, which is not a structural one');
check('the functional-one-dwelling risk is named rather than assumed away',
  /one dwelling distributed across three boxes/.test(FUNCTIONAL_ONE_DWELLING_RISK.theRisk));
check('with what still holds on the facts that matter',
  /Separately titled/.test(FUNCTIONAL_ONE_DWELLING_RISK.whatStillHolds)
  && /Nothing roofed between and nothing bearing on a unit/.test(FUNCTIONAL_ONE_DWELLING_RISK.whatStillHolds));
// The arithmetic is why it is worth raising rather than waiting to be asked.
check('and the arithmetic that argues for raising it first',
  /400 gpd if the rows apply as designed and 600/.test(FUNCTIONAL_ONE_DWELLING_RISK.whyRaiseItFirst)
  && FUNCTIONAL_ONE_DWELLING_RISK.owner.startsWith('McGill'));

if (failures > 0) { console.error(`\nunit-program battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nunit-program battery clean');
