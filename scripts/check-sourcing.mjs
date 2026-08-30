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
const { thicknessOptions, recommendThickness, assessCompetition, compareBids,
  REGIONAL_SUPPLIERS, CORE_R_PER_INCH, CORE_THICKNESS_LADDER, CORE_MAX_PANEL_WIDTH_FT } =
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
  check('and the thinnest compliant wall is the single-source 3 in (polyurethane only)',
    rec.thinnestCompliant?.thicknessIn === 3 && rec.thinnestCompliant?.singleSource === true);
  check('3 in is flagged as a single-source trap',
    rec.lockInTraps.some((t) => t.thicknessIn === 3), rec.lockInTraps.map((t) => t.thicknessIn).join(', '));
}

console.log('\nsourcing: THE ROOF IS WHERE THE LOCK-IN HIDES');
{
  // CORRECTED. An earlier version asserted 10.25 in "keeps two cores bidding"
  // at R-38. It does not: polyurethane is not manufactured above 8.125 in, so at
  // 10.25 in only EPS exists. Reasoning from R-per-inch alone produced a
  // recommendation no supplier could fill, and these checks now pin the product
  // ladder as well as the physics.
  const rec = recommendThickness(nc.ceilingR); // R-38
  check('no single thickness gives the roof two bidders at R-38',
    rec.recommended === undefined, String(rec.recommended?.thicknessIn));
  check('6.5 in is single-source (polyurethane only reaches R-38 there)',
    rec.lockInTraps.some((t) => t.thicknessIn === 6.5 && t.bidders.join() === 'polyurethane'));
  check('10.25 in is ALSO single-source — EPS only, since PU is not made that thick',
    rec.lockInTraps.some((t) => t.thicknessIn === 10.25 && t.bidders.join() === 'eps'));
  check('the note says the target is single-source or custom',
    /single-source or custom/i.test(rec.note));
}

console.log('\nsourcing: competition without interchangeability is its own answer');
{
  const wall = assessCompetition(nc.wallR); // R-15
  check('wall is interchangeable at a common thickness', wall.mode === 'interchangeable', wall.mode);
  check('and names that common thickness', wall.commonThicknessIn === 4.5, String(wall.commonThicknessIn));

  // The roof is the case the yes/no model could not express: both cores CAN
  // bid, just at different depths. Returning "no recommendation" reads as
  // failure when it is in fact the correct specification.
  const roof = assessCompetition(nc.ceilingR); // R-38
  check('roof is competitive but NOT interchangeable', roof.mode === 'competitive', roof.mode);
  check('both cores can still bid the roof', roof.capableCores.length === 2, roof.capableCores.join(','));
  check('at different thicknesses', roof.thicknessByCore.eps === 10.25 && roof.thicknessByCore.polyurethane === 6.5,
    JSON.stringify(roof.thicknessByCore));
  check('and the note says tender per build, not mid-build',
    /per build, not mid-build/i.test(roof.note));

  // The ci path the code also allows: still competitive, and thinner for both.
  const ci = assessCompetition(30);
  check('the R-30ci ceiling path is also competitive', ci.mode === 'competitive', ci.mode);
  check('and lets both cores use a thinner panel',
    ci.thicknessByCore.eps === 8.25 && ci.thicknessByCore.polyurethane === 4.5,
    JSON.stringify(ci.thicknessByCore));
}

console.log('\nsourcing: product ladders constrain who can bid, not just R/inch');
{
  check('polyurethane is not manufactured above 8.125 in',
    !CORE_THICKNESS_LADDER.polyurethane.some((t) => t > 8.125));
  check('EPS is manufactured to 12.25 in', CORE_THICKNESS_LADDER.eps.includes(12.25));
  check('only 4.5 and 6.5 are common to both ladders',
    CORE_THICKNESS_LADDER.eps.filter((t) => CORE_THICKNESS_LADDER.polyurethane.includes(t)).join() === '4.5,6.5');
  // Our 4 ft structural grid, inherited from WikiHouse, is also the widest
  // module BOTH cores are made in. Designing to 8 ft would silently exclude
  // the polyurethane supplier.
  check('a 4 ft module keeps both cores in the race',
    Math.min(...Object.values(CORE_MAX_PANEL_WIDTH_FT)) === 4);
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
