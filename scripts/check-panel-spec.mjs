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
const { buildPanelSpec, coresMeeting, CORE_R_PER_INCH, adaptArtifactToPanelGeometry } =
  await import(join(root, 'lib/kit/panel-spec.ts'));
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));

const BRIEFS = [
  '1 bed a-frame roof, 80x100 lot, 10 ft setbacks',
  '2 bed gable roof, 80x100 lot, 10 ft setbacks',
  '3 bed barn roof, 100x120 lot, 10 ft setbacks',
  '2 bed flat roof, 80x100 lot, 10 ft setbacks',
];
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

console.log('adapter: geometry survives the crossing intact');
for (const brief of BRIEFS) {
  const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'adapt', brief);
  if (!res.ok) { check(`${brief}: compiles`, false, res.errors.join('; ')); continue; }
  const a = res.artifact;
  const g = adaptArtifactToPanelGeometry(a);

  const extWalls = (a.exteriorWalls ?? []).filter((w) => w.span);
  const extRuns = g.wallRuns.filter((r) => r.kind === 'exterior');
  check(`${brief}: every exterior wall becomes a run`, extRuns.length === extWalls.length,
    `${extRuns.length} vs ${extWalls.length}`);

  // Runs are quoted to the plate, never the ridge. On a pitched roof those
  // differ a lot, and getting it backwards over-quotes every wall.
  const eave = a.roof.eaveHeightFt;
  const ridge = a.roof.ridgeHeightFt;
  // Plate walls stop at the plate; gable ends report their apex, because that
  // is the height that actually contains their openings.
  check(`${brief}: plate walls are quoted to the ${eave} ft plate`,
    extRuns.filter((r) => r.profile === 'plate').every((r) => Math.abs(r.heightFt - eave) < 0.01),
    extRuns.filter((r) => r.profile === 'plate').map((r) => r.heightFt).join(','));
  if (ridge > eave + 0.01) {
    const gables = extRuns.filter((r) => r.profile === 'gable-end');
    check(`${brief}: gable ends are identified`, gables.length > 0, String(gables.length));
    check(`${brief}: and reported to the ${ridge} ft apex`,
      gables.every((r) => Math.abs(r.heightFt - ridge) < 0.01), gables.map((r) => r.heightFt).join(','));
    check(`${brief}: the note warns area is not length x height`,
      g.notes.some((n) => /NOT length x height/i.test(n)));
    // The take-off itself. A gable end is a rectangle to the plate plus a
    // triangle to the ridge; quoting length x apex over-states it by the
    // triangle's own area again, which on a 6 ft rise is a quarter of the wall.
    // Two bidders taking this off by hand is exactly the variance that makes
    // their prices incomparable, which is the point of sending a spec at all.
    for (const r of gables) {
      const want = r.lengthFt * eave + (r.lengthFt * (ridge - eave)) / 2;
      check(`${brief}: ${r.id} area is the rectangle plus the triangle`,
        Math.abs(r.grossAreaSqFt - want) < 0.02, `${r.grossAreaSqFt} vs ${want.toFixed(2)}`);
      check(`${brief}: ${r.id} is not quoted as length x apex`,
        r.grossAreaSqFt < r.lengthFt * r.heightFt - 0.02,
        `${r.grossAreaSqFt} vs naive ${(r.lengthFt * r.heightFt).toFixed(2)}`);
    }
  }
  // Plate walls are the simple case, and the one a refactor is most likely to
  // break while the gable maths still passes.
  check(`${brief}: plate areas are length x plate height`,
    extRuns.filter((r) => r.profile === 'plate')
      .every((r) => Math.abs(r.grossAreaSqFt - r.lengthFt * eave) < 0.02));
  // A slope facade is roof. Quoting it as wall area sells panels for a wall
  // that does not exist.
  check(`${brief}: slope facades carry no wall area`,
    extRuns.filter((r) => r.profile === 'slope').every((r) => r.grossAreaSqFt === 0));
  // A manufacturer cuts a rough opening from BOTH edges. A head with no sill
  // does not locate the hole, so the panel cannot be cut from this document.
  check(`${brief}: every opening carries a sill as well as a head`,
    extRuns.every((r) => r.openings.every((o) => typeof o.sillFt === 'number' && o.headFt > o.sillFt)),
    extRuns.flatMap((r) => r.openings.filter((o) => !(o.headFt > o.sillFt)).map((o) => o.id)).join(','));
  // On a real wall the holes cannot exceed the wall. A slope facade is exempt
  // because it HAS no wall: its openings are cut into the roof plane, so they
  // are reported but must never be netted against wall area.
  check(`${brief}: openings never exceed the wall they are cut from`,
    extRuns.filter((r) => r.profile !== 'slope')
      .every((r) => r.openingAreaSqFt <= r.grossAreaSqFt + 0.02
        && (r.openings.length > 0) === (r.openingAreaSqFt > 0)));
  check(`${brief}: a slope facade's openings are roof cuts, not wall deductions`,
    extRuns.filter((r) => r.profile === 'slope')
      .every((r) => r.grossAreaSqFt === 0 && r.openingAreaSqFt >= 0));

  // An a-frame has no plate-height wall at all; saying so is the honest output.
  if (eave < 4) {
    check(`${brief}: a ${eave} ft eave is called out as having no plate wall`,
      g.notes.some((n) => /no plate-height wall/i.test(n)));
  }

  // Openings must all arrive, and land on a wall that exists.
  const artifactOpenings = [...(a.doors ?? []), ...(a.windows ?? [])]
    .filter((o) => o.wallId && String(o.wallId).startsWith('ext-'));
  const adapted = extRuns.flatMap((r) => r.openings);
  check(`${brief}: no exterior opening is lost (${artifactOpenings.length})`,
    adapted.length === artifactOpenings.length, `${adapted.length} vs ${artifactOpenings.length}`);
  check(`${brief}: every opening sits within its run`,
    extRuns.every((r) => r.openings.every((o) => o.offsetFt >= -0.6 && o.offsetFt + o.widthFt <= r.lengthFt + 0.6)),
    extRuns.flatMap((r) => r.openings.filter((o) => o.offsetFt + o.widthFt > r.lengthFt + 0.6).map((o) => o.id)).join(','));
  check(`${brief}: every opening carries a head height`,
    adapted.every((o) => typeof o.headFt === 'number' && o.headFt > 0));
  // A head above the wall would not fit the panel it is cut from — but this
  // applies only where there IS a wall. A 'slope' facade is a stub where the
  // roof meets the ground and its openings are cut into the roof plane, so
  // testing them against a 1 ft stub would fail a perfectly good window.
  const walled = extRuns.filter((r) => r.profile !== 'slope');
  check(`${brief}: no opening head exceeds the wall it is in`,
    walled.every((r) => r.openings.every((o) => o.headFt <= r.heightFt + 0.01)),
    walled.flatMap((r) => r.openings.filter((o) => o.headFt > r.heightFt + 0.01).map((o) => `${o.id}@${o.headFt}`)).join(','));
  const slopes = extRuns.filter((r) => r.profile === 'slope');
  if (slopes.length) {
    check(`${brief}: slope facades are not offered as wall area`,
      g.notes.some((n) => /NOT walls/i.test(n) && /Do not quote them as wall area/i.test(n)));
    if (slopes.some((r) => r.openings.length)) {
      check(`${brief}: their openings are assigned to the roof take-off`,
        g.notes.some((n) => /cut into the ROOF PLANE/i.test(n)));
    }
  }

  // Roof planes carry real area and a pitch measured from their own geometry.
  check(`${brief}: roof planes have positive area`,
    g.roofPlanes.length > 0 && g.roofPlanes.every((p) => p.areaSqFt > 0),
    g.roofPlanes.map((p) => p.areaSqFt).join(','));
  const fp = a.footprint.widthFt * a.footprint.depthFt;
  const roofArea = g.roofPlanes.reduce((n, p) => n + p.areaSqFt, 0);
  // A pitched roof covers MORE than the footprint; a flat one about the same.
  // Either way an order of magnitude out means the area maths is wrong.
  check(`${brief}: total roof area is within reason of the footprint`,
    roofArea >= fp * 0.8 && roofArea <= fp * 2.5, `${roofArea} vs footprint ${fp}`);
  check(`${brief}: pitch is 0 for flat roofs and positive otherwise`,
    a.roof.style === 'flat'
      ? g.roofPlanes.every((p) => p.pitchDeg < 1)
      : g.roofPlanes.some((p) => p.pitchDeg > 1),
    g.roofPlanes.map((p) => p.pitchDeg).join(','));
}

console.log('\nadapter: the spec it feeds is complete and provider-neutral');
{
  const brief = '2 bed gable roof, 80x100 lot, 10 ft setbacks';
  const a = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'tender', brief).artifact;
  const g = adaptArtifactToPanelGeometry(a);
  const spec = buildPanelSpec({
    planId: 'tender', footprint: a.footprint, wallRuns: g.wallRuns, roofPlanes: g.roofPlanes,
    thermalEnvelope, nominalThicknessIn: 4.5,
  });
  check('the spec carries the sourced thermal target', spec.thermal?.wallMinR === 15);
  check('and its climate zone', spec.thermal?.climateZone === '4A');
  check('a fixed thickness plus a floor makes it switchable', spec.switchable === true);
  check('wall runs reached the spec', spec.wallRuns.length === g.wallRuns.length);
  check('roof planes reached the spec', spec.roofPlanes.length === g.roofPlanes.length);
  // The whole point: still no product named anywhere in the deliverable.
  const body = JSON.stringify({ ...spec, excludes: [] }).toLowerCase();
  check('no core, spline or brand leaks into the tender document',
    !['eps', 'polyurethane', 'spline', 'osb', 'insulspan', 'eco-panel'].some((w) => body.includes(w)));
}


console.log('');
if (failures) {
  console.error(`${failures} panel-spec check(s) failed`);
  process.exit(1);
}
console.log('panel-spec battery clean (specification + adapter)');
