// Battery for the sourcing analysis.
//
// The job of this module is to stop a specification quietly deleting a bidder,
// so the checks are about the ways that happens:
//
//   1. The roof trap must stay visible. At R-38 a 6.5 in panel complies and has
//      exactly one possible core. It is the thickness a polyurethane supplier
//      would reasonably propose and the one that ends the tender, so the
//      single-source flag on it is the single most load-bearing output here.
//   2. The recommendation must prefer competition over thinness, and must say
//      what that costs. A recommendation that silently picked the thicker panel
//      would be making a commercial decision on the buyer's behalf.
//   3. Bids must rank on TOTAL delivered cost. Ranking on panel price is how a
//      distant plant with a slow joint wins on paper and loses on site.
//   4. Connection method must never leak into the specification side. It is
//      scored through install hours; naming it is the lock-in we are avoiding.
//
// Usage: node scripts/check-sourcing.mjs (npm run check:sourcing)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { thicknessOptions, recommendThickness, compareBids, REGIONAL_SUPPLIERS, CORE_R_PER_INCH } =
  await import(join(root, 'lib/kit/sourcing.ts'));
const { JURISDICTION_PACKS } = await import(join(root, 'lib/standards/code-advisory.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

const nc = JURISDICTION_PACKS.find((p) => p.id === 'nc-cherokee-county')?.thermalEnvelope;

console.log('sourcing: the wall target keeps competition at the thinnest standard panel');
{
  const rec = recommendThickness(nc.wallR); // R-15
  check('wall recommendation is 4.5 in', rec.recommended?.thicknessIn === 4.5, String(rec.recommended?.thicknessIn));
  check('two cores can bid there', rec.recommended?.bidders.length === 2, rec.recommended?.bidders.join(', '));
  // I expected this to be zero and it is not — the thinnest COMPLIANT wall is
  // 3 in, which polyurethane meets at R-21 and EPS cannot touch. Getting a
  // second core into the race costs 1.5 in of panel. Competition is not free on
  // the wall either; it is just cheaper than on the roof (1.5 in against 3.75).
  check('competition on the wall costs 1.5 in, not nothing',
    rec.interchangeabilityCostIn === 1.5, String(rec.interchangeabilityCostIn));
  check('and the thinnest compliant wall is the single-source 3 in',
    rec.thinnestCompliant?.thicknessIn === 3 && rec.thinnestCompliant?.singleSource === true);
  check('3 in is flagged as a single-source trap',
    rec.lockInTraps.some((t) => t.thicknessIn === 3), rec.lockInTraps.map((t) => t.thicknessIn).join(', '));
}

console.log('\nsourcing: THE ROOF IS WHERE THE LOCK-IN HIDES');
{
  const rec = recommendThickness(nc.ceilingR); // R-38
  // 6.5 in complies at R-46 in polyurethane and R-25 in EPS. It is the obvious
  // panel and it has one supplier. If this check ever goes quiet, the analysis
  // has stopped doing the only thing it was built for.
  const trap = rec.lockInTraps.find((t) => t.thicknessIn === 6.5);
  check('6.5 in roof is identified as single-source', Boolean(trap), rec.lockInTraps.map((t) => t.thicknessIn).join(', '));
  check('and names polyurethane as the only bidder', trap?.bidders.join(',') === 'polyurethane', trap?.bidders.join(','));
  check('8.25 in is also single-source', rec.lockInTraps.some((t) => t.thicknessIn === 8.25));
  check('recommendation moves to 10.25 in to keep two bidders', rec.recommended?.thicknessIn === 10.25, String(rec.recommended?.thicknessIn));
  check('the interchangeability cost is stated in inches', rec.interchangeabilityCostIn === 3.75, String(rec.interchangeabilityCostIn));
  check('the note explains the trade rather than hiding it',
    /price of being able to re-tender/i.test(rec.note ?? ''));
  // Overshoot is what the buyer pays for competition: at 10.25 in polyurethane
  // is R-72 against a R-38 target. Real money, and it should be visible.
  check('overshoot is quantified for the over-specified core',
    (rec.recommended?.overshootR.polyurethane ?? 0) > 30, String(rec.recommended?.overshootR.polyurethane));
}

console.log('\nsourcing: an impossible target is called impossible');
{
  const rec = recommendThickness(200);
  check('no standard thickness qualifies', rec.recommended === undefined && rec.thinnestCompliant === undefined);
  check('and it says single-source or custom', /single-source or custom/i.test(rec.note));
}

console.log('\nsourcing: bids rank on total delivered cost, not panel price');
{
  // Deliberate shape: the CHEAPEST panels come from the slowest, most distant
  // option, which is exactly the case panel-price ranking gets wrong.
  const ranked = compareBids([
    { supplier: 'far-cheap-panels', panelCost: 18000, freightCost: 4200, installHours: 260, hourlyRate: 55 },
    { supplier: 'near-fast-joint', panelCost: 21000, freightCost: 900, installHours: 120, hourlyRate: 55 },
  ]);
  check('the near plant with the faster joint wins on total', ranked[0].supplier === 'near-fast-joint', ranked[0].supplier);
  check('despite having the more expensive panels',
    ranked[0].panelCost > ranked[1].panelCost, `${ranked[0].panelCost} vs ${ranked[1].panelCost}`);
  check('install labour is costed, not ignored', ranked[0].installCost === 120 * 55, String(ranked[0].installCost));
  check('total is the sum of all three terms',
    ranked[0].totalDelivered === 21000 + 900 + 120 * 55, String(ranked[0].totalDelivered));
  check('results are ordered cheapest-first', ranked[0].totalDelivered <= ranked[1].totalDelivered);
}

console.log('\nsourcing: supplier data is honest about what was verified');
{
  check('regional suppliers are listed', REGIONAL_SUPPLIERS.length >= 4, String(REGIONAL_SUPPLIERS.length));
  check('every supplier carries a provenance mark',
    REGIONAL_SUPPLIERS.every((s) => s.provenance === 'verified' || s.provenance === 'search-summary'));
  // Only the cam-latch claim was read at source; the rest came from a search
  // and must not masquerade as confirmed.
  const eco = REGIONAL_SUPPLIERS.find((s) => /eco-panels/i.test(s.name));
  check('the cam-latch supplier is the verified one', eco?.provenance === 'verified');
  check('connection method is recorded per supplier, for scoring',
    REGIONAL_SUPPLIERS.every((s) => typeof s.connection === 'string' && s.connection.length > 0));
  // No distances: none were measured, and an invented mileage would land
  // straight in a freight number looking precise.
  check('no distances are asserted', !JSON.stringify(REGIONAL_SUPPLIERS).match(/\bmiles?\b|\bmi\b/i));
  check('core R/inch are the published values', CORE_R_PER_INCH.eps === 3.9 && CORE_R_PER_INCH.polyurethane === 7.0);
}

console.log('');
if (failures) {
  console.error(`${failures} sourcing check(s) failed`);
  process.exit(1);
}
console.log('sourcing battery clean');
