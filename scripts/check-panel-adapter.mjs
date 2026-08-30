// Battery for the plan -> panel-specification adapter.
//
// This is the join between a code-checked plan and a document a manufacturer
// quotes, so the failures that matter are the ones that would produce a
// confident, wrong tender:
//
//   1. A wall quoted to RIDGE height instead of eave. A SIP wall panel stops at
//      the top plate; quoting to the ridge on a pitched roof buys panels nobody
//      installs, and it is a silent 75% over-quote on this footprint.
//   2. An opening attributed to the wrong wall, or lost. A manufacturer cuts
//      rough openings from this document; a window on the wrong facade is a
//      hole in the wrong wall.
//   3. Gable infill folded quietly into a wall run. It is real work that these
//      runs do NOT cover, and the bill of materials already declares it — so the
//      adapter must keep declaring it rather than let it vanish.
//
// Usage: node scripts/check-panel-adapter.mjs (npm run check:panel-adapter)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));
const { adaptArtifactToPanelGeometry } = await import(join(root, 'lib/kit/panel-spec-adapter.ts'));
const { buildPanelSpec } = await import(join(root, 'lib/kit/panel-spec.ts'));
const { JURISDICTION_PACKS } = await import(join(root, 'lib/standards/code-advisory.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

const thermal = JURISDICTION_PACKS.find((p) => p.id === 'nc-cherokee-county')?.thermalEnvelope;

const BRIEFS = [
  '1 bed a-frame roof, 80x100 lot, 10 ft setbacks',
  '2 bed gable roof, 80x100 lot, 10 ft setbacks',
  '3 bed barn roof, 100x120 lot, 10 ft setbacks',
  '2 bed flat roof, 80x100 lot, 10 ft setbacks',
];

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
  }
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
    thermalEnvelope: thermal, nominalThicknessIn: 4.5,
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
  console.error(`${failures} panel-adapter check(s) failed`);
  process.exit(1);
}
console.log('panel-adapter battery clean');
