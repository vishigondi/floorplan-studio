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
const { pairedArtifactToLocalHome } = await import(join(root, 'lib/data.ts'));
const { validateBuildability, buildKitBomExport } = await import(join(root, 'lib/build-validator.ts'));

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
// The build report comes from the SHIPPED adapter, not a copy of it.
//
// The hand-rolled version this replaces diverged in two ways that each hid a
// real defect: it passed WHOLE walls (so wall-module was never asked to grade a
// solid stretch between openings, and graded the wrong unit unnoticed), and it
// dropped `wallId` from openings (so run reconstruction never happened and the
// BOM's opening-panel logic was inert). Same defect check:generation had.
const toHome = (artifact) => pairedArtifactToLocalHome(artifact);

const PANEL_FIT_RULES = ['wall-module', 'wall-height', 'openings', 'floor-span'];

// --- SIP panel envelope ----------------------------------------------------
// The kit is structural insulated panels. Unlike the WikiHouse Skylark block set
// this replaces, a SIP imposes NO pitch restriction — so there is no pitch gate
// here. The old one refused six of the seven roof styles this generator
// produces, which is why it went out with the kit it described.
//
// What stays geometric is the module and the span, both sized to the SMALLEST
// supplier who has to meet them: a limit only one bidder can satisfy is the
// lock-in the tender exists to avoid.
const { roofPitchDeg: pitchOf, roofRunFt } = await import(join(root, 'lib/roof-geometry.ts'));
// Artifact-shaped wrapper: the shared helper takes (roof, footprint) separately.
const roofPitchDeg = (a) => pitchOf(a.roof, { widthFt: a.footprint.widthFt, depthFt: a.footprint.depthFt });
const { PANEL_MODULE_FT, MAX_PANEL_SPAN_FT, MAX_PANEL_SPAN_SINGLE_SOURCE_FT,
  CORE_MAX_PANEL_FT, WALL_PANEL_HEIGHTS_FT } = await import(join(root, 'lib/kit/sip.ts'));

console.log('sip: the panel envelope is set by the smallest supplier');
check('module is the 4 ft grid', PANEL_MODULE_FT === 4, String(PANEL_MODULE_FT));
check('span limit is the shortest max panel length',
  MAX_PANEL_SPAN_FT === Math.min(...Object.values(CORE_MAX_PANEL_FT).map((p) => p.lengthFt)),
  String(MAX_PANEL_SPAN_FT));
check('the single-source span is recorded and is larger',
  MAX_PANEL_SPAN_SINGLE_SOURCE_FT > MAX_PANEL_SPAN_FT,
  `${MAX_PANEL_SPAN_FT} vs ${MAX_PANEL_SPAN_SINGLE_SOURCE_FT}`);
check('the module excludes no core',
  Object.values(CORE_MAX_PANEL_FT).every((p) => p.widthFt >= PANEL_MODULE_FT),
  Object.values(CORE_MAX_PANEL_FT).map((p) => p.widthFt).join(','));
check('wall heights are stocked SIP panel lengths', WALL_PANEL_HEIGHTS_FT.includes(8));

console.log('bom: wall panels cover every foot of wall run');
{
  const { pairedArtifactToLocalHome } = await import(join(root, 'lib/data.ts'));
  for (const brief of [
    '2 bed gable, 60x90 lot, 10 ft setbacks',
    '4 bed barn roof, 200x200 lot, 5 ft setbacks',
    '1-bed gable cabin, 30x50 lot, 5 ft setbacks',
  ]) {
    const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'bom-test', brief);
    if (!res.ok) { check(`${brief}: compiles for the BOM check`, false, res.errors.join('; ')); continue; }
    const artifact = res.artifact;
    const home = pairedArtifactToLocalHome(artifact);
    const bom = home.buildValidation?.bom ?? [];
    const qty = (id) => bom.find((item) => item.componentId === id)?.quantity ?? 0;
    const runFt = (list) => (artifact[list] ?? [])
      .filter((wall) => wall.span)
      .reduce((sum, wall) => sum + Math.hypot(wall.span.x2 - wall.span.x1, wall.span.z2 - wall.span.z1), 0);

    for (const [label, listKey, solidId, openingId] of [
      ['exterior', 'exteriorWalls', 'wall-ext', 'wall-ext-opening'],
      ['interior', 'interiorWalls', 'wall-int', 'wall-int-opening'],
    ]) {
      const need = Math.ceil(runFt(listKey) / 4);
      const billed = qty(solidId) + qty(openingId);
      check(`${artifact.footprint.widthFt}x${artifact.footprint.depthFt} ${label} panels cover the run (${need})`,
        billed === need, `billed ${billed} (${qty(solidId)} solid + ${qty(openingId)} opening) for ${runFt(listKey)} ft`);
    }
    // Every opening must be hosted by an opening panel, or the bill ships a
    // solid panel where a door goes.
    const openings = [...(artifact.doors ?? []), ...(artifact.windows ?? []), ...(artifact.openings ?? [])].filter((o) => o.span).length;
    check(`${artifact.footprint.widthFt}x${artifact.footprint.depthFt} every opening has an opening panel (${openings})`,
      qty('wall-ext-opening') + qty('wall-int-opening') === openings,
      `${qty('wall-ext-opening') + qty('wall-int-opening')} opening panels for ${openings} openings`);
  }
}

console.log('roof geometry: pitch is measured over the run the roof actually rises across');
for (const [style, expectDeg] of [['flat', 0], ['shed', 8.1], ['gable', 23.2], ['a-frame', 50.5], ['hip', 23.2], ['gambrel', 29.7], ['barn', 29.7]]) {
  const res = compileIntent(mockIntentFromBrief(parseBrief(`2 bed ${style} roof, 80x100 lot, 10 ft setbacks`)), 'pitch-test', style);
  if (!res.ok) { check(`${style}: compiles for the pitch check`, false, res.errors.join('; ')); continue; }
  const a = res.artifact;
  const got = roofPitchDeg(a);
  check(`${style}: pitch is ${expectDeg}°`, Math.abs(got - expectDeg) < 0.15, `${got.toFixed(2)}°`);
  const across = a.roof.ridgeAxis === 'x' ? a.footprint.depthFt : a.footprint.widthFt;
  check(`${style}: rise is measured over the ${style === 'shed' ? 'whole' : 'half'} span`,
    Math.abs(roofRunFt(a.roof, { widthFt: a.footprint.widthFt, depthFt: a.footprint.depthFt })
      - (style === 'shed' ? across : across / 2)) < 1e-9);
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
// A lot too tight for ANY deck. Every other brief here clears the coverage cap
// with room for one, which left the deck BOM check's zero branch unexercised --
// a phantom deck line on a deckless plan would have gone unbilled and unseen.
// On a 40x58 lot the 28x28 footprint leaves 28 sq ft under the 35% cap, less
// than the smallest 8x4 deck, so this plan must ship with no deck and no deck
// panels.
BRIEFS.push('1 bed gable roof, 40x58 lot, 5 ft setbacks');

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

  // A LOW GUARD RAIL IS NOT A WALL PANEL. Loft guards are walls in the semantic
  // graph (that is how IRC R312.1 finds them) and were billed as full-height
  // interior panels — loft-showcase's two 28 ft guards were 14 of its 32
  // `wall-int`, i.e. 14 sheets of interior wall ordered for a hip-height rail.
  // Both directions are asserted: a loft plan must bill them separately, and a
  // single-storey plan must not invent the line.
  // BOM lines are graded on the SHIPPED adapter. The hand-rolled `toHome` above
  // cannot classify openings — the raw artifact has `roomIds: undefined` and it
  // passes `[undefined]` through, so every exterior door reads as interior and
  // door-ext came out 0 against a plan with one. pairedArtifactToLocalHome
  // derives the real roomIds (["exterior","room-living"]). The rule assertions
  // stay on `report`; only the bill is graded here.
  const shippedReport = validateBuildability(pairedArtifactToLocalHome(res.artifact));
  const bomQty = (id) => (shippedReport.bom ?? []).find((item) => item.componentId === id)?.quantity ?? 0;
  const hasLoft = (res.artifact.rooms ?? []).some((room) => (room.levelIndex ?? 0) >= 1);
  const guardFt = [...(res.artifact.interiorWalls ?? []), ...(res.artifact.exteriorWalls ?? [])]
    .filter((wall) => /guard|rail/i.test(`${wall.wallKind ?? ''} ${wall.id ?? ''}`))
    .reduce((sum, wall) => sum + Math.hypot(
      (wall.span?.x2 ?? 0) - (wall.span?.x1 ?? 0),
      (wall.span?.z2 ?? 0) - (wall.span?.z1 ?? 0),
    ), 0);
  if (hasLoft && guardFt > 0) {
    check(`${brief} — loft guard rails are billed on their own line`,
      bomQty('guard-rail') === Math.ceil(guardFt / 4), `${bomQty('guard-rail')} vs ${Math.ceil(guardFt / 4)} expected from ${guardFt.toFixed(1)} ft`);
    // The whole point: that quantity must have LEFT the interior wall count.
    // Asserted by re-running the validator on a copy whose guards are disguised
    // as ordinary interior walls — the interior panel count must then RISE.
    // (`wall-int < wall-int + guard-rail` would be true by arithmetic alone.)
    const disguised = JSON.parse(JSON.stringify(res.artifact));
    for (const wall of disguised.interiorWalls ?? []) {
      if (/guard|rail/i.test(`${wall.wallKind ?? ''} ${wall.id ?? ''}`)) {
        wall.wallKind = 'solidInterior';
        wall.id = String(wall.id ?? '').replace(/guard|rail/gi, 'plain');
      }
    }
    const disguisedReport = validateBuildability(pairedArtifactToLocalHome(disguised));
    const disguisedInt = (disguisedReport.bom ?? []).find((item) => item.componentId === 'wall-int')?.quantity ?? 0;
    check(`${brief} — guard length is not also counted as interior wall panels`,
      disguisedInt > bomQty('wall-int'),
      `disguised-as-wall gives ${disguisedInt}, real ${bomQty('wall-int')} — guards were never excluded`);
  } else {
    check(`${brief} — no guard-rail line without a guarded loft`, bomQty('guard-rail') === 0, `${bomQty('guard-rail')}`);
  }

  // A LOFT IS A FLOOR DECK. This billed the footprint once, so a single-storey
  // 28x28 and the same plan with an 8x28 loft both listed 49 cassettes — two
  // different buildings, one number, and no loft deck on the bill.
  const groundOnly = Math.ceil(res.artifact.footprint.widthFt / 4) * Math.ceil(res.artifact.footprint.depthFt / 4);
  const levels = new Map();
  for (const panel of res.artifact.floorPanels ?? []) {
    const fw = panel.footprint?.widthFt ?? panel.footprint?.width ?? 0;
    const fd = panel.footprint?.depthFt ?? panel.footprint?.depth ?? 0;
    if (fw > 0 && fd > 0) levels.set(panel.floor ?? panel.levelIndex ?? 0, Math.ceil(fw / 4) * Math.ceil(fd / 4));
  }
  const expectedCassettes = levels.size ? [...levels.values()].reduce((a, b) => a + b, 0) : groundOnly;
  check(`${brief} — floor cassettes cover every level`, bomQty('floor-std') === expectedCassettes,
    `${bomQty('floor-std')} vs ${expectedCassettes} across ${levels.size || 1} level(s)`);
  if (hasLoft) {
    check(`${brief} — a loft adds floor deck beyond the ground floor`,
      bomQty('floor-std') > groundOnly, `${bomQty('floor-std')} vs ground-only ${groundOnly}`);
  }

  // Openings were never gated at all: door-ext/door-int/window-std appeared in
  // no battery, so a miscount would ship in silence exactly the way the guard
  // rails did.
  const extDoors = (res.artifact.doors ?? []).filter((o) => o.openingType === 'exteriorDoor').length;
  const intDoors = (res.artifact.doors ?? []).filter((o) => o.openingType !== 'exteriorDoor').length;
  check(`${brief} — exterior door units match the plan`, bomQty('door-ext') === extDoors, `${bomQty('door-ext')} vs ${extDoors}`);
  check(`${brief} — interior door units match the plan`, bomQty('door-int') === intDoors, `${bomQty('door-int')} vs ${intDoors}`);
  check(`${brief} — window units match the plan`, bomQty('window-std') === (res.artifact.windows ?? []).length,
    `${bomQty('window-std')} vs ${(res.artifact.windows ?? []).length}`);

  // ROOF MODULES REPEAT ALONG THE RIDGE. The span picks which block class the
  // kit ships (R-L / R-S / R-XXS, plus -42), it does not set the count. This
  // used ceil(width/4) regardless of ridge axis — the dimension the roof SPANS
  // whenever the ridge runs along z — so it was right only for a square plan by
  // coincidence, and a 48x28 gable billed 24 modules for a 28 ft ridge that
  // takes 14. The error grew with how un-square the house was.
  const roofLine = (shippedReport.bom ?? []).find((item) => item.category === 'roof');
  const ridgeParallel = res.artifact.roof?.ridgeAxis === 'x'
    ? res.artifact.footprint.widthFt
    : res.artifact.footprint.depthFt;
  const expectedRoof = res.artifact.roof?.style === 'flat'
    ? Math.ceil(res.artifact.footprint.widthFt / 4) * Math.ceil(res.artifact.footprint.depthFt / 4)
    : Math.ceil(ridgeParallel / 4) * 2;
  check(`${brief} — roof modules count along the ridge`, roofLine?.quantity === expectedRoof,
    `${roofLine?.componentId}=${roofLine?.quantity} vs ${expectedRoof} (ridge-parallel ${ridgeParallel}ft, ${res.artifact.roof?.style})`);

  // Foundation is the sill perimeter over the module.
  const perimeterFt = (res.artifact.footprint.widthFt + res.artifact.footprint.depthFt) * 2;
  check(`${brief} — foundation sill covers the perimeter`, bomQty('foundation') === Math.ceil(perimeterFt / 4),
    `${bomQty('foundation')} vs ${Math.ceil(perimeterFt / 4)} for ${perimeterFt}ft`);
  // Deck panels must be JUSTIFIED BY A DECK ROOM and match its area. This used
  // to assert simply that the count was 0, on the stated premise that no brief
  // produced a deck -- true when it was written, false since the entry deck
  // landed. Asserting the count the room actually implies is the check the name
  // always promised, and it is strictly stronger: it still catches a phantom
  // deck line, and now also catches a deck that is billed short or double.
  const deckRoom = (res.artifact.rooms ?? []).find((room) => String(room.type ?? '') === 'deck');
  const deckBounds = deckRoom?.bounds;
  const expectedDeck = deckBounds ? Math.ceil(deckBounds.w / 4) * Math.ceil(deckBounds.d / 4) : 0;
  check(`${brief} — deck panels match the deck room`, bomQty('floor-deck') === expectedDeck,
    `${bomQty('floor-deck')} vs ${expectedDeck}${deckBounds ? ` for ${deckBounds.w}x${deckBounds.d}ft deck` : ' (no deck room)'}`);

  // THE BILL MUST NAME WHAT IT LEAVES OUT. Gable-end infill is enclosed in the
  // model (buildable-bim extrudes gable-end walls to the ridge) but panels are
  // counted from plan-view runs at a storey SKU, so the apex triangle is in no
  // line. No supplier stocks an apex panel, so it is stated, not invented.
  const omissions = shippedReport.omissions ?? [];
  check(`${brief} — the bill states what it omits`, omissions.length > 0, 'no omissions declared');
  const claimsGable = omissions.some((line) => /gable/i.test(line));
  const isPitched = res.artifact.roof?.style !== 'flat';
  check(`${brief} — gable infill is declared only for pitched roofs`, claimsGable === isPitched,
    `${res.artifact.roof?.style}: claimsGable=${claimsGable}`);
}

// Deck panels are only exercised by a traced plan — a-frame-22 is the sole plan
// in the store with Deck rooms — so grade it there or the line is never checked
// at all. The fixture's own precondition is asserted: if a-frame-22 ever stops
// having decks, this must fail loudly rather than pass over nothing.
{
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = join(root, 'public/data/den-image-loop/a-frame-22/paired');
  const file = readdirSync(dir).find((name) => name.endsWith('.paired.json'));
  const artifact = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const home = pairedArtifactToLocalHome(artifact);
  const decks = (home.rooms ?? []).filter((room) => /deck|porch|patio/i.test(`${room.type} ${room.label}`));
  check('a-frame-22 still has deck rooms (fixture precondition)', decks.length > 0, `${decks.length}`);
  const expected = decks.reduce((sum, room) =>
    sum + Math.ceil((room.gw * 4) / 4) * Math.ceil((room.gd * 4) / 4), 0);
  const qty = (validateBuildability(home).bom ?? [])
    .find((item) => item.componentId === 'floor-deck')?.quantity ?? 0;
  check('deck panels tile every deck room', qty === expected, `${qty} vs ${expected} across ${decks.length} deck(s)`);
}

// A square plan hides the axis bug entirely — width and depth agree, so the old
// formula and the correct one give the same number. Grade a deliberately
// UN-square pitched plan, or this assertion proves nothing.
{
  const brief = '4 bed gable, 100x120 lot, 10 ft setbacks';
  const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'roof-axis', brief);
  const w = res.artifact.footprint.widthFt, d = res.artifact.footprint.depthFt;
  check('the roof-axis fixture is genuinely un-square', Math.abs(w - d) >= 8, `${w}x${d}`);
  const roofLine = (validateBuildability(pairedArtifactToLocalHome(res.artifact)).bom ?? [])
    .find((item) => item.category === 'roof');
  check('an un-square gable bills along its ridge, not across its span',
    roofLine?.quantity === Math.ceil(d / 4) * 2,
    `${roofLine?.quantity} vs ${Math.ceil(d / 4) * 2} (would be ${Math.ceil(w / 4) * 2} across the span)`);
}

// WALL-MODULE GRADES RUNS, NOT THE SOLID STRETCHES BETWEEN OPENINGS.
//
// Graded through the SHIPPED adapter on purpose: `toHome` above is hand-rolled
// and drops `wallId` from openings, so run reconstruction never happens there —
// runs collapse to whole walls and this rule passes for the wrong reason. The
// same blindness hides the BOM's opening-panel logic.
//
// pairedArtifactToLocalHome splits exterior walls into solid segments
// (ext-n:seg-1/2/3). Grading those directly asked a 2.50 ft stretch between two
// windows to be a 4 ft multiple; it is not a panel, it is part of one. The run
// it belongs to — 4.00 + 2.50 + 14.50 plus 7 ft of openings = 28 ft — is exactly
// 7 panels.
{
  for (const brief of ['2 bed gable, 60x90 lot, 10 ft setbacks', '2 bed a-frame roof, 80x100 lot, 10 ft setbacks']) {
    const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'run-module', brief);
    if (!res.ok) { check(`${brief} — compiles for the run-module check`, false, res.errors.join('; ')); continue; }
    const home = pairedArtifactToLocalHome(res.artifact);
    // The fixture must actually be segmented, or this proves nothing.
    const segmented = (home.sourceWalls ?? []).filter((w) => /:seg-\d+$/.test(String(w.id)));
    check(`${brief} — the shipped adapter really segments walls (fixture precondition)`,
      segmented.length > 0, `${(home.sourceWalls ?? []).length} walls, none segmented`);
    const offModuleSegments = segmented.filter((w) => {
      const len = Math.hypot((w.x2 - w.x1) * 4, (w.z2 - w.z1) * 4);
      return len > 0.05 && Math.abs(len / 4 - Math.round(len / 4)) > 0.02;
    });
    check(`${brief} — the fixture has an off-module segment (else the rule is untested)`,
      offModuleSegments.length > 0, 'every segment happens to be a panel multiple');
    const moduleRule = (validateBuildability(home).rules ?? []).find((r) => r.id === 'wall-module');
    check(`${brief} — wall-module passes on runs despite off-module segments`,
      moduleRule && moduleRule.status !== 'blocked',
      `${moduleRule?.status}: ${(moduleRule?.details ?? []).slice(0, 1).join('')}`);
  }
}

// THE BOM EXPORT A USER DOWNLOADS.
//
// This payload was inlined in the download handler, so no battery could reach it
// — a click, not a function. The assumptions and omissions added to the bill were
// therefore shipped unverified. It is a value now, and asserted here: driving the
// real download is not an option because Chrome allows one programmatic download
// per session and the client packet already spends it.
{
  const brief = '2 bed a-frame with loft, 40x60 lot, 5 ft setbacks';
  const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'bom-export', brief);
  const home = pairedArtifactToLocalHome(res.artifact);
  const payload = buildKitBomExport(home);
  check('BOM export names the plan', typeof payload.planId === 'string' && payload.planId.length > 0, payload.planId);
  check('BOM export carries the bill', Array.isArray(payload.bom) && payload.bom.length > 0, `${payload.bom?.length} lines`);
  check('BOM export lists the components used', Array.isArray(payload.componentsUsed) && payload.componentsUsed.length > 0);
  // The two honesty fields: a downloaded bill that states neither its
  // assumptions nor its omissions cannot be checked by whoever orders from it.
  check('BOM export states its assumptions', (payload.assumptions ?? []).length > 0, JSON.stringify(payload.assumptions));
  check('BOM export states its omissions', (payload.omissions ?? []).length > 0, JSON.stringify(payload.omissions));
  check('BOM export assumptions match the report', JSON.stringify(payload.assumptions) === JSON.stringify(home.buildValidation?.assumptions ?? []));
  check('BOM export bom matches the report', payload.bom.length === (home.buildValidation?.bom ?? []).length);
  // A lofted plan must carry its guard-rail line into the download too.
  check('BOM export includes the loft guard rail line',
    payload.bom.some((item) => item.componentId === 'guard-rail'),
    payload.bom.map((i) => i.componentId).join(', '));
}

// Traced plans describe the same storeys TWICE (a-frame-22 carries floor-0/
// floor-1 and level-main/level-loft). Summing array entries billed four decks
// for a two-storey house, so the per-level dedup is asserted against the stored
// artifact, not just the compiled ones.
{
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = join(root, 'public/data/den-image-loop/a-frame-22/paired');
  const file = readdirSync(dir).find((name) => name.endsWith('.paired.json'));
  const artifact = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const entries = (artifact.floorPanels ?? []).length;
  const distinct = new Set((artifact.floorPanels ?? []).map((p) => p.floor ?? p.levelIndex ?? 0)).size;
  const qty = (validateBuildability(pairedArtifactToLocalHome(artifact)).bom ?? [])
    .find((item) => item.componentId === 'floor-std')?.quantity ?? 0;
  check('a-frame-22 duplicates its floor levels (fixture still exercises the dedup)', entries > distinct, `${entries} entries, ${distinct} levels`);
  check('a-frame-22 bills one deck per LEVEL, not per floorPanels entry', qty === 90, `${qty}`);
}

// THE JOIST LIMIT MUST STAY TIED TO A REAL PANEL, not a round number.
//
// It was a bare `16`, then Skylark's F-L block at 18.83 ft, and is now the
// shortest max panel length across suppliers — 16 ft again, but for a reason
// that survives the kit change: a panel cannot span further than it is long,
// and eco-panels top out at 16 ft.
//
// Note the direction. Dropping WikiHouse TIGHTENED this by 2.83 ft rather than
// relaxing it, because the Skylark block reached further than the smallest SIP.
{
  const shortest = Math.min(...Object.values(CORE_MAX_PANEL_FT).map((p) => p.lengthFt));
  check('joist limit equals the shortest max panel length', MAX_PANEL_SPAN_FT === shortest,
    `${MAX_PANEL_SPAN_FT} vs ${shortest}`);
  check('no supplier is asked to span further than they manufacture',
    Object.values(CORE_MAX_PANEL_FT).every((p) => p.lengthFt >= MAX_PANEL_SPAN_FT));
}

if (failures) {
  console.error(`\n${failures} buildable check(s) failed`);
  process.exit(1);
}
console.log('\nbuildable battery clean (panel-fit rules)');
