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
const { thicknessOptions, recommendThickness, assessCompetition, compareBids, compareBidsByCurrency,
  REGIONAL_SUPPLIERS, CORE_R_PER_INCH, CORE_THICKNESS_LADDER,
  CORE_R_BY_THICKNESS, publishedR, bidPackages, CORE_MAX_PANEL_FT } =
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
  check('12.25 in is ALSO single-source — EPS only, since PU is not made that thick',
    rec.lockInTraps.some((t) => t.thicknessIn === 12.25 && t.bidders.join() === 'eps'));
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
  check('at different thicknesses', roof.thicknessByCore.eps === 12.25 && roof.thicknessByCore.polyurethane === 6.5,
    JSON.stringify(roof.thicknessByCore));
  check('and the note says tender per build, not mid-build',
    /per build, not mid-build/i.test(roof.note));

  // The ci path the code also allows: still competitive, and thinner for both.
  const ci = assessCompetition(30);
  check('the R-30ci ceiling path is also competitive', ci.mode === 'competitive', ci.mode);
  check('and lets EPS use a thinner panel than R-38 needs',
    ci.thicknessByCore.eps === 10.25, JSON.stringify(ci.thicknessByCore));
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
  // The module must not exceed the narrowest panel any core makes, or the grid
  // itself excludes a bidder before anyone quotes.
  check('a 4 ft module keeps both cores in the race',
    Math.min(...Object.values(CORE_MAX_PANEL_FT).map((p) => p.widthFt)) === 4,
    Object.values(CORE_MAX_PANEL_FT).map((p) => p.widthFt).join(','));
  check('and the span limit matches the shortest panel made',
    Math.min(...Object.values(CORE_MAX_PANEL_FT).map((p) => p.lengthFt)) === 16);
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

console.log('\nsourcing: compliance uses PUBLISHED R, never a rate');
{
  // The rate model over-stated every EPS thickness by 2.6-3.4 R, because R per
  // inch is not constant -- the OSB skins are a fixed contribution, so effective
  // R/in climbs 3.33 -> 3.62 across the range. That pushed every roof answer a
  // full step too thin. These pin the published values so the rate cannot creep
  // back into a compliance decision.
  check('4.5 in EPS is the published R-15.0, not the rate model 17.6',
    publishedR('eps', 4.5) === 15.0, String(publishedR('eps', 4.5)));
  check('10.25 in EPS is R-36.8 and therefore does NOT meet R-38',
    publishedR('eps', 10.25) === 36.8 && publishedR('eps', 10.25) < 38);
  check('R-38 in EPS needs 12.25 in', publishedR('eps', 12.25) >= 38, String(publishedR('eps', 12.25)));
  check('a thickness nobody publishes returns undefined, not an interpolation',
    publishedR('eps', 7) === undefined && publishedR('polyurethane', 10.25) === undefined);
  // Effective R/inch rises with thickness; a single rate cannot express that.
  const eff = Object.entries(CORE_R_BY_THICKNESS.eps).map(([t, r]) => r / Number(t));
  check('effective R/inch is not constant across the EPS range',
    Math.max(...eff) - Math.min(...eff) > 0.2, `${Math.min(...eff).toFixed(2)}-${Math.max(...eff).toFixed(2)}`);
  // Polyurethane is published as ranges; we carry the conservative end.
  check('polyurethane 4.5 in uses the low end of its published range',
    CORE_R_BY_THICKNESS.polyurethane[4.5] === 26);
}

console.log('\nsourcing: bid packages — two compliant quotes is the whole requirement');
{
  const pk = bidPackages([
    { element: 'Wall', minR: nc.wallR, basis: 'NCECC 2018 Table R402.1.2, zone 4' },
    { element: 'Ceiling', minR: nc.ceilingR, basis: 'NCECC 2018 Table R402.1.2, zone 4' },
  ]);
  const wall = pk.find((p) => p.element === 'Wall');
  const ceil = pk.find((p) => p.element === 'Ceiling');

  // The requirement is two COMPLIANT bids, not a thin one. Overbuild is
  // expected and must never read as a fault.
  check('both cores can bid the wall', wall.everyCoreCanBid, wall.lines.map((l) => l.core).join());
  check('both cores can bid the ceiling', ceil.everyCoreCanBid, ceil.lines.map((l) => l.core).join());
  check('each line is genuinely compliant, never under target',
    pk.every((p) => p.lines.every((l) => l.publishedR >= p.minR)));
  check('overbuild is reported per core, not minimised away',
    ceil.lines.find((l) => l.core === 'eps').overbuildR === 6.4
    && ceil.lines.find((l) => l.core === 'polyurethane').overbuildR === 2);

  // The zero-margin wall is the one thing here worth surfacing: it complies at
  // exactly R-15.0 and has nothing left if anything moves.
  check('the zero-margin EPS wall is flagged, not buried',
    /EXACTLY/.test(wall.note) && /no margin/.test(wall.note));
  check('and the ceiling note just says compare on price',
    /compare on price/.test(ceil.note));

  // A target no core can meet is the only real blocker, and must be named.
  const impossible = bidPackages([{ element: 'Wall', minR: 300, basis: 'test' }])[0];
  check('an unmeetable target reports everyCoreCanBid false', impossible.everyCoreCanBid === false);
  check('and says nobody can bid it', /cannot bid this element/.test(impossible.note));
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
console.log('bids in different currencies are not comparable numbers');
// The expected two-bidder case here is a US maker against a Canadian one, so
// this is the normal case, not an edge case. Ranking them as bare numbers names
// the wrong winner: 27,200 CAD sorts below 27,700 USD while being thousands
// cheaper, and with other numbers the ranking inverts outright.
const usd = { supplier: 'US maker', panelCost: 20000, freightCost: 2500, installHours: 80, hourlyRate: 65, currency: 'USD' };
const cad = { supplier: 'CA maker', panelCost: 19000, freightCost: 3000, installHours: 80, hourlyRate: 65, currency: 'CAD' };
let threw = null;
try { compareBids([usd, cad]); } catch (err) { threw = err; }
check('ranking across currencies is refused, not guessed', threw !== null,
  threw ? '' : 'it returned a ranking');
check('and the refusal names both currencies',
  Boolean(threw && /USD/.test(threw.message) && /CAD/.test(threw.message)), threw?.message ?? '');
check('and does not offer a built-in exchange rate',
  Boolean(threw && /rate you\s+own/.test(threw.message)), threw?.message ?? '');
// A single currency must still rank normally, or the guard has broken the tool.
const same = compareBids([usd, { ...cad, currency: 'USD' }]);
check('one currency still ranks, cheapest first', same.length === 2
  && same[0].totalDelivered <= same[1].totalDelivered);
const grouped = compareBidsByCurrency([usd, cad]);
check('grouping gives each currency its own ranking', grouped.length === 2
  && grouped.every((g) => g.bids.length === 1));
check('and never claims a winner across the groups',
  grouped.every((g) => g.bids.every((b) => b.currency === g.currency)));
// A missing currency must default consistently, or two undefined bids would be
// treated as two different currencies and refuse to rank at all.
check('an unstated currency defaults to USD rather than becoming its own group',
  compareBidsByCurrency([{ ...usd, currency: undefined }, { ...usd, supplier: 'B' }]).length === 1);

if (failures) {
  console.error(`${failures} sourcing check(s) failed`);
  process.exit(1);
}
console.log('sourcing battery clean');