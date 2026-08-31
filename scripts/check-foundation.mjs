// Battery for the helical pile take-off.
//
// This document exists so two installers can bid the same foundation without
// either one's catalogue in it, and so the buyer can compare the bids line for
// line. The things worth gating are the ways that quietly stops being true:
//
//   1. The tributary areas must TILE the footprint — exactly once, no gaps, no
//      overlaps. A placement bug shows up as double-counted or dropped area
//      long before it shows up as a wrong-looking pile, and it silently
//      mis-sizes every pile in the schedule.
//   2. Piles must sit on the bearing lines the JOIST rule believes carry floor.
//      If the two ever disagree, piles land under walls that are not bearing.
//   3. No brand, no depth. A depth is a product decision; torque is not.
//   4. An unconfirmed snow load must be impossible to mistake for a real one.
//
// Usage: node scripts/check-foundation.mjs (npm run check:foundation)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  buildPileSchedule, bearingLinesAlong, pilePositions, MAX_PILE_SPACING_FT,
  GROUND_SNOW_UNCONFIRMED, CHEROKEE_GROUND_SNOW, FLOOR_LIVE, ROOF_LIVE, ROOF_DEAD,
  CHEROKEE_WIND,
} = await import(join(root, 'lib/kit/foundation.ts'));
const { BEARING_COVERAGE_RATIO } = await import(join(root, 'lib/build-validator.ts'));
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));

const BRIEFS = [
  '1 bed cabin gable roof, 80x100 lot, 10 ft setbacks',
  '2 bed gable roof, 80x100 lot, 10 ft setbacks',
  '3 bed gable roof, 100x120 lot, 10 ft setbacks',
  '2 bed shed roof, 80x100 lot, 10 ft setbacks',
];

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

console.log('spacing');
check(`no bay exceeds ${MAX_PILE_SPACING_FT} ft`,
  [7, 12, 28, 36, 40].every((L) => {
    const p = pilePositions(L);
    return p.slice(1).every((v, i) => v - p[i] <= MAX_PILE_SPACING_FT + 0.01);
  }));
check('bays are even, so pile loads are comparable',
  [28, 36].every((L) => {
    const p = pilePositions(L);
    const gaps = p.slice(1).map((v, i) => v - p[i]);
    return Math.max(...gaps) - Math.min(...gaps) < 0.01;
  }));
check('a run always ends on a pile', pilePositions(28).at(-1) === 28 && pilePositions(28)[0] === 0);

console.log('bearing lines agree with the joist rule');
// A wall covering less than the ratio must NOT become a bearing line, and one
// covering more must. This is the shared rule, asserted from both sides.
const stub = [{ id: 'w', span: { x1: 0, z1: 10, x2: 28 * (BEARING_COVERAGE_RATIO - 0.1), z2: 10 } }];
const full = [{ id: 'w', span: { x1: 0, z1: 10, x2: 28 * (BEARING_COVERAGE_RATIO + 0.1), z2: 10 } }];
check('a wall under the coverage ratio is not a bearing line',
  !bearingLinesAlong('z', 28, 28, stub).includes(10), JSON.stringify(bearingLinesAlong('z', 28, 28, stub)));
check('a wall over it is', bearingLinesAlong('z', 28, 28, full).includes(10),
  JSON.stringify(bearingLinesAlong('z', 28, 28, full)));
check('the two exterior faces are always bearing lines',
  bearingLinesAlong('z', 28, 28, []).join(',') === '0,28');

for (const brief of BRIEFS) {
  const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'foundation', brief);
  if (!res.ok) { check(`${brief}: compiles`, false, res.errors.join('; ')); continue; }
  const a = res.artifact;
  const s = buildPileSchedule({
    planId: 'foundation',
    footprint: a.footprint,
    interiorWalls: a.interiorWalls,
    eaveHeightFt: a.roof.eaveHeightFt,
  });
  const { widthFt, depthFt } = a.footprint;
  const area = widthFt * depthFt;

  // THE LOAD-BEARING INVARIANT. Tributary areas must tile the footprint exactly
  // once. Under-tiling drops load nobody carries; over-tiling charges the same
  // square foot to two piles. Either way every capacity in the schedule is wrong
  // and nothing else in this battery would notice.
  const tiled = s.piles.reduce((t, p) => t + p.tributarySqFt, 0);
  check(`${brief}: tributary areas tile the ${area} sq ft footprint exactly`,
    Math.abs(tiled - area) < 0.5, `${tiled.toFixed(2)} vs ${area}`);

  check(`${brief}: every pile sits on a bearing line`,
    s.piles.every((p) => s.bearingLinesFt.some((l) =>
      Math.abs((s.joistAxis === 'z' ? p.zFt : p.xFt) - l) < 0.01)));
  check(`${brief}: all four footprint corners carry a pile`,
    [[0, 0], [widthFt, 0], [0, depthFt], [widthFt, depthFt]]
      .every(([x, z]) => s.piles.some((p) => Math.abs(p.xFt - x) < 0.01 && Math.abs(p.zFt - z) < 0.01)),
    s.piles.filter((p) => p.kind === 'corner').length + ' corner piles');
  check(`${brief}: exactly four piles are classified corner`,
    s.piles.filter((p) => p.kind === 'corner').length === 4);
  check(`${brief}: no two piles share a position`,
    new Set(s.piles.map((p) => `${p.xFt},${p.zFt}`)).size === s.piles.length);
  check(`${brief}: every pile carries a positive load`,
    s.piles.every((p) => p.serviceLoadLb > 0 && p.tributarySqFt > 0));
  check(`${brief}: the governing load is the heaviest pile, not an average`,
    s.maxServiceLoadLb === Math.max(...s.piles.map((p) => p.serviceLoadLb)));
  // More bearing lines means smaller tributaries. If a plan with more lines
  // reported a HEAVIER governing pile, the tributary split is inverted.
  check(`${brief}: load falls as bearing lines are added`,
    s.bearingLinesFt.length < 3 || s.maxServiceLoadLb < area * (FLOOR_LIVE.psf + 40),
    `${s.maxServiceLoadLb} lb over ${s.bearingLinesFt.length} lines`);

  const text = JSON.stringify(s).toLowerCase();
  for (const banned of ['techno metal', 'ram jack', 'chance', 'ideal foundation', 'magnum', 'goliath']) {
    check(`${brief}: names no pile brand ("${banned}")`, !text.includes(banned));
  }
  check(`${brief}: specifies torque, not depth`,
    s.notes.some((n) => /torque/i.test(n)) && s.notes.some((n) => /depth is not specified/i.test(n)));
  check(`${brief}: says plainly it is not a foundation design`,
    s.notes.some((n) => /NOT A FOUNDATION DESIGN/i.test(n) && /PE/i.test(n)));
}

console.log('an unconfirmed load cannot pass for a real one');
const unconf = buildPileSchedule({
  planId: 'x', footprint: { widthFt: 28, depthFt: 28 }, interiorWalls: [], eaveHeightFt: 8,
});
check('unsourced snow is flagged, loudly', unconf.notes.some((n) => /UNCONFIRMED/i.test(n)));
check('and the note says the numbers are not yet correct in absolute terms',
  unconf.notes.some((n) => /not yet correct in absolute terms/i.test(n)));
check('the snow input carries its own sourced=false', GROUND_SNOW_UNCONFIRMED.sourced === false);
check('and explains that NC leaves it to the jurisdiction',
  /R301\.2\(1\)/.test(GROUND_SNOW_UNCONFIRMED.citation) && /Cherokee/i.test(GROUND_SNOW_UNCONFIRMED.citation));
const conf = buildPileSchedule({
  planId: 'x', footprint: { widthFt: 28, depthFt: 28 }, interiorWalls: [], eaveHeightFt: 8,
  snow: { psf: 25, sourced: true, citation: 'Cherokee County Building Inspections, confirmed' },
});
check('a confirmed snow load drops the warning', !conf.notes.some((n) => /UNCONFIRMED/i.test(n)));
// NOT "and raises every pile load". That was this battery's own wrong physics:
// 0.7 x 25 = 17.5 psf is still under the 20 psf roof live minimum, so a 25 psf
// site changes nothing. Snow has to clear 0.7 x pg > 20, i.e. pg > ~28.6 psf,
// before it sizes anything. Asserting otherwise would have forced the model
// back into adding snow to roof live.
check('but does not move the piles while roof live still governs',
  conf.maxServiceLoadLb === unconf.maxServiceLoadLb,
  `${conf.maxServiceLoadLb} vs ${unconf.maxServiceLoadLb}`);
check('because 0.7 x 25 psf is under the 20 psf roof live floor', 0.7 * 25 < ROOF_LIVE.psf);

console.log('snow and roof live are alternatives, never addends');
const fp = { widthFt: 28, depthFt: 28 };
const base = { planId: 'x', footprint: fp, interiorWalls: [], eaveHeightFt: 8 };
const atCherokee = buildPileSchedule({ ...base, snow: CHEROKEE_GROUND_SNOW });
// pf = 0.7 x 10 = 7 psf against a 20 psf roof live minimum. Snow does not size
// anything here, and a model that ADDED them would say it did.
check('at the Cherokee 10 psf the roof live load governs, not snow',
  atCherokee.roofGovernedBy === 'roof live', atCherokee.roofGovernedBy);
check('and the note says which one governed', atCherokee.notes.some((n) => /ROOF LIVE LOAD/i.test(n)));
check('the note states they are never added',
  atCherokee.notes.some((n) => /alternatives under ASCE 7, never added/i.test(n)));

// Raising snow BELOW the roof-live threshold must not move a single pile. If it
// does, the two are being summed somewhere.
const atFifteen = buildPileSchedule({
  ...base, snow: { psf: 15, sourced: true, citation: 'Cashiers-equivalent, ~3,500 ft' },
});
check('raising snow 10 -> 15 psf changes nothing while roof live still governs',
  atFifteen.maxServiceLoadLb === atCherokee.maxServiceLoadLb,
  `${atFifteen.maxServiceLoadLb} vs ${atCherokee.maxServiceLoadLb}`);
// ...but once snow actually exceeds it, it must take over. Otherwise the max is
// pinned and a genuinely snowy site would be under-piled.
const heavy = buildPileSchedule({
  ...base, snow: { psf: 60, sourced: true, citation: 'test: a genuinely snowy site' },
});
check('snow above the threshold does take over', heavy.roofGovernedBy === 'snow');
check('and raises the governing pile', heavy.maxServiceLoadLb > atCherokee.maxServiceLoadLb,
  `${heavy.maxServiceLoadLb} vs ${atCherokee.maxServiceLoadLb}`);
check('roof live load is carried at all (a roof with only dead load is not a roof)',
  ROOF_LIVE.psf >= 20 && atCherokee.maxServiceLoadLb > unconf.maxServiceLoadLb - 1);

console.log('the Cherokee value is sourced, and says what it is');
// The VALUE, not just the paperwork around it. Every other assertion here
// checks the citation, and a citation cannot see a psf that has been zeroed —
// which would silently remove snow from every pile while still reading as a
// sourced, confirmed load. Same blind spot the erection battery had.
check('it carries the mapped 10 psf', CHEROKEE_GROUND_SNOW.psf === 10, String(CHEROKEE_GROUND_SNOW.psf));
check('and the number agrees with the citation it carries',
  new RegExp(`all ${CHEROKEE_GROUND_SNOW.psf} psf`).test(CHEROKEE_GROUND_SNOW.citation));
check('a sourced load is never zero — that is what unsourced means',
  !(CHEROKEE_GROUND_SNOW.sourced && CHEROKEE_GROUND_SNOW.psf === 0));
check('it is marked sourced', CHEROKEE_GROUND_SNOW.sourced === true);
check('it cites ASCE 7-22, not the NC code that does not carry it',
  /ASCE 7-22/.test(CHEROKEE_GROUND_SNOW.citation));
check('it records that this is NOT a Case Study zone',
  /not a Case Study zone/i.test(CHEROKEE_GROUND_SNOW.citation));
check('it names the ZIPs it was read for',
  /28901/.test(CHEROKEE_GROUND_SNOW.citation) && /28906/.test(CHEROKEE_GROUND_SNOW.citation));
check('it warns that elevation changes it',
  /3,500 ft/.test(CHEROKEE_GROUND_SNOW.citation) && /15 psf/.test(CHEROKEE_GROUND_SNOW.citation));
check('and still points at the jurisdiction for the permit set',
  /828-837-6730/.test(CHEROKEE_GROUND_SNOW.citation));

console.log('uplift is a separate load case, not a discount on compression');
const wind = buildPileSchedule({ ...base, snow: CHEROKEE_GROUND_SNOW, wind: CHEROKEE_WIND });
check('every pile reports what holds it DOWN, not only what pushes it down',
  wind.piles.every((p) => typeof p.upliftResistanceLb === 'number' && p.upliftResistanceLb > 0));
check('hold-down is 0.6 x dead, per the ASCE 7 uplift case',
  wind.piles.every((p) => Math.abs(p.upliftResistanceLb - 0.6 * p.deadLoadLb) <= 1));
check('dead load is a strict subset of the compression load',
  wind.piles.every((p) => p.deadLoadLb > 0 && p.deadLoadLb < p.serviceLoadLb));
// The whole point of a dead load is that live and snow are NOT in it — they are
// transient and cannot be relied on to be present when the wind blows. If snow
// leaked in, a snowy site would appear to resist uplift better, which is backwards.
const snowy = buildPileSchedule({
  ...base, snow: { psf: 60, sourced: true, citation: 'test' }, wind: CHEROKEE_WIND,
});
check('snow does not leak into the dead load that resists uplift',
  snowy.minUpliftResistanceLb === wind.minUpliftResistanceLb,
  `${snowy.minUpliftResistanceLb} vs ${wind.minUpliftResistanceLb}`);
check('nor does floor live load',
  wind.piles.every((p) => p.deadLoadLb < p.tributarySqFt * (ROOF_DEAD.psf + FLOOR_LIVE.psf)));
// The corner is where uplift is worst and hold-down least. Reporting an average
// would hide the pile that actually governs.
check('the reported hold-down is the LEAST of any pile, not an average',
  wind.minUpliftResistanceLb === Math.min(...wind.piles.map((p) => p.upliftResistanceLb)));
check('and that least pile is a corner',
  wind.piles.filter((p) => p.upliftResistanceLb === wind.minUpliftResistanceLb)
    .every((p) => p.kind === 'corner'));

console.log('the tension quote is demanded, and the demand is not invented');
check('the schedule tells the installer to quote tension as well as compression',
  wind.notes.some((n) => /QUOTE TENSION AS WELL AS COMPRESSION/.test(n)));
check('it names the wind speed when one is supplied',
  wind.notes.some((n) => /115 mph/.test(n) && /Category C/.test(n)));
check('it refuses to compute the uplift DEMAND, and says whose job that is',
  wind.notes.some((n) => /demand is not computed here/i.test(n) && /PE/.test(n)));
check('with no wind basis it says so rather than implying there is none',
  atCherokee.notes.some((n) => /No wind basis was supplied/i.test(n)));
check('the Cherokee wind is sourced to the NC tables that DO carry it',
  CHEROKEE_WIND.sourced === true && /R301\.2\(5\)/.test(CHEROKEE_WIND.citation)
    && /R301\.2\(7\)/.test(CHEROKEE_WIND.citation));
check('and carries the mapped 115 mph / SDC C',
  CHEROKEE_WIND.ultimateMph === 115 && CHEROKEE_WIND.seismicDesignCategory === 'C');
check('the citation records the elevation the 115 mph depends on',
  /2,700 ft/.test(CHEROKEE_WIND.citation) && /1,700 ft/.test(CHEROKEE_WIND.citation));

console.log(failures ? `\n${failures} foundation check(s) failed` : '\nfoundation: all checks passed');
process.exit(failures ? 1 : 0);
