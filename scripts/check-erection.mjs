// Battery for the crane-free erection constraint.
//
// The build method — a compact telehandler plus a mini excavator with a torque
// head — is a cost decision: no crane. What makes it worth gating is that the
// intuitive constraint is the wrong one. A SIP is light, so capacity never
// binds; REACH binds, and reach is a property of the roof, not the panel. A
// plan can therefore pass every panel gate we have and still be unbuildable
// with the machine on site.
//
// So this asserts the findings that cost money if they silently regress:
//   1. Capacity does not bind for any panel we can produce.
//   2. A machine short of the ridge is reported as short, not as marginal.
//   3. A roof no machine can reach says so, in terms that name the way out.
//   4. A machine too wide for the 8 ft path is excluded on width alone.
//
// Usage: node scripts/check-erection.mjs (npm run check:erection)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  assessErection, panelWeightLb, LIFT_MACHINES, SITE_ACCESS_WIDTH_FT, LANDING_CLEARANCE_FT,
  SIP_AREAL_WEIGHT_PSF, capacityOnGrade, gradePctToDeg, declaredEnvelope, ENVELOPE_MARGIN_FT,
  SLOPE_CHART_VALID_DEG, SLOPE_DERATE_TRIGGER_DEG, SLOPE_DERATE_MIN_PCT,
} = await import(join(root, 'lib/kit/erection.ts'));
const { MAX_PANEL_SPAN_FT, CORE_MAX_PANEL_FT } = await import(join(root, 'lib/kit/sip.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

// The largest panel any core in the ladder can produce. If capacity does not
// bind for THIS, it does not bind at all.
const biggest = Math.max(...Object.values(CORE_MAX_PANEL_FT).map((p) => p.widthFt * p.lengthFt));
const heaviest = panelWeightLb(biggest);

console.log('panel weight');
check('the published 4.5 in figure is ~3.1 psf', Math.abs(SIP_AREAL_WEIGHT_PSF - 3.125) < 0.01);
// Bounded from BELOW as well as above. Every other assertion here is a
// ceiling, and a ceiling cannot see a weight that has collapsed toward zero —
// which would make capacity look non-binding for the very reason it is not.
// The published 4x8 panel is the anchor: 32 sq ft at ~100 lb.
const ref = panelWeightLb(32, SIP_AREAL_WEIGHT_PSF);
check('a 4x8 panel weighs about the published 100 lb', Math.abs(ref - 100) <= 5, `${ref} lb`);
check('the planning weight is heavier than the published one, never lighter',
  panelWeightLb(32) >= ref, `${panelWeightLb(32)} vs ${ref}`);
check(`the largest producible panel (${biggest} sq ft) weighs a plausible 500-1000 lb`,
  heaviest > 500 && heaviest < 1000, `${heaviest} lb`);
check('and is under every machine rating', LIFT_MACHINES.every((m) => m.ratedCapacityLb > heaviest),
  LIFT_MACHINES.filter((m) => m.ratedCapacityLb <= heaviest).map((m) => m.name).join(','));
check('every machine carries a source for its numbers',
  LIFT_MACHINES.every((m) => typeof m.source === 'string' && m.source.length > 20));

console.log('reach, not capacity, is the binding constraint');
const tall = assessErection(18, biggest);
check('a machine short of the ridge is not offered as capable',
  !tall.capable.some((m) => m.maxLiftFt < 18), tall.capable.map((m) => m.name).join(','));
check('an 18 ft ridge defeats the whole set crane-free', tall.capable.length === 0,
  tall.capable.map((m) => m.name).join(','));
check('and the note names the ways out, not just the failure',
  tall.notes.some((n) => /staging|lower the ridge|crane/i.test(n)));
check('the capacity note states reach is what binds',
  tall.notes.some((n) => /Capacity is not the constraint/i.test(n)));

// The finding that started this: the JCB is in a different product class.
const mid = assessErection(14, biggest);
const jcb = LIFT_MACHINES.find((m) => m.id === 'jcb-515-40');
check('the 13 ft machine cannot set a 14 ft ridge', !mid.capable.includes(jcb) && !mid.marginal.includes(jcb));
check('and is reported as short of the seat, not merely tight',
  mid.notes.some((n) => /cannot reach the 14 ft ridge/i.test(n)));
check('the 18 ft machines do carry a 14 ft ridge', mid.capable.length === 2,
  mid.capable.map((m) => m.name).join(','));

console.log('clearance is an allowance, and is applied');
const exact = assessErection(18.33 - LANDING_CLEARANCE_FT, biggest);
check('a machine with exactly the allowance is capable',
  exact.capable.some((m) => m.id === 'jlg-g5-18a'));
const tight = assessErection(18.33, biggest);
check('a machine reaching the ridge with no room to land is marginal, never capable',
  tight.marginal.some((m) => m.id === 'jlg-g5-18a') && !tight.capable.some((m) => m.id === 'jlg-g5-18a'));

console.log('site access');
check(`every listed machine fits the ${SITE_ACCESS_WIDTH_FT} ft path`,
  LIFT_MACHINES.every((m) => m.widthFt <= SITE_ACCESS_WIDTH_FT),
  LIFT_MACHINES.filter((m) => m.widthFt > SITE_ACCESS_WIDTH_FT).map((m) => m.name).join(','));
const wide = assessErection(12, biggest,
  [...LIFT_MACHINES, { id: 'x', name: 'Too Wide', maxLiftFt: 40, ratedCapacityLb: 20000, widthFt: 9, source: 'x'.repeat(25) }]);
check('a machine too wide for the path is excluded on width alone',
  !wide.capable.some((m) => m.id === 'x'));
check('and the exclusion says why', wide.notes.some((n) => /will not fit the 8 ft approach path/i.test(n)));

// A panel longer than we allow would change the answer, so the two limits are
// asserted against each other rather than left to drift apart.
check(`the span ceiling (${MAX_PANEL_SPAN_FT} ft) still bounds the panel this battery weighs`,
  Math.max(...Object.values(CORE_MAX_PANEL_FT).map((p) => p.lengthFt)) >= MAX_PANEL_SPAN_FT);

console.log('a badge capacity is a level-ground number');
// Mountain ground invalidates the load chart before it threatens the load. A
// chart holds within about 3 deg; past 5 deg of side slope at least 20% comes
// off. Comparing panel weight against a BADGE capacity on sloping ground is the
// quiet version of the missing-term bug this battery already guards elsewhere.
check('a grade inside the derate threshold changes nothing',
  capacityOnGrade(5000, 5) === 5000);
check('a grade past it takes at least the published derate off',
  capacityOnGrade(5000, 20) <= 5000 * (1 - SLOPE_DERATE_MIN_PCT / 100),
  String(capacityOnGrade(5000, 20)));
check('an unstated grade is not silently treated as steep',
  capacityOnGrade(5000, undefined) === 5000);
check('the degree conversion is right (12.8% is about 7.3 deg)',
  Math.abs(gradePctToDeg(12.8) - 7.29) < 0.05, gradePctToDeg(12.8).toFixed(2));
check('the derate threshold is above the chart-validity limit',
  SLOPE_DERATE_TRIGGER_DEG > SLOPE_CHART_VALID_DEG);

// A steep site must be ASSESSED against the derated figure, not the badge.
const steep = assessErection(14, biggest, LIFT_MACHINES, 12.8);
const level = assessErection(14, biggest, LIFT_MACHINES);
check('a steep site is assessed against derated capacity',
  steep.notes.some((n) => /grade-derated capacities/.test(n)));
check('and a level one against the ratings', level.notes.some((n) => /against ratings of/.test(n)));
check('the grade is carried on the result, not silently dropped', steep.siteGradePct === 12.8);
// The conclusion has to SURVIVE the derate, or it was never really established.
check('reach still binds after the derate — capacity margin is that large',
  steep.capable.length === level.capable.length,
  `${steep.capable.length} vs ${level.capable.length}`);
// The assertions above cannot tell a derated assessment from a badge one,
// because our panels are so light that both answers agree. A test that cannot
// discriminate is not a test. This panel is deliberately sized to sit BETWEEN
// the badge capacity and the derated one, so only a model that actually applies
// the derate gets it right.
const jcbOnly = LIFT_MACHINES.filter((m) => m.id === 'jcb-515-40');
const betweenLb = (jcb) => {
  const badge = jcb.ratedCapacityLb;
  const derated = capacityOnGrade(badge, 12.8);
  return (badge + derated) / 2; // comfortably between the two
};
const jcb0 = jcbOnly[0];
const areaBetween = betweenLb(jcb0) / 4.5; // the planning psf
check('a load between badge and derated capacity IS carried on level ground',
  assessErection(10, areaBetween, jcbOnly).capable.length === 1);
check('...and is NOT carried once the grade derate applies',
  assessErection(10, areaBetween, jcbOnly, 12.8).capable.length === 0,
  `${panelWeightLb(areaBetween)} lb vs badge ${jcb0.ratedCapacityLb}, `
  + `derated ${capacityOnGrade(jcb0.ratedCapacityLb, 12.8)}`);

check('the site-work consequence is stated: bench the setting pads',
  steep.notes.some((n) => /BENCH THE SETTING PADS/.test(n)));
check('and it names the grade in both percent and degrees',
  steep.notes.some((n) => /12\.8%/.test(n) && /7\.3 deg/.test(n)));
check('a genuinely flat site raises no benching note',
  !assessErection(14, biggest, LIFT_MACHINES, 2).notes.some((n) => /BENCH/.test(n)));

console.log('the height that goes on the FAA form');
// Form 7460-1 asks for maximum height INCLUDING construction equipment, which
// makes the machine a filing decision, not only a cost one. The two heights are
// alternatives, not addends: the boom is above the roof while it works, the roof
// is there afterwards. Summing them would over-declare by a whole storey.
const merlo = LIFT_MACHINES.find((m) => m.id === 'merlo-p27-6');
const shortBuilding = declaredEnvelope(14, merlo);
check('equipment governs when it out-reaches the building',
  shortBuilding.governedBy === 'equipment' && shortBuilding.maxHeightFt === merlo.maxLiftFt,
  `${shortBuilding.maxHeightFt}`);
const tallBuilding = declaredEnvelope(30, merlo);
check('the structure governs when it is taller than the machine',
  tallBuilding.governedBy === 'structure' && tallBuilding.maxHeightFt === 30);
check('the two are never summed', shortBuilding.maxHeightFt < 14 + merlo.maxLiftFt
  && tallBuilding.maxHeightFt < 30 + merlo.maxLiftFt);
check('the declared figure carries margin over the computed one',
  shortBuilding.declareFt >= shortBuilding.maxHeightFt + ENVELOPE_MARGIN_FT);
check('and margin is a whole number of feet, as a form expects',
  Number.isInteger(shortBuilding.declareFt));
// A crane would declare a different building. This is the comparison that makes
// the machine choice legible as a filing decision.
const crane = { id: 'c', name: 'Crane', maxLiftFt: 100, ratedCapacityLb: 40000, widthFt: 7, source: 'x'.repeat(25) };
check('a crane declares far more height for the identical building',
  declaredEnvelope(14, crane).maxHeightFt > shortBuilding.maxHeightFt + 70);

const assessed = assessErection(14, biggest, LIFT_MACHINES, 12.8);
check('the assessment carries an envelope for a buildable plan', Boolean(assessed.envelope));
check('declared against a machine that can actually set the roof',
  assessed.capable.some((m) => m.maxLiftFt === assessed.envelope.machineFt),
  `${assessed.envelope?.machineFt}`);
check('and the note tells the filer to declare the envelope, not the exact height',
  assessed.notes.some((n) => /FAA DECLARATION/.test(n) && /18 months/.test(n)));
// A roof no machine can set has no honest envelope to declare.
const impossible = assessErection(40, biggest);
check('an unbuildable roof declares nothing rather than inventing a machine',
  impossible.capable.length === 0 && impossible.envelope === undefined);

console.log(failures ? `\n${failures} erection check(s) failed` : '\nerection: all checks passed');
process.exit(failures ? 1 : 0);
