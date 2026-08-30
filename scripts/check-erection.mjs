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
  SIP_AREAL_WEIGHT_PSF,
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

console.log(failures ? `\n${failures} erection check(s) failed` : '\nerection: all checks passed');
process.exit(failures ? 1 : 0);
