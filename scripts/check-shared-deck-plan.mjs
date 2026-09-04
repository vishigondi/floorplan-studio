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
  FLANK_DECK_WIDTH_FT, FLANK_SIDE, innerFlanksFit, flankDeckAreaSqFt,
  pairedDeckAreaSqFt, identicalPairWorks, rankedForPairing, PAIRING_VERDICT,
  pairOnOneDeck, PAIR_WIDTH_TOLERANCE_FT, COMMON_REAR_DATUM, UNHANDED_PAIR_RESOLVES_PEDESTAL,
  parkRoadWidthGovernedBy, MIXING_ACROSS_MAKERS,
  MIN_PRIVATE_DECK_SQFT, PRIVATE_DECK_WITH_TUB_SQFT, assessRental, lettableAlone, DUAL_MODE_RULES,
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

console.log('the glass faces the view, so the flank becomes deck');
// The glazing is the product; it is never turned away to shorten a walk.
check('the flank deck is a room, not a walkway',
  FLANK_DECK_WIDTH_FT === 8 && FLANK_SIDE === 'outer');
// Drawing it settled this: two inner flanks do not fit the gap.
check('two inner flanks do NOT fit the 15 ft gap, and the module says so',
  innerFlanksFit(SHARED_DECK.unitGapFt) === false
  && innerFlanksFit(2 * FLANK_DECK_WIDTH_FT + 4) === true);
check('so the flanks are outboard, facing away',
  /outer wall, facing away into the trees/.test(assessFit(unit('A-Frame Studio')).verdict));
check('flank area is derived from the walk, and is zero when there is no walk',
  flankDeckAreaSqFt(unit('A-Frame Studio')) === 218 && flankDeckAreaSqFt(unit('Luna')) === 216
  && flankDeckAreaSqFt(unit('A-Frame Classic')) === 175 && flankDeckAreaSqFt(unit('Mysa 400')) === 193
  && flankDeckAreaSqFt(unit('Cabana PMRV')) === 0);
check('and all four fall out of the same 8 ft width times their own walk',
  [['A-Frame Studio', 218], ['Luna', 216], ['A-Frame Classic', 175], ['Mysa 400', 193]]
    .every(([m, a]) => Math.round(FLANK_DECK_WIDTH_FT * assessFit(unit(m)).walkToDoorFt) === a));
// The inversion: the worst door position buys the most private deck.
const studio = pairedDeckAreaSqFt(unit('A-Frame Studio'));
const cabana = pairedDeckAreaSqFt(unit('Cabana PMRV'));
check('the longest walk yields the most private deck, and the shortest none',
  studio.flankSqFt === 436 && cabana.flankSqFt === 0
  && studio.privateShare > 0.25 && cabana.privateShare === 0);
check('and the shared deck is the same 1152 sq ft either way',
  studio.sharedSqFt === 1152 && cabana.sharedSqFt === 1152
  && studio.totalSqFt === studio.sharedSqFt + studio.flankSqFt);

console.log('mixing models — three questions, three answers');
check('a pair must agree roughly on width',
  PAIR_WIDTH_TOLERANCE_FT === 2
  && pairOnOneDeck(unit('A-Frame Studio'), unit('A-Frame Classic')).compatible === true);
// Skyview and Cabana differ ONLY in glazing wall — same width band, both with
// the door on the deck. So this isolates the glazing test; any pair that also
// differs on the flank would pass for the wrong reason.
const isolated = pairOnOneDeck(unit('Skyview 400'), unit('Cabana PMRV'));
check('and a pair that differs ONLY in glazing wall is rejected for exactly that',
  isolated.compatible === false && isolated.reasons.length === 1
  && /Glazing walls differ/.test(isolated.reasons[0]));
check('a unit always pairs with itself, unless a pair will not physically fit',
  identicalPairWorks(unit('A-Frame Studio')) === true
  && identicalPairWorks(unit('Cabana PMRV')) === true
  && identicalPairWorks(unit('Skyview 400')) === false);
check('and the verdict is to pair a unit with itself and vary between decks',
  /Pair a unit with itself/.test(PAIRING_VERDICT.rule)
  && /never within one/.test(PAIRING_VERDICT.rule));
check('six of the six gable units are rankable for an identical pair',
  rankedForPairing(C.OBSERVED_UNITS).length === 6
  && rankedForPairing(C.OBSERVED_UNITS)[0].model === 'Cabana PMRV');
check('the datum rule keeps one pedestal detail across mixed lengths',
  /GLASS end on the deck edge/.test(COMMON_REAR_DATUM.rule)
  && COMMON_REAR_DATUM.buys.some((b) => /rear of the stand never moves/.test(b)));
// The road is set by the widest unit that will ever arrive.
check('road geometry is governed by the widest unit in the mix',
  parkRoadWidthGovernedBy(C.OBSERVED_UNITS).model === 'A-Frame Classic'
  && parkRoadWidthGovernedBy(C.OBSERVED_UNITS).widthFt === 13.83
  && parkRoadWidthGovernedBy([unit('Extended Park Model RV')]).widthFt === 11.16);
check('and mixing across makers is named as the expensive one',
  /volume does not pool/.test(MIXING_ACROSS_MAKERS.theTrap)
  && /five and five unlocks nothing/.test(MIXING_ACROSS_MAKERS.theTrap)
  && /Mixing WITHIN a maker costs almost nothing/.test(MIXING_ACROSS_MAKERS.whereItIsCheap));

console.log('the symmetry the render shows forces a handed pair');
check('both doors facing the path means one left-hand and one right-hand plan',
  /left-hand plan and the other a right-hand/.test(SYMMETRY_NEEDS_HANDING.why)
  && /do not hand a plan below ten units/.test(SYMMETRY_NEEDS_HANDING.supplyConsequence));
check('and it collides with the pedestal, which the code fixes to the left',
  /NEC 551\.77/.test(SYMMETRY_NEEDS_HANDING.pedestalCollision)
  && /door and its pedestal on the same side/.test(SYMMETRY_NEEDS_HANDING.pedestalCollision));
check('the unhanded arrangement is no longer a fallback but the recommendation',
  /both doors land on the same side/.test(SYMMETRY_NEEDS_HANDING.ifUnhanded)
  && /no longer '?the fallback/.test(SYMMETRY_NEEDS_HANDING.ifUnhanded.replace(/\s+/g, ' '))
  && /RECOMMENDATION/.test(SYMMETRY_NEEDS_HANDING.ifUnhanded));
check('the deck as drawn is 48 x 24 with the boards running across',
  SHARED_DECK.deckWidthFt === 48 && SHARED_DECK.deckDepthFt === 24
  && SHARED_DECK.unitGapFt === 15 && /across the long axis/.test(SHARED_DECK.boardDirection));

console.log('letting the pair together OR separately — which reverses the ranking');
check('the thresholds are 100 sq ft to stand alone, 180 to take a tub',
  MIN_PRIVATE_DECK_SQFT === 100 && PRIVATE_DECK_WITH_TUB_SQFT === 180
  && PRIVATE_DECK_WITH_TUB_SQFT > MIN_PRIVATE_DECK_SQFT);
// The reversal is the finding. The unit that was best when the walk looked like
// a defect is the only one that cannot be let alone.
check('the Cabana has NO private outdoor space and cannot stand alone',
  assessRental(unit('Cabana PMRV')).privateSqFtPerUnit === 0
  && assessRental(unit('Cabana PMRV')).lettableAlone === false
  && /nowhere of their own/.test(assessRental(unit('Cabana PMRV')).note));
check('and every A-frame can, the longest walk giving the most space',
  ['A-Frame Studio', 'A-Frame Bunkhouse', 'A-Frame Classic', 'Luna']
    .every((m) => assessRental(unit(m)).lettableAlone === true));
check('four of them clear the tub threshold and the Classic does not',
  assessRental(unit('A-Frame Studio')).takesATub === true
  && assessRental(unit('Luna')).takesATub === true
  && assessRental(unit('Mysa 400')).takesATub === true
  && assessRental(unit('A-Frame Classic')).takesATub === false);
// The ordering must be by private space, and it must invert the entry ordering.
const alone = lettableAlone(C.OBSERVED_UNITS);
check('the standalone ranking is led by the unit with the LONGEST walk',
  alone[0].model === 'A-Frame Studio'
  && !alone.some((u) => u.model === 'Cabana PMRV'));
check('which is the exact reverse of the entry ranking',
  rankedForPairing(C.OBSERVED_UNITS)[0].model === 'Cabana PMRV'
  && alone[0].model !== 'Cabana PMRV');
check('both letting modes carry their own rules',
  DUAL_MODE_RULES.together.length === 2 && DUAL_MODE_RULES.separate.length === 4);
check('separate letting insists on ONE fire and an honest listing',
  DUAL_MODE_RULES.separate.some((r) => /ONE fire/.test(r))
  && DUAL_MODE_RULES.separate.some((r) => /List it as shared; do not imply otherwise/.test(r)));
check('and the boundary is a change of surface, not a fence',
  DUAL_MODE_RULES.separate.some((r) => /a fence is not/.test(r)));
check('the tension is named rather than divided away',
  /neither party owns/.test(DUAL_MODE_RULES.theTension)
  && /not to divide it/.test(DUAL_MODE_RULES.theTension));
check('and a tub is flagged as a framing decision before the joists are cut',
  /thousands of pounds/.test(DUAL_MODE_RULES.tubStructure)
  && /before the joists are cut/.test(DUAL_MODE_RULES.tubStructure));

console.log('CROSS-MODULE — the check that was missing, and that found a real conflict');
// Nothing checked lot-positioning and shared-deck-plan together, so a direct
// contradiction sat between them: a mirror pair puts one flank deck exactly
// where NEC reserves the pedestal. This check exists so it cannot come back.
const L = await import(join(root, 'lib/kit/lot-positioning.ts'));
const lotFor = (side) => ({ id: 'x', doorSide: side, unitWidthFt: 13.5, unitLengthFt: 32,
  padMarginFt: L.PAD_MARGIN_DEFAULT_FT, sideDeckDepthFt: FLANK_DECK_WIDTH_FT, viewDeckDepthFt: 14 });
check('a flank deck on the RIGHT clears the pedestal band; on the LEFT it fouls',
  L.assessLot(lotFor('right')).ok === true && L.assessLot(lotFor('left')).ok === false);
check('so a mirror-symmetric pair always fouls on one of its two units',
  L.assessLot(lotFor('right')).ok !== L.assessLot(lotFor('left')).ok);
check('and the conflict is recorded rather than left implicit',
  /reserves the pedestal/.test(UNHANDED_PAIR_RESOLVES_PEDESTAL.conflict)
  && /One of the two units always fouls/.test(UNHANDED_PAIR_RESOLVES_PEDESTAL.conflict));
check('with the unhanded pair as the resolution, and what it buys',
  /SAME hand/.test(UNHANDED_PAIR_RESOLVES_PEDESTAL.resolution)
  && UNHANDED_PAIR_RESOLVES_PEDESTAL.buys.length === 3
  && UNHANDED_PAIR_RESOLVES_PEDESTAL.buys.some((b) => /ten-unit customisation gate/.test(b)));
check('and what it costs, stated rather than glossed',
  /echelon, not a mirror/.test(UNHANDED_PAIR_RESOLVES_PEDESTAL.costs)
  && /20 ft/.test(UNHANDED_PAIR_RESOLVES_PEDESTAL.sizing)
  && /will not hold both/.test(UNHANDED_PAIR_RESOLVES_PEDESTAL.sizing));
check('and it points at the resolution rather than restating it',
  /UNHANDED_PAIR_RESOLVES_PEDESTAL/.test(SYMMETRY_NEEDS_HANDING.ifUnhanded));

if (failures > 0) { console.error(`\nshared-deck-plan battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nshared-deck-plan battery clean');
