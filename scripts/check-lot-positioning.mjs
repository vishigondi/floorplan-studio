// Battery for lib/kit/lot-positioning.ts.
//
// One claim: the electrical code fixes the pedestal to the unit's LEFT, so the
// door belongs on the RIGHT or the deck sits in the band. These checks exist
// because the first version of this module passed BOTH door hands — the stand
// had been sized to the lot instead of the pad, which pushed the band so far
// outboard that no deck could ever reach it. A check that cannot fail is worse
// than no check, so the geometry is now exercised against both hands on every
// unit actually in the catalogue.
//
// Usage: node scripts/check-lot-positioning.mjs (npm run check:lot-positioning)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  NEC_551_77, UNIT_SERVICE_POINTS, SETUP_STANDARD, PAD_MARGIN_DEFAULT_FT,
  unitFootprint, standFootprint, standWidthFt, standLengthFt, rearOfStandY,
  pedestalZone, sideDeck, viewDeck, polysOverlap, assessLot,
  HANDING_AND_LANES, handingIsConsistent,
} = await import(join(root, 'lib/kit/lot-positioning.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}
const near = (a, b, tol = 0.01) => Math.abs(a - b) < tol;
const area = (p) => Math.abs(p.reduce((a, q, i) => {
  const r = p[(i + 1) % p.length];
  return a + (q.x * r.y - r.x * q.y);
}, 0) / 2);
const xs = (p) => p.map((q) => q.x);
const ys = (p) => p.map((q) => q.y);

/** Every unit in the catalogue, both hands. */
const UNITS = [
  ['Zook A-Frame Studio', 13.5, 32], ['Zook A-Frame Bunkhouse', 13.67, 31],
  ['Zook A-Frame Classic', 13.83, 29.17], ['Zook Luna', 11, 36],
  ['Irontown Cabana PMRV', 13.67, 29.17], ['Irontown Mysa 400', 13.67, 32.17],
  ['Irontown Skyview 400', 12.67, 33], ['OOD Extended', 11.16, 26.08],
];
const lot = (name, w, l, doorSide) => ({
  id: name, doorSide, unitWidthFt: w, unitLengthFt: l,
  padMarginFt: PAD_MARGIN_DEFAULT_FT, sideDeckDepthFt: 8, viewDeckDepthFt: 14,
});

console.log('the code dimensions, as written');
check('the pedestal is on the LEFT (road) side, 5-7 ft off the stand edge',
  NEC_551_77.side === 'left'
  && NEC_551_77.offsetFromLeftEdgeFt[0] === 5 && NEC_551_77.offsetFromLeftEdgeFt[1] === 7
  && /driver's side/.test(NEC_551_77.sideNote));
check('the window runs from the rear of the stand to 15 ft forward',
  NEC_551_77.windowFromRearOfStandFt[0] === 0 && NEC_551_77.windowFromRearOfStandFt[1] === 15);
// A small correction to the archive, but it is the dimension conduit gets set to.
check('and the archive\'s "~16 ft" is recorded as the 15 ft the code actually says',
  NEC_551_77.archiveSaysFt === 16 && NEC_551_77.actualFt === 15
  && NEC_551_77.actualFt === NEC_551_77.windowFromRearOfStandFt[1]);

console.log('the stand is the PAD, derived — not a free number');
const L = lot('t', 13.5, 32, 'right');
check('the pad runs 1 ft past the unit on every side',
  PAD_MARGIN_DEFAULT_FT === 1
  && near(standWidthFt(L), 13.5 + 2) && near(standLengthFt(L), 32 + 2));
check('so the stand is always larger than the unit, by twice the margin',
  UNITS.every(([n, w, l]) => {
    const x = lot(n, w, l, 'right');
    return near(standWidthFt(x) - w, 2 * PAD_MARGIN_DEFAULT_FT)
      && near(standLengthFt(x) - l, 2 * PAD_MARGIN_DEFAULT_FT);
  }));
check('the rear of the stand is the deep end, past the unit',
  near(rearOfStandY(L), -17) && rearOfStandY(L) < -32 / 2);
check('footprints carry their real areas',
  near(area(unitFootprint(L)), 13.5 * 32, 0.01)
  && near(area(standFootprint(L)), 15.5 * 34, 0.01));

console.log('the pedestal band sits where the code puts it');
const zone = pedestalZone(L);
check('it is entirely on the LEFT — every corner at negative x',
  Math.max(...xs(zone)) < 0);
check('and it is 2 ft wide, outboard of the stand edge by 5 to 7',
  near(Math.max(...xs(zone)), -(15.5 / 2) - 5) && near(Math.min(...xs(zone)), -(15.5 / 2) - 7)
  && near(Math.max(...xs(zone)) - Math.min(...xs(zone)), 2));
check('and 15 ft long, starting at the rear of the stand',
  near(Math.min(...ys(zone)), rearOfStandY(L))
  && near(Math.max(...ys(zone)) - Math.min(...ys(zone)), 15));
check('its area is the 2 x 15 the code describes',
  near(area(zone), 30, 0.01));

console.log('door on the right clears it; door on the left does not');
// The check that failed to fail the first time. Both hands, every unit.
check('every unit with the door on the RIGHT keeps the band clear',
  UNITS.every(([n, w, l]) => assessLot(lot(n, w, l, 'right')).ok === true),
  UNITS.filter(([n, w, l]) => !assessLot(lot(n, w, l, 'right')).ok).map(([n]) => n).join());
check('and every unit with the door on the LEFT fouls it',
  UNITS.every(([n, w, l]) => assessLot(lot(n, w, l, 'left')).ok === false),
  UNITS.filter(([n, w, l]) => assessLot(lot(n, w, l, 'left')).ok).map(([n]) => n).join());
check('the fouling is the SIDE deck, never the view deck',
  UNITS.every(([n, w, l]) => {
    const v = assessLot(lot(n, w, l, 'left'));
    return v.deckFoulsPedestal === true && v.viewDeckFoulsPedestal === false;
  }));
// CORRECTED. The first version of this check claimed the view deck clears on
// the Y axis by lying past the rear of the stand. It does not — it starts at
// the UNIT's edge, which is one pad-margin inboard of the stand's rear, so the
// two overlap in y by exactly that margin. It clears on X: the view deck never
// leaves the unit's width, and the band is outboard of the whole stand.
check('the view deck overlaps the band in Y, by exactly the pad margin',
  UNITS.every(([n, w, l]) => {
    const x = lot(n, w, l, 'right');
    return near(Math.max(...ys(viewDeck(x))) - rearOfStandY(x), x.padMarginFt);
  }));
check('but clears on X — it stays inside the unit width, and the band is outboard of the stand',
  UNITS.every(([n, w, l]) => {
    const x = lot(n, w, l, 'right');
    return near(Math.min(...xs(viewDeck(x))), -w / 2)
      && Math.min(...xs(viewDeck(x))) > Math.max(...xs(pedestalZone(x)));
  }));
check('so it never fouls the band, on either hand',
  UNITS.every(([n, w, l]) => assessLot(lot(n, w, l, 'right')).viewDeckFoulsPedestal === false
    && assessLot(lot(n, w, l, 'left')).viewDeckFoulsPedestal === false));
check('the side deck is on the door\'s side, and only there',
  Math.min(...xs(sideDeck(lot('t', 13.5, 32, 'right')))) > 0
  && Math.max(...xs(sideDeck(lot('t', 13.5, 32, 'left')))) < 0);
check('and the verdict says what to do about it',
  /door is on the\s+RIGHT/.test(assessLot(lot('t', 13.5, 32, 'left')).note.replace(/\s+/g, ' '))
  && /rework, not a detail/.test(assessLot(lot('t', 13.5, 32, 'left')).note));
// Overlap primitive, against answers known by hand.
check('the overlap test agrees on obvious cases and treats touching as clear',
  polysOverlap([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }],
    [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }]) === true
  && polysOverlap([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }],
    [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }]) === false);

console.log('the services come out where the plan puts them, not where a standard does');
check('water and sewer drop under the wet core; power leaves at an end',
  /wet core/.test(UNIT_SERVICE_POINTS.water) && /wet core/.test(UNIT_SERVICE_POINTS.sewer)
  && /at one END/.test(UNIT_SERVICE_POINTS.electrical));
check('and the consequence — opposite ends of the same lot — is spelled out',
  /opposite ends of the same lot/i.test(UNIT_SERVICE_POINTS.consequence)
  && /do not assume one trench/.test(UNIT_SERVICE_POINTS.consequence));
check('blocking and tie-downs are recorded at 8 ft',
  /at most 8 ft apart/.test(SETUP_STANDARD.blocking) && /every 8 ft/.test(SETUP_STANDARD.tieDowns));
// The maker offers something NC constrains. Hold both, do not resolve it here.
check('the tongue-removal offer is held against the NC wheels-and-axles rule',
  /wheels and axles to remain/.test(SETUP_STANDARD.tongueRemoval)
  && /Stowing keeps it with the unit/.test(SETUP_STANDARD.tongueRemoval)
  && /Confirm in writing/.test(SETUP_STANDARD.tongueRemoval));

console.log('and the procurement consequence, which is the real finding');
check('a double-loaded lane is stated to need both hands',
  /double-loaded lane needs reversed plans/.test(HANDING_AND_LANES.doubleLoadedNeedsBothHands)
  && /before the site plan is drawn/.test(HANDING_AND_LANES.doubleLoadedNeedsBothHands));
check('and the under-ten case names its two ways out',
  /single-load the lanes/.test(HANDING_AND_LANES.singleLoadedUnderTenUnits)
  && /alternate the/.test(HANDING_AND_LANES.singleLoadedUnderTenUnits));
check('the recurring ten is called out across both authorities',
  /Ten units unlocks handing/.test(HANDING_AND_LANES.theRecurringTen)
  && /local-only wastewater review/.test(HANDING_AND_LANES.theRecurringTen));
check('consistent handing is checkable, and mixed handing fails it',
  handingIsConsistent([lot('a', 13.5, 32, 'right'), lot('b', 11, 36, 'right')]) === true
  && handingIsConsistent([lot('a', 13.5, 32, 'right'), lot('b', 11, 36, 'left')]) === false
  && handingIsConsistent([]) === true);

if (failures > 0) { console.error(`\nlot-positioning battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nlot-positioning battery clean');
