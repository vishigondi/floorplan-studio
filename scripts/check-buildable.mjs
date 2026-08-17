// Manufacturability battery (npm run check:buildable).
//
// Drives every generated plan through lib/build-validator.ts — the WikiHouse
// panel-module / wall-height / openings-fit-panels rules — and asserts the
// PANEL-FIT rules pass. The planner's structural module is the 4 ft grid
// (WH-GRID-4FT); build-validator measures buildability against that same module
// (PANEL_WIDTH_FT = 4), so a 4 ft-grid plan validates as panel-buildable.
//
// SCOPE: GENERATED plans only. The traced reference plans (a-frame-22,
// a-frame-bunk, outpost-medium) are image-traced organic geometry that is off
// the 4 ft grid by nature (they also fail WH-GRID-4FT), so they are legitimately
// not panel-modular and are NOT asserted here — "buildable" is a claim about
// what the generator produces, not about the traced references.
//
// UNITS: build-validator reads DenHome.sourceWalls/-Openings in 4 ft GRID units
// (it multiplies by 4; lib/bim/semantic-bim.ts uses the same GRID_FT = 4, and
// lib/data.ts emits them via ftToGrid). The adapter below divides artifact feet
// by 4 for exactly that reason — keep it in step with lib/data.ts.
//
// Gated rules grow as each class is root-fixed: wall-module + wall-height +
// openings (4 ft module, fire 3) + floor-span (bearing-line joist span, fire 4).
// Still tracked in gen-sweep.md and NOT yet asserted (real, separate):
//   * roof-pitch  — some generated pitches aren't on the rafter-SKU list.
//   * loft walls  — a loft's headroom-band wall isn't 4 ft-aligned.
// As each is fixed, add its rule id to PANEL_FIT_RULES below.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));
const { validateBuildability } = await import(join(root, 'lib/build-validator.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
  }
}

// Minimal artifact -> DenHome adapter for the buildability validator. The real
// app uses lib/data.ts (not Node-loadable here); this maps the same fields the
// validator reads. Wall/opening coords are in 4 ft grid units (build-validator
// multiplies by 4 to get feet), so divide artifact feet by 4.
function toHome(a) {
  const wall = (w, exterior) => ({ id: w.id, exterior, x1: w.span.x1 / 4, z1: w.span.z1 / 4, x2: w.span.x2 / 4, z2: w.span.z2 / 4 });
  const sourceWalls = [
    ...(a.exteriorWalls ?? []).filter((w) => w.span).map((w) => wall(w, true)),
    ...(a.interiorWalls ?? []).filter((w) => w.span).map((w) => wall(w, false)),
  ];
  const sourceOpenings = [
    ...(a.windows ?? []).map((w) => ({ ...w, kind: 'window' })),
    ...(a.doors ?? []).map((d) => ({ ...d, kind: 'door' })),
  ].filter((o) => o.span).map((o) => ({ id: o.id, kind: o.kind, x1: o.span.x1 / 4, z1: o.span.z1 / 4, x2: o.span.x2 / 4, z2: o.span.z2 / 4, roomIds: o.roomIds ?? [o.roomId] }));
  return {
    footprint: { width: a.footprint.w, depth: a.footprint.d },
    height: a.roof.ridgeHeightFt,
    roofStyle: a.roof.style,
    roofSemantics: { ridgeHeightFt: a.roof.ridgeHeightFt, eaveHeightFt: a.roof.eaveHeightFt, ridgeAxis: a.roof.ridgeAxis },
    sourceWalls,
    sourceOpenings,
    rooms: (a.rooms ?? []).map((r) => ({ type: r.type, label: r.label, widthFt: r.bounds?.w, depthFt: r.bounds?.d })),
  };
}

const PANEL_FIT_RULES = ['wall-module', 'wall-height', 'openings', 'floor-span'];

// --- Skylark kit envelope (pitches measured 2026-08-16) ----------------------
// We build against the open WikiHouse Skylark 150 kit rather than authoring
// joinery. The kit's roof pitches are now MEASURED from the real 3DM assemblies
// (scripts/measure-skylark-pitch.py, pinned commit): TWO archetypes, a flat roof
// at 0° (R-L/R-S/R-XXS, carrying a 1° fall) and a 42° pitched roof (the -42
// variants). Nothing else, at any angle.
//
// This gate proves the whole truth table, not just honesty: which styles the kit
// can build, which it cannot, and WHY — so neither the constants nor the
// assessment can drift from the measurements without failing here.
const { assessSkylarkKit, SKYLARK_ROOF_PITCHES_DEG, SKYLARK_ROOF_BLOCKS, SKYLARK_MODULE_FT, SKYLARK150_BLOCKS } =
  await import(join(root, 'lib/kit/skylark.ts'));

function roofPitchDeg(artifact) {
  const roof = artifact.roof ?? {};
  if (roof.style === 'flat') return 0;
  const run = Math.max(0.1, (roof.ridgeAxis === 'x' ? artifact.footprint.depthFt : artifact.footprint.widthFt) / 2);
  return Math.atan(((roof.ridgeHeightFt ?? 0) - (roof.eaveHeightFt ?? 0)) / run) * 180 / Math.PI;
}

console.log('skylark: kit envelope + honest not-buildable marking');
// The 4 ft grid must equal the real Skylark sheet width (1220 mm), not 1.2 m.
check('Skylark module matches the 4 ft structural grid', Math.abs(SKYLARK_MODULE_FT - 4) < 0.01, `${SKYLARK_MODULE_FT.toFixed(3)} ft`);
check('Skylark 150 block index is present (58 blocks)',
  Object.values(SKYLARK150_BLOCKS).reduce((n, group) => n + group.length, 0) === 58);

// The constants must not drift from the measurements they came from.
check('Skylark pitch set matches the measured blocks',
  JSON.stringify([...SKYLARK_ROOF_PITCHES_DEG].sort((x, y) => x - y))
  === JSON.stringify([...new Set(SKYLARK_ROOF_BLOCKS.map((b) => b.pitchDeg))].sort((x, y) => x - y)),
  `${SKYLARK_ROOF_PITCHES_DEG.join(',')} vs blocks ${SKYLARK_ROOF_BLOCKS.map((b) => b.pitchDeg).join(',')}`);
check('every measured pitch is evidenced by a majority of the block\'s edge length',
  SKYLARK_ROOF_BLOCKS.every((b) => b.pitchSharePct >= 70),
  SKYLARK_ROOF_BLOCKS.map((b) => `${b.block} ${b.pitchSharePct}%`).join(', '));
check('all six Skylark 150 roof blocks are measured', SKYLARK_ROOF_BLOCKS.length === 6);

// What the kit can and cannot build, per style, with the reason. Expected values
// come from the measurements, so a wrong constant fails rather than passes.
//   flat  0.0° -> matches the flat blocks
//   a-frame 50.5°, gable 23.2° -> archetype exists, pitch does not
//   shed/hip/gambrel/barn -> no blocks at any angle
const KIT_EXPECTATIONS = {
  flat: { status: 'buildable', because: /pitch and wall modules match/i },
  'a-frame': { status: 'not-buildable', because: /not one of the Skylark pitches/i },
  gable: { status: 'not-buildable', because: /not one of the Skylark pitches/i },
  shed: { status: 'not-buildable', because: /no shed roof blocks/i },
  hip: { status: 'not-buildable', because: /no hip roof blocks/i },
  gambrel: { status: 'not-buildable', because: /no gambrel roof blocks/i },
  barn: { status: 'not-buildable', because: /no barn roof blocks/i },
};

for (const style of ['a-frame', 'gable', 'flat', 'shed', 'hip', 'gambrel', 'barn']) {
  const res = compileIntent(mockIntentFromBrief(parseBrief(`2 bed ${style} roof, 80x100 lot, 10 ft setbacks`)), 'skylark-test', style);
  if (!res.ok) { check(`${style}: compiles`, false, res.errors.join('; ')); continue; }
  const a = res.artifact;
  const wallLengthsFt = (a.exteriorWalls ?? []).filter((w) => w.span)
    .map((w) => Math.hypot(w.span.x2 - w.span.x1, w.span.z2 - w.span.z1));
  const kit = assessSkylarkKit({ roofStyle: a.roof.style, roofPitchDeg: roofPitchDeg(a), wallLengthsFt });
  const want = KIT_EXPECTATIONS[style];

  // Every assessment must give the user a reason, not a bare verdict.
  check(`${style}: kit assessment states a reason`, kit.reasons.length > 0);
  check(`${style}: kit verdict is ${want.status}`, kit.status === want.status, `${kit.status} — ${kit.reasons.join(' ')}`);
  check(`${style}: verdict is explained`, kit.reasons.some((r) => want.because.test(r)), kit.reasons.join(' | '));
  // A plan the kit cannot build must never be silently sold as buildable.
  check(`${style}: never claims buildable on an unmeasured pitch set`,
    SKYLARK_ROOF_PITCHES_DEG.length > 0 || kit.status !== 'buildable', kit.status);
}

// The pitch the kit DOES ship must qualify — otherwise the whole set is dead
// letters and 'buildable' is unreachable, which is not honesty, just a bug.
{
  const at42 = assessSkylarkKit({ roofStyle: 'gable', roofPitchDeg: 42, wallLengthsFt: [28, 28] });
  check('a 42° gable on-module IS kit-buildable', at42.status === 'buildable', `${at42.status} — ${at42.reasons.join(' ')}`);
  const offModule = assessSkylarkKit({ roofStyle: 'gable', roofPitchDeg: 42, wallLengthsFt: [27.3] });
  check('a 42° gable off-module is not', offModule.status === 'not-buildable', offModule.status);
}

// Every roof style × a representative bedroom span, single level (loft walls are
// a tracked open class). a-frame caps at 3 beds.
const BRIEFS = [];
for (const style of ['a-frame', 'gable', 'flat', 'shed', 'hip', 'gambrel', 'barn']) {
  for (const beds of [1, 2, 3, 4]) {
    if (style === 'a-frame' && beds === 4) continue;
    BRIEFS.push(`${beds} bed ${style} roof, 80x100 lot, 10 ft setbacks`);
  }
}
// Loft plans add a floor-1 gable wall — its length must also be a panel multiple
// (the loft band is snapped to 4 ft). Cover the loft-capable styles.
for (const style of ['a-frame', 'gable', 'gambrel', 'barn']) {
  BRIEFS.push(`2 bed ${style} roof with loft, 40x60 lot, 5 ft setbacks`);
}

for (const brief of BRIEFS) {
  const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'buildable-test', brief);
  if (!res.ok) { check(`${brief} — compiles`, false, res.errors.join('; ')); continue; }
  const report = validateBuildability(toHome(res.artifact));
  const ruleStatus = Object.fromEntries((report.rules ?? []).map((r) => [r.id, r]));
  for (const ruleId of PANEL_FIT_RULES) {
    const rule = ruleStatus[ruleId];
    check(`${brief} — ${ruleId} buildable`, rule && rule.status !== 'blocked', rule ? (rule.details ?? []).slice(0, 1).join('') : 'rule missing');
  }
  // The validator must produce a real bill of materials (panels counted).
  check(`${brief} — BOM generated`, Array.isArray(report.bom) && report.bom.length > 0);
  // The whole plan must be buildable — no rule blocks. Roof pitch may be a
  // warning (CNC-cut to the design), which does not block.
  check(`${brief} — plan not blocked (buildable)`, report.status !== 'blocked', (report.blockers ?? []).slice(0, 1).join(''));
  check(`${brief} — roof pitch never blocks (stock or CNC-cut)`, ruleStatus['roof-pitch'] && ruleStatus['roof-pitch'].status !== 'blocked', ruleStatus['roof-pitch'] ? ruleStatus['roof-pitch'].status : 'rule missing');
}

if (failures) {
  console.error(`\n${failures} buildable check(s) failed`);
  process.exit(1);
}
console.log('\nbuildable battery clean (panel-fit rules)');
