// Battery for the provider-neutral panel specification.
//
// This document exists to keep a buyer from being locked to one panel supplier,
// so the things worth gating are the ways it could quietly re-introduce lock-in:
//
//   1. It must never name a product. A thickness without a performance floor, or
//      a core, or a spline, is one manufacturer's line — and the moment it
//      appears the other quotes stop being comparable.
//   2. `switchable` must mean what it says. Claiming a supplier can be changed
//      mid-build when thickness is free would move interior faces and rough
//      openings on a half-built house. That is the one claim here with physical
//      consequences, so both halves of it are asserted.
//   3. A fixed thickness must be reachable by more than one core, or the
//      specification has one bidder and the exercise is pointless.
//
// Usage: node scripts/check-panel-spec.mjs (npm run check:panel-spec)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { buildPanelSpec, coresMeeting, CORE_R_PER_INCH } = await import(join(root, 'lib/kit/panel-spec.ts'));
const { JURISDICTION_PACKS } = await import(join(root, 'lib/standards/code-advisory.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

const nc = JURISDICTION_PACKS.find((p) => p.id === 'nc-cherokee-county');
const thermalEnvelope = nc?.thermalEnvelope;

const runs = [
  { id: 'w-n', kind: 'exterior', lengthFt: 28, heightFt: 10, openings: [{ id: 'd1', type: 'door', offsetFt: 12, widthFt: 3, headFt: 6.8 }] },
  { id: 'w-e', kind: 'exterior', lengthFt: 28, heightFt: 10, openings: [] },
  { id: 'p-1', kind: 'interior', lengthFt: 12, heightFt: 8, openings: [] },
];
const planes = [{ id: 'r-a', areaSqFt: 450, pitchDeg: 42 }, { id: 'r-b', areaSqFt: 450, pitchDeg: 42 }];

console.log('panel spec: the jurisdiction target is sourced, not invented');
{
  check('Cherokee County pack carries thermal targets', Boolean(thermalEnvelope));
  check('climate zone is stated', thermalEnvelope?.climateZone === '4A', thermalEnvelope?.climateZone);
  // NC AMENDS the IECC rather than adopting it: unamended 2015 IECC zone 4 asks
  // R-20 or R-13+5ci. Pinning 15 here is what stops a future edit "correcting"
  // it to the model-code number and over-specifying every wall in the state.
  check('wall target is the NC-amended R-15, not the model-code R-20',
    thermalEnvelope?.wallR === 15, String(thermalEnvelope?.wallR));
  check('ceiling target is R-38', thermalEnvelope?.ceilingR === 38, String(thermalEnvelope?.ceilingR));
  check('the numbers carry their citation', /NCECC 2018/.test(thermalEnvelope?.citation ?? ''));
  check('the citation names the table', /R402\.1\.2/.test(thermalEnvelope?.citation ?? ''));
}

console.log('\npanel spec: never names a product');
{
  const spec = buildPanelSpec({ planId: 'p', footprint: { widthFt: 28, depthFt: 28 }, wallRuns: runs, roofPlanes: planes, thermalEnvelope });
  const text = JSON.stringify(spec).toLowerCase();
  for (const banned of ['eps', 'polyurethane', 'osb', 'spline', 'insulspan', 'fischer', 'premier', 'eco-panel']) {
    // 'core material and spline type' appears in the EXCLUDES list by design —
    // naming what the manufacturer chooses is the opposite of specifying it.
    const inExcludes = spec.excludes.join(' ').toLowerCase().includes(banned);
    const elsewhere = JSON.stringify({ ...spec, excludes: [] }).toLowerCase().includes(banned);
    check(`does not specify "${banned}"`, !elsewhere, inExcludes ? '(appears only in excludes, correct)' : '');
  }
  check('states performance instead', spec.thermal?.wallMinR === 15);
  check('carries wall runs, not panels', spec.wallRuns.length === 3 && !text.includes('"panels"'));
  check('rough openings travel with their run', spec.wallRuns[0].openings.length === 1);
}

console.log('\npanel spec: switchable means what it claims');
{
  const free = buildPanelSpec({ footprint: { widthFt: 28, depthFt: 28 }, wallRuns: runs, roofPlanes: planes, thermalEnvelope });
  check('no fixed thickness => NOT switchable', free.switchable === false);
  check('and says why in dimensional terms', /interior faces|foundation/i.test(free.switchableBasis));

  const fixed = buildPanelSpec({ footprint: { widthFt: 28, depthFt: 28 }, wallRuns: runs, roofPlanes: planes, thermalEnvelope, nominalThicknessIn: 4.5 });
  check('fixed thickness + performance floor => switchable', fixed.switchable === true);
  check('the basis states the thickness and the R', /4\.5 in/.test(fixed.switchableBasis) && /R-15/.test(fixed.switchableBasis));

  // Thickness alone is the dangerous middle case: dimensions line up, so it
  // LOOKS interchangeable, while the wall delivered may be materially worse.
  const noFloor = buildPanelSpec({ footprint: { widthFt: 28, depthFt: 28 }, wallRuns: runs, roofPlanes: planes, nominalThicknessIn: 4.5 });
  check('fixed thickness with NO performance floor => not switchable', noFloor.switchable === false);
  check('and is called out as not equivalent', /may not be equivalent/i.test(noFloor.switchableBasis));
}

console.log('\npanel spec: a fixed thickness must have more than one bidder');
{
  // R-15 at 4.5 in: EPS reaches 17.6, polyurethane 31.5 — two cores, real
  // competition. This is the number that makes the whole model work in 4A.
  const at45 = coresMeeting(15, 4.5);
  check('R-15 at 4.5 in is reachable by both cores', at45.length === 2, at45.join(', '));
  // R-40 at 4.5 in: neither core reaches it. A spec like that has no bidders,
  // which is a worse failure than lock-in and should be visible immediately.
  const hard = coresMeeting(40, 4.5);
  check('R-40 at 4.5 in is reachable by neither', hard.length === 0, hard.join(', '));
  // R-40 at 6.5 in: polyurethane only. One bidder is lock-in by arithmetic.
  const one = coresMeeting(40, 6.5);
  check('R-40 at 6.5 in narrows to a single core', one.length === 1, one.join(', '));
  check('core R/inch values are the published ones',
    CORE_R_PER_INCH.eps === 3.9 && CORE_R_PER_INCH.polyurethane === 7.0);
}

console.log('');
if (failures) {
  console.error(`${failures} panel-spec check(s) failed`);
  process.exit(1);
}
console.log('panel-spec battery clean');
