// Battery for lib/kit/shared-deck-plan.ts — the owner's render, worked up.
//
// Two things carry the image and both are checkable: the open deck edge is a
// GRADING instruction rather than a styling choice, and the entry is not where
// the render implies it is on most of the catalogue.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = await import(join(root, 'lib/kit/shared-deck-plan.ts'));
const C = await import(join(root, 'lib/kit/site-composition.ts'));
const {
  SHARED_DECK, GUARD_TRIGGER_IN, GUARD_HEIGHT_IN, guardRequired, OPEN_EDGE_STRATEGY,
  FIRE_ON_DECK, FLANK_WALK_THRESHOLD_FT, preferredStance, assessFit,
  broadsidePairFitsFt, broadsidePairFits, SYMMETRY_NEEDS_HANDING,
} = S;

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}
const unit = (m) => C.OBSERVED_UNITS.find((u) => u.model === m);

console.log('the open edge is a grading instruction, not a styling choice');
check('the guard triggers above 30 in, and 36 in is the height',
  GUARD_TRIGGER_IN === 30 && GUARD_HEIGHT_IN === 36);
// The whole look turns on this one inch.
check('30 in needs no guard and 31 does',
  guardRequired(30) === false && guardRequired(30.5) === true && guardRequired(31) === true
  && guardRequired(0) === false);
check('the strategy names the cost — grade built UP to meet the deck',
  OPEN_EDGE_STRATEGY.maxHeightIn === GUARD_TRIGGER_IN
  && /built UP/.test(OPEN_EDGE_STRATEGY.whatItCosts)
  && /stone apron/.test(OPEN_EDGE_STRATEGY.whatItCosts));
check('and the trap — one low corner rails the whole edge',
  /ground BELOW, not to the average/.test(OPEN_EDGE_STRATEGY.theTrap)
  && /One low corner/.test(OPEN_EDGE_STRATEGY.theTrap));
check('with a way out that does not railing the perimeter',
  /Step the deck down in platforms/.test(OPEN_EDGE_STRATEGY.ifItCannotBeHeld)
  && /every plane stays open/.test(OPEN_EDGE_STRATEGY.ifItCannotBeHeld));
check('the fire bowl is given a non-combustible hearth, set before framing',
  FIRE_ON_DECK.requiresNoncombustibleBase === true
  && /between joists, not across one/.test(FIRE_ON_DECK.caution));

console.log('stance follows the glazing, and the glazing decides the composition');
check('gable glazing wants gable-on; side glazing wants broadside',
  C.OBSERVED_UNITS.every((u) => preferredStance(u) === (u.glassWall === 'gable' ? 'gable-on' : 'broadside')));
check('and the wrong stance is caught — the deck would get a blank wall',
  assessFit(unit('Skyview 400'), 'gable-on').glassFacesDeck === false
  && /Wrong stance/.test(assessFit(unit('Skyview 400'), 'gable-on').verdict)
  && assessFit(unit('A-Frame Studio'), 'broadside').glassFacesDeck === false);

console.log('where the entry actually is — the render assumes it is on the deck');
const fits = C.OBSERVED_UNITS.map((u) => assessFit(u));
check('all eight units assessed',
  fits.length === 8 && FLANK_WALK_THRESHOLD_FT === 12);
// The finding: five of eight need a walkway the render does not show.
check('five need a flank walkway; three do not',
  fits.filter((f) => f.needsFlankWalk).length === 5
  && fits.filter((f) => !f.needsFlankWalk).length === 3);
check('and the three that work are the Cabana and the two side-glass units',
  fits.filter((f) => !f.needsFlankWalk).map((f) => f.model).sort().join()
  === 'Cabana PMRV,Extended Park Model RV,Skyview 400');
check('the A-frames are the worst of it, at over 20 ft each',
  fits.filter((f) => /A-Frame/.test(f.model)).every((f) => f.walkToDoorFt > 20));
check('the walk is derived from the door fraction, not stored',
  assessFit(unit('A-Frame Studio')).walkToDoorFt === 27.2
  && assessFit(unit('Cabana PMRV')).walkToDoorFt === 11.7);
check('and broadside measures the walk across the unit, not along it',
  assessFit(unit('Skyview 400')).walkToDoorFt === 6.3
  && assessFit(unit('Skyview 400')).walkToDoorFt < unit('Skyview 400').widthFt);

console.log('a pair broadside does not fit — arithmetic the drawing made obvious');
check('the pair requirement is two lengths plus a gap',
  broadsidePairFitsFt({ lengthFt: 26.08 }) === 60.2
  && broadsidePairFitsFt({ lengthFt: 10 }, 0) === 20);
check('and neither side-glass unit fits this deck as a pair',
  broadsidePairFits(unit('Extended Park Model RV')) === false
  && broadsidePairFits(unit('Skyview 400')) === false
  && SHARED_DECK.deckWidthFt === 48);
check('so their verdict offers the right-angle pair instead',
  /right-angle pair/.test(assessFit(unit('Skyview 400')).verdict));
check('but a short enough unit would fit, so the test is not always-false',
  broadsidePairFits({ lengthFt: 19 }) === true);

console.log('the symmetry the render shows forces a handed pair');
check('both doors facing the path means one left-hand and one right-hand plan',
  /left-hand plan and the other a right-hand/.test(SYMMETRY_NEEDS_HANDING.why)
  && /do not hand a plan below ten units/.test(SYMMETRY_NEEDS_HANDING.supplyConsequence));
check('and it collides with the pedestal, which the code fixes to the left',
  /NEC 551\.77/.test(SYMMETRY_NEEDS_HANDING.pedestalCollision)
  && /door and its pedestal on the same side/.test(SYMMETRY_NEEDS_HANDING.pedestalCollision));
check('the unhanded fallback is described rather than hidden',
  /both doors land on the same side/.test(SYMMETRY_NEEDS_HANDING.ifUnhanded)
  && /is not what the render shows/.test(SYMMETRY_NEEDS_HANDING.ifUnhanded));
check('the deck as drawn is 48 x 24 with the boards running across',
  SHARED_DECK.deckWidthFt === 48 && SHARED_DECK.deckDepthFt === 24
  && SHARED_DECK.unitGapFt === 15 && /across the long axis/.test(SHARED_DECK.boardDirection));

if (failures > 0) { console.error(`\nshared-deck-plan battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nshared-deck-plan battery clean');
