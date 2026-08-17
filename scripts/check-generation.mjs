// Generation battery: varied briefs through the full deterministic pipeline.
//
// For each brief: parseBrief -> mockIntentFromBrief -> compileIntent ->
// codeAdvisoryReport (jurisdiction nc-cherokee-county) with ceiling profiles
// derived from the compiled roof planes — the same derivation the app adapter
// uses — so R305 (the historical A-frame bath flaw) is asserted here, offline.
//
// Viable briefs must compile and produce ZERO constraint-fail findings.
// A brief whose footprint cannot fit its lot envelope must fail compile
// validation with a clear error instead of producing a broken plan.
//
// Usage: node scripts/check-generation.mjs (wired as npm run check:generation)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));
const { codeAdvisoryReport, CODE_ADVISORY_RULES } = await import(join(root, 'lib/standards/code-advisory.ts'));
const { pairedArtifactToLocalHome } = await import(join(root, 'lib/data.ts'));
const { codeAdvisoryInputFromHome } = await import(join(root, 'lib/standards/floorplan-standards.ts'));
const { ceilingHeightAt, ceilingPlanesFromRoofPoints } = await import(join(root, 'lib/bim/envelope-clip.ts'));
const ceilingPlanes = (artifact) => ceilingPlanesFromRoofPoints(artifact.roof?.planes ?? []);
const { headroomOverFt, requiredHeadroomFt } = await import(join(root, 'lib/generate/place-fixtures.ts'));
const { PLACEMENT_CLEARANCE_FT: CLEARANCE_FT } = await import(join(root, 'lib/generate/placement.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
  }
}

// The advisory report comes from the SHIPPED adapter, not a copy of it.
//
// This battery used to build its own CodeAdvisoryInput and carry its own
// plane-equation and ceiling-profile math "mirroring" lib/standards — roughly
// 100 lines duplicating the exact shared geometry the working agreement names as
// the thing that must have one source of truth. Two costs showed up together:
// ZON-HEIGHT was inert here until the field was mirrored by hand, and three
// breakage tests only ever worked against the copy (they mutated `bounds`, while
// the real path derives room size from `polygon`) — so the anti-vacuity suite was
// proving rules can fail in a MODEL of the pipeline, not in the product.
function reportForArtifact(artifact) {
  return codeAdvisoryReport(codeAdvisoryInputFromHome(pairedArtifactToLocalHome(artifact)));
}

function statusOf(report, ruleId, subjectId) {
  const match = report.findings.find(
    (item) => item.ruleId === ruleId && (subjectId === undefined || item.subjectId === subjectId),
  );
  return match?.status ?? 'missing';
}

// --- Battery -----------------------------------------------------------------
const CASES = [
  { name: 'canonical 2-bed a-frame', brief: '2-bed A-frame, ≤800 sqft, 40×60 lot, 5 ft side setbacks', bedrooms: 2, style: 'a-frame', hasLot: true, expectWidth: 28 },
  { name: '1-bed gable', brief: '1-bed gable cabin, 40×60 lot, 5 ft setbacks', bedrooms: 1, style: 'gable', hasLot: true, expectWidth: 28 },
  { name: '3-bed a-frame', brief: '3-bed a-frame ≤1200 sqft, 80×60 lot, 10 ft setbacks', bedrooms: 3, style: 'a-frame', hasLot: true, expectWidth: 36 },
  { name: '1-bed a-frame, no lot', brief: '1-bed a-frame', bedrooms: 1, style: 'a-frame', hasLot: false, expectWidth: 28 },
  { name: '2-bed gable', brief: '2-bed gable, lot 40x60, 5 ft side setbacks', bedrooms: 2, style: 'gable', hasLot: true, expectWidth: 28 },
  { name: '3-bed gable, per-side setbacks', brief: '3-bed gable ≤1200 sqft, 50 x 100 lot, 20 ft front setback, 5 ft side setbacks, 10 ft rear setback', bedrooms: 3, style: 'gable', hasLot: true, expectWidth: 36 },
  { name: 'barely fits envelope', brief: '2-bed a-frame, 40×58 lot, 5 ft setbacks', bedrooms: 2, style: 'a-frame', hasLot: true, expectWidth: 28 },
  { name: 'cannot fit envelope', brief: '3-bed a-frame ≤1200 sqft, 30×40 lot, 5 ft setbacks', expectCompileError: /exceeds the buildable envelope/ },
  { name: 'default brief (no program)', brief: 'cozy cabin near the creek', bedrooms: 2, style: 'a-frame', hasLot: false, expectWidth: 28 },
  // Kit-buildable gable: the ridge is DERIVED from Skylark's measured 42° pitch
  // (20.61 ft on a 28 ft span), so it runs the whole per-plan invariant set at a
  // roof angle no other case covers — headroom bands, egress, fixtures and the
  // drawing set all shift with pitch.
  { name: 'kit-buildable 42° gable', brief: '2 bed skylark gable, 60x90 lot, 10 ft setbacks', bedrooms: 2, style: 'gable', hasLot: true, expectWidth: 28 },
  // Footprint-fit capability: gables shrink to the lot envelope / maxSqft.
  { name: 'small-lot 1-bed gable shrinks to 20x24', brief: '1-bed gable cabin, 30x50 lot, 5 ft setbacks', bedrooms: 1, style: 'gable', hasLot: true, expectWidth: 20, expectDepth: 24 },
  { name: 'maxSqft shrinks 2-bed gable to 24 ft', brief: '2-bed gable, ≤700 sqft', bedrooms: 2, style: 'gable', hasLot: false, expectWidth: 24 },
  { name: 'small-lot 3-bed gable shrinks to 28 ft', brief: '3-bed gable, 40x70 lot, 5 ft setbacks', bedrooms: 3, style: 'gable', hasLot: true, expectWidth: 28 },
  { name: 'a-frame cannot shrink below headroom', brief: '2-bed a-frame, 30x50 lot, 5 ft setbacks', expectCompileError: /exceeds the buildable envelope/ },
  // Bath count capability: 2-bath on primary footprints, honest downgrade
  // when only a narrow single-bath variant fits the size limit.
  { name: '2-bed 2-bath a-frame ensuite', brief: '2 bed 2 bath a-frame, 40x60 lot, 5 ft side setbacks', bedrooms: 2, style: 'a-frame', hasLot: true, expectWidth: 28, expectBaths: 2 },
  { name: '3-bed 2-bath a-frame', brief: '3 bed 2 bath a-frame ≤1200 sqft, 80x60 lot, 10 ft setbacks', bedrooms: 3, style: 'a-frame', hasLot: true, expectWidth: 36, expectBaths: 2 },
  { name: '2-bath downgrades when only narrow fits', brief: '2 bed 2 bath gable, ≤700 sqft', bedrooms: 2, style: 'gable', hasLot: false, expectWidth: 24, expectBaths: 1, expectBathNote: true },

  // Program honesty: a bedroom count beyond the template ceiling (3) must be
  // refused with a clear message, NOT silently collapsed to a 3-bedroom plan.
  // 4-bed is BUILT now (fire 19) for eave-≥7 styles; 5+ still exceeds the
  // template ceiling, and 4-bed a-frame is refused (its 1 ft eave can't give the
  // width-edge bedrooms R305 headroom).
  { name: '4-bed gable', brief: '4 bed gable, 80x100 lot, 10 ft setbacks', bedrooms: 4, style: 'gable', hasLot: true, expectWidth: 48 },
  { name: '4-bed a-frame refused (eave too low for 4 across)', brief: '4 bed a-frame, 80x100 lot, 10 ft setbacks', expectCompileError: /a-frame.*4|4 .*a-frame|headroom|builds at most/i },
  // A storey count the generator cannot build is a DIFFERENT BUILDING, not a
  // degraded one — refuse, as an over-cap bedroom count is refused. "2 story"
  // used to parse, be consumed (so it never reached the `unparsed` echo either),
  // and then quietly ship a bungalow.
  { name: '2 storeys refused (no multi-storey template)', brief: '2 story gable, 60x90 lot, 10 ft setbacks', expectCompileError: /requested 2 storeys.*single storey plus an optional loft/i },
  { name: '3 storeys refused', brief: 'three story gable, 80x100 lot, 10 ft setbacks', expectCompileError: /requested 3 storeys/i },
  // ...but a single-storey request, and a storey count a loft satisfies, must build.
  { name: 'loft requested on a flat roof is dropped, and said', brief: '2 bed flat roof with loft, 60x90 lot, 10 ft setbacks', bedrooms: 2, style: 'flat', hasLot: true, expectWidth: 28 },
  { name: 'single level builds', brief: 'single level gable, 60x90 lot, 10 ft setbacks', bedrooms: 2, style: 'gable', hasLot: true, expectWidth: 28 },

  // PROGRAM HONESTY, the whole class: ANY bath count the plan cannot deliver must
  // be surfaced. The raw request used to be clamped to MAX_TEMPLATE_BATHS before
  // the compiler saw it, so "3 bath" compared 2 against 2 and said nothing —
  // only the 2-baths-do-not-fit case was ever covered.
  { name: '3 baths exceeds the template maximum', brief: '3 bed 3 bath hip roof, 80x100 lot, 10 ft setbacks', bedrooms: 3, style: 'hip', hasLot: true, expectBaths: 2, expectBathNote: true },
  { name: '4 baths exceeds the template maximum', brief: '2 bed 4 bath gable, 80x100 lot, 10 ft setbacks', bedrooms: 2, style: 'gable', hasLot: true, expectBaths: 2, expectBathNote: true },
  { name: '1-bed programs are single-bath', brief: '1 bed 2 bath gable, 60x90 lot, 10 ft setbacks', bedrooms: 1, style: 'gable', hasLot: true, expectBaths: 1, expectBathNote: true },
  { name: '5-bed exceeds template ceiling', brief: '5 bed 3 bath gable, 2400 sqft, 80x120 lot, 10 ft setbacks', expectCompileError: /builds at most 4|requested 5 bedrooms/i },

  // Coverage honesty: a footprint that fits the setback envelope but exceeds the
  // 35% lot-coverage cap must be refused, not shipped as a plan that fails its
  // own ZON-COVERAGE report. (38x38 lot -> 28x28 fits envelope but 54% coverage.)
  { name: 'fits envelope but over coverage cap (a-frame)', brief: '2 bed a-frame, 38x38 lot, 5 ft setbacks', expectCompileError: /coverage cap|over the 35% coverage/i },
  { name: 'fits envelope but over coverage cap (gable)', brief: '2 bed gable, 40x40 lot, 5 ft setbacks', expectCompileError: /coverage cap|over the 35% coverage/i },

  // Sqft-cap honesty: a ≤sqft cap no template can meet must be refused, not
  // silently exceeded by shipping a larger footprint (smallest 2-bed gable is
  // 672 sqft; ≤500 is unbuildable). ≤700 (which 672 satisfies) still compiles.
  { name: 'maxSqft cap below smallest template (gable)', brief: '2 bed gable, ≤500 sqft', expectCompileError: /exceeds the requested ≤500 sq ft cap/i },
  { name: 'maxSqft cap below smallest template (a-frame)', brief: '2 bed a-frame, ≤600 sqft', expectCompileError: /exceeds the requested ≤600 sq ft cap/i },

  // Roof-style honesty: ALL recognized styles now BUILD (a-frame, gable, flat,
  // shed, hip, gambrel, barn). An UNKNOWN style still surfaces honestly via the
  // parser's unparsed channel (no roofStyle set -> defaults a-frame), so there is
  // no roof-style refusal left to assert here.

  // Barn roof — BUILT (fire 18): a gambrel hipped on all four sides (two stacked
  // hips). style 'barn'; R305 passes (perimeter eave >= 7 ft).
  { name: '2-bed barn roof (square)', brief: '2 bed barn roof, 40x60 lot, 5 ft setbacks', bedrooms: 2, style: 'barn', hasLot: true, expectWidth: 28 },
  { name: '3-bed barn roof (rect)', brief: '3 bed barn roof, 60x80 lot, 10 ft setbacks', bedrooms: 3, style: 'barn', hasLot: true, expectWidth: 36 },
  { name: '1-bed barn roof, no lot', brief: '1 bed barn roof', bedrooms: 1, style: 'barn', hasLot: false, expectWidth: 28 },

  // Gambrel roof — BUILT (fire 17): two-pitch gable (steep lower, shallow upper),
  // four planes meeting at a ridge. style 'gambrel'; R305 passes (eave ≥ 7 ft).
  { name: '2-bed gambrel', brief: '2 bed gambrel, 40x60 lot, 5 ft setbacks', bedrooms: 2, style: 'gambrel', hasLot: true, expectWidth: 28 },
  { name: '3-bed gambrel', brief: '3 bed gambrel, 60x80 lot, 10 ft setbacks', bedrooms: 3, style: 'gambrel', hasLot: true, expectWidth: 36 },
  { name: '1-bed gambrel, no lot', brief: '1 bed gambrel', bedrooms: 1, style: 'gambrel', hasLot: false, expectWidth: 28 },

  // Hip roof — BUILT (fire 16): four planes to a central ridge (a pyramid on a
  // square footprint). style 'hip'; R305 passes (eave runs around the whole
  // perimeter ≥ 7 ft).
  { name: '2-bed hip roof (square -> pyramid)', brief: '2 bed hip roof, 40x60 lot, 5 ft setbacks', bedrooms: 2, style: 'hip', hasLot: true, expectWidth: 28 },
  { name: '3-bed hip roof (rect -> ridge line)', brief: '3 bed hip roof, 60x80 lot, 10 ft setbacks', bedrooms: 3, style: 'hip', hasLot: true, expectWidth: 36 },
  { name: '1-bed hip roof, no lot', brief: '1 bed hip roof', bedrooms: 1, style: 'hip', hasLot: false, expectWidth: 28 },

  // Flat roof — BUILT (fire 14): a flat-roof brief produces a sound plan, not a
  // refusal. style 'flat', single horizontal plane, R305 passes on the flat
  // ceiling (driven through the shared report below like every other case).
  { name: '2-bed flat roof', brief: '2 bed flat roof, 40x60 lot, 5 ft setbacks', bedrooms: 2, style: 'flat', hasLot: true, expectWidth: 28 },
  { name: '3-bed flat roof', brief: '3 bed flat roof, 60x80 lot, 10 ft setbacks', bedrooms: 3, style: 'flat', hasLot: true, expectWidth: 36 },
  { name: '1-bed flat roof, no lot', brief: '1 bed flat roof', bedrooms: 1, style: 'flat', hasLot: false, expectWidth: 28 },

  // Shed roof — BUILT (fire 15): single mono-pitch slope. style 'shed', one
  // sloped plane, R305 passes (the low eave still clears 7 ft).
  { name: '2-bed shed roof', brief: '2 bed shed roof, 40x60 lot, 5 ft setbacks', bedrooms: 2, style: 'shed', hasLot: true, expectWidth: 28 },
  { name: '3-bed shed roof', brief: '3 bed shed roof, 60x80 lot, 10 ft setbacks', bedrooms: 3, style: 'shed', hasLot: true, expectWidth: 36 },
  { name: '1-bed shed roof, no lot', brief: '1 bed shed roof', bedrooms: 1, style: 'shed', hasLot: false, expectWidth: 28 },
];

for (const testCase of CASES) {
  console.log(`case: ${testCase.name} — "${testCase.brief}"`);
  const parsed = parseBrief(testCase.brief);
  const intent = mockIntentFromBrief(parsed);
  const compiled = compileIntent(intent, `battery-${CASES.indexOf(testCase)}`, testCase.brief);

  if (testCase.expectCompileError) {
    check('compile fails (honest validator catch)', !compiled.ok);
    check(
      'failure message matches expected reason',
      compiled.errors.some((error) => testCase.expectCompileError.test(error)),
      compiled.errors.join('; ') || 'no errors reported',
    );
    continue;
  }

  check('compiles cleanly', compiled.ok, compiled.errors.join('; '));
  if (!compiled.ok) continue;
  const artifact = compiled.artifact;

  // Structural assertions.
  const bedroomsInPlan = artifact.rooms.filter((room) => room.type === 'bedroom');
  check(`bedroom count ${testCase.bedrooms}`, bedroomsInPlan.length === testCase.bedrooms, `got ${bedroomsInPlan.length}`);
  check(`roof style ${testCase.style}`, artifact.roof.style === testCase.style, artifact.roof.style);
  if (testCase.expectWidth) {
    check(`footprint width ${testCase.expectWidth} ft`, artifact.footprint.widthFt === testCase.expectWidth, `got ${artifact.footprint.widthFt}`);
  }
  if (testCase.expectDepth) {
    check(`footprint depth ${testCase.expectDepth} ft`, artifact.footprint.depthFt === testCase.expectDepth, `got ${artifact.footprint.depthFt}`);
  }
  if (testCase.expectBaths) {
    const bathsInPlan = artifact.rooms.filter((room) => room.type === 'bathroom').length;
    check(`bath count ${testCase.expectBaths}`, bathsInPlan === testCase.expectBaths, `got ${bathsInPlan}`);
  }
  if (testCase.expectBathNote) {
    // A dropped 2nd bath must be SURFACED (no silent program mismatch) — same
    // input-honesty class as the bedroom over-cap refusal.
    // ...and the reason must be the real one. "Enlarge the footprint" is false
    // advice when the request simply exceeds what any template offers.
    {
      const note = (compiled.notes || []).find((entry) => /baths; built/.test(entry));
      const asked = testCase.brief.match(/(\d+)\s*bath/i);
      if (note && asked) {
        const requested = Number(asked[1]);
        const expectReason = requested > 2 ? /largest template provides/i
          : testCase.bedrooms === 1 ? /single-bedroom programs are single-bath/i
            : /footprint fits this size\/lot/i;
        check(`bath downgrade names the true reason (asked ${requested})`, expectReason.test(note), note);
      }
    }
    check('bath downgrade surfaced as a note (not silent)',
      (compiled.notes || []).some((note) => /bath/i.test(note)),
      JSON.stringify(compiled.notes) || 'no notes');
  }
  if (Number.isFinite(parsed.maxSqft)) {
    const area = artifact.footprint.widthFt * artifact.footprint.depthFt;
    check(`footprint ${area} sq ft within max ${parsed.maxSqft}`, area <= parsed.maxSqft);
  }
  const unhosted = [...artifact.doors, ...artifact.windows, ...artifact.openings].filter((opening) => !opening.wallId);
  check('every door/window/opening sits on a wall', unhosted.length === 0, unhosted.map((o) => o.id).join(', '));
  // Every bathroom must have a lavatory — a toilet-only room is not a bathroom
  // (architectural completeness; compact second baths used to ship toilet-only).
  for (const bathroom of artifact.rooms.filter((room) => room.type === 'bathroom')) {
    const fxTypes = (artifact.fixtures ?? []).filter((f) => f.roomId === bathroom.id).map((f) => f.type ?? '');
    check(`bathroom ${bathroom.id} has a lavatory`, fxTypes.some((t) => /sink|vanity/i.test(t)), JSON.stringify(fxTypes));
  }
  // PHYSICAL USABILITY (universal property): every fixture must have the
  // headroom its use requires — 6'8" to stand at (R305 bath minimum), 5 ft to
  // occupy (below R305's cutoff the floor area does not count at all). Fixtures
  // used to be authored in 2D with no ceiling query, so an a-frame would place a
  // bed or a shower under a ~2 ft eave: drawn, gated, and unusable.
  for (const fx of artifact.fixtures ?? []) {
    if (!fx.bounds) continue;
    const head = headroomOverFt(ceilingPlanes(artifact), fx.bounds);
    const need = requiredHeadroomFt(fx.type);
    check(
      `fixture has usable headroom: ${fx.id} (${fx.type})`,
      head >= need - 1e-6,
      `${head.toFixed(2)} ft available, needs ${need.toFixed(2)} ft`,
    );
  }

  // NON-COLLISION (universal property): no two fixtures may occupy the same
  // floor. Envelope-aware relocation makes this a live risk — a placement rule
  // that optimises one fixture at a time sends every fixture in a room to the
  // same optimum and silently stacks them. Nothing asserted this before, which
  // is exactly why a plan could ship four kitchen fixtures on one spot.
  {
    const fxs = (artifact.fixtures ?? []).filter((fx) => fx.bounds);
    for (let i = 0; i < fxs.length; i += 1) {
      for (let j = i + 1; j < fxs.length; j += 1) {
        const a = fxs[i].bounds;
        const b = fxs[j].bounds;
        const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const iz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
        check(
          `fixtures do not overlap: ${fxs[i].id} / ${fxs[j].id}`,
          !(ix > CLEARANCE_FT && iz > CLEARANCE_FT),
          `${ix.toFixed(2)} x ${iz.toFixed(2)} ft of shared floor`,
        );
      }
    }
  }

  // DOCUMENTATION COMPLETENESS (universal property): every facade that carries
  // an opening must appear in the drawing set. The set used to be a hardcoded
  // [front, side] pair, so once openings resolve against the envelope and land
  // on the rear or right wall, those walls were drawn nowhere.
  {
    const EPSF = 0.35;
    const faces = [
      { view: 'front', axis: 'z', at: 0 },
      { view: 'rear', axis: 'z', at: artifact.footprint.depthFt },
      { view: 'side', axis: 'x', at: 0 },
      { view: 'right', axis: 'x', at: artifact.footprint.widthFt },
    ];
    const ops = [...(artifact.windows ?? []), ...(artifact.doors ?? [])].filter((o) => o.span);
    for (const face of faces) {
      const carries = ops.some((o) => face.axis === 'x'
        ? Math.abs(o.span.x1 - face.at) < EPSF && Math.abs(o.span.x2 - face.at) < EPSF
        : Math.abs(o.span.z1 - face.at) < EPSF && Math.abs(o.span.z2 - face.at) < EPSF);
      if (!carries) continue;
      check(
        `facade with openings is drawn: ${face.view}`,
        (artifact.elevations ?? []).some((e) => e.view === face.view),
        (artifact.elevations ?? []).map((e) => e.view).join(', '),
      );
    }
  }

  // A requested loft the roof cannot host is a valid plan minus a feature — but
  // it must SAY so. flat/shed/hip used to drop the loft in silence.
  if (/with loft/i.test(testCase.brief)) {
    const levels = artifact.footprint.levels ?? 1;
    const said = (compiled.notes || []).some((note) => /requested a loft; built none/.test(note));
    check('a dropped loft is surfaced (not silent)', levels >= 2 || said,
      `levels ${levels}, notes ${JSON.stringify(compiled.notes || [])}`);
    check('a built loft is not falsely reported as dropped', levels < 2 || !said);
  }

  const badCallouts = artifact.rooms.filter((room, index) => room.calloutNumber !== index + 1);
  check('callout numbers are 1..N', badCallouts.length === 0);

  // Constraint report: the fitness function.
  const report = reportForArtifact(artifact);
  const failFindings = report.findings.filter((finding) => finding.status === 'fail');
  check(
    'zero constraint-fail findings',
    failFindings.length === 0,
    failFindings.map((finding) => `[${finding.ruleId}] ${finding.subjectLabel ?? ''} ${finding.detail}`).join(' | '),
  );
  for (const bedroom of bedroomsInPlan) {
    check(`egress proves for ${bedroom.id}`, statusOf(report, 'IRC-R310.1', bedroom.id) === 'pass');
    // A sleeping room's egress window must be operable — a fixed window cannot
    // open and so cannot serve as an emergency escape opening (IRC R310.1).
    const bedWindows = (artifact.windows ?? []).filter((win) => (win.roomIds ?? [win.roomId]).includes(bedroom.id));
    check(
      `egress window operable (not fixed) for ${bedroom.id}`,
      bedWindows.length > 0 && bedWindows.every((win) => win.windowKind && win.windowKind !== 'fixed'),
      bedWindows.map((win) => `${win.id}:${win.windowKind}`).join(', '),
    );
    // PHYSICAL REALIZABILITY (the universal property, not a per-roof case): an
    // egress opening must fit the wall that hosts it. The envelope varies across
    // a facade, so an opening authored blind to the roof can land where there is
    // no wall — an a-frame once put both bedroom egress windows on a 2.13 ft
    // eave, which R310 passed because it only checked presence and operability.
    // Openings are now RESOLVED against the ceiling planes; this proves it.
    for (const win of bedWindows) {
      let lowest = Infinity;
      for (let t = 0; t <= 1; t += 0.25) {
        const x = win.span.x1 + (win.span.x2 - win.span.x1) * t;
        const z = win.span.z1 + (win.span.z2 - win.span.z1) * t;
        lowest = Math.min(lowest, ceilingHeightAt(ceilingPlanes(artifact), x, z));
      }
      const clearHeight = (lowest - 0.3) - 0.3;
      const widthFt = Math.hypot(win.span.x2 - win.span.x1, win.span.z2 - win.span.z1);
      check(
        `egress opening physically fits its wall for ${bedroom.id} (${win.id})`,
        clearHeight >= 24 / 12 && clearHeight * widthFt >= 5.7,
        `clear ${clearHeight.toFixed(2)} ft x ${widthFt.toFixed(1)} ft = ${(clearHeight * widthFt).toFixed(1)} sqft at wall height ${lowest.toFixed(2)} ft`,
      );
    }
  }
  check('4 ft grid passes', statusOf(report, 'WH-GRID-4FT') === 'pass');
  const lotExpectation = testCase.hasLot ? 'pass' : 'not-evaluated';
  check(`setbacks ${lotExpectation}`, statusOf(report, 'ZON-SETBACK') === lotExpectation, statusOf(report, 'ZON-SETBACK'));
  check(`coverage ${lotExpectation}`, statusOf(report, 'ZON-COVERAGE') === lotExpectation, statusOf(report, 'ZON-COVERAGE'));

  // R305 must genuinely evaluate from roof geometry — and pass — for every
  // wet room and habitable room. This is the named A-frame bath fix.
  const wetRooms = artifact.rooms.filter((room) => /bath|laundry/i.test(`${room.type} ${room.label}`));
  for (const wetRoom of wetRooms) {
    check(`R305 ceiling passes for ${wetRoom.id}`, statusOf(report, 'IRC-R305.1', wetRoom.id) === 'pass', statusOf(report, 'IRC-R305.1', wetRoom.id));
  }
  const r305NotEvaluated = report.findings.filter((finding) => finding.ruleId === 'IRC-R305.1' && finding.status === 'not-evaluated');
  check('R305 evaluated for every ceiling-ruled room', r305NotEvaluated.length === 0, r305NotEvaluated.map((f) => f.subjectId).join(', '));
}

// --- Loft generation ---------------------------------------------------------
// A loft level is emitted when the roof supports it, stays absent otherwise,
// never disturbs single-level plans, and passes R305 on its REAL headroom
// (clearance measured from the loft floor, not the ground).
console.log('loft: a-frame with loft yields a level-1 loft');
const aLoft = compileIntent(mockIntentFromBrief(parseBrief('2 bed a-frame with loft, 40x60 lot, 5 ft side setbacks')), 'battery-loft-a', 'a-frame loft');
check('compiles cleanly', aLoft.ok, aLoft.errors.join('; '));
check('footprint reports 2 levels', aLoft.artifact?.footprint?.levels === 2);
check('a floor-1 loft panel is emitted', (aLoft.artifact?.floorPanels ?? []).some((panel) => panel.floor === 1));
const loftRoom = (aLoft.artifact?.rooms ?? []).find((room) => room.levelIndex === 1);
check('loft room sits at level 1', loftRoom?.type === 'loft', JSON.stringify(loftRoom ?? null));
check('loft band stays inside the footprint', Boolean(loftRoom) && loftRoom.bounds.x >= 0 && loftRoom.bounds.x + loftRoom.bounds.w <= aLoft.artifact.footprint.widthFt + 1e-6);
check('loft access ladder is emitted', (aLoft.artifact?.fixtures ?? []).some((fx) => fx.type === 'loft_access_ladder'));
// The loft window must host on a same-floor loft wall (alignment requires it),
// and be named/leveled so the elevation draws it at loft sill height.
const loftWall = (aLoft.artifact?.exteriorWalls ?? []).find((wall) => wall.floor === 1);
check('a floor-1 loft wall is emitted', Boolean(loftWall), JSON.stringify(loftWall ?? null));
const loftWindow = (aLoft.artifact?.windows ?? []).find((win) => win.id === 'win-l1-loft');
check('loft window emitted at level 1', loftWindow?.floor === 1 && loftWindow?.levelIndex === 1, JSON.stringify(loftWindow ?? null));
check('loft window hosts on the loft wall', Boolean(loftWall) && loftWindow?.wallId === loftWall.id);
// R305 on the loft's true headroom (measured from the loft floor).
const aLoftReport = reportForArtifact(aLoft.artifact);
check('loft room R305 evaluated', statusOf(aLoftReport, 'IRC-R305.1', loftRoom?.id) !== 'missing' && statusOf(aLoftReport, 'IRC-R305.1', loftRoom?.id) !== 'not-evaluated', statusOf(aLoftReport, 'IRC-R305.1', loftRoom?.id));
check('loft room passes R305 from the loft floor', statusOf(aLoftReport, 'IRC-R305.1', loftRoom?.id) === 'pass', statusOf(aLoftReport, 'IRC-R305.1', loftRoom?.id));
// Fall protection (IRC R312): the loft is open to below along its long edges
// (~8 ft above the level below). The plan MUST model a guard rail on each open
// edge — a loft handed to a builder without fall protection is a real hazard.
const loftGuards = (aLoft.artifact?.interiorWalls ?? []).filter((wall) => (wall.floor ?? wall.levelIndex) === 1 && /guard|rail/i.test(`${wall.wallKind ?? ''} ${wall.kind ?? ''}`));
check('loft models a guard rail on each open edge (R312)', loftGuards.length >= 2, `${loftGuards.length} guard walls: ${loftGuards.map((w) => w.id).join(', ')}`);
check('loft guard rails stay inside the footprint', loftGuards.every((w) => w.span.x1 >= -1e-6 && w.span.x2 <= aLoft.artifact.footprint.widthFt + 1e-6 && w.span.z1 >= -1e-6 && w.span.z2 <= aLoft.artifact.footprint.depthFt + 1e-6));
// The guard is surfaced to the user as a note too (what's modeled vs what still
// needs shop-drawing detail), never silently shipped (input honesty, P5).
check('loft surfaces a fall-protection note', (aLoft.notes ?? []).some((note) => /guard|R312|fall protection/i.test(note)), JSON.stringify(aLoft.notes ?? null));

console.log('loft: a steep gable earns a loft too');
const gLoft = compileIntent(mockIntentFromBrief(parseBrief('2 bed gable with loft, 40x60 lot, 5 ft side setbacks')), 'battery-loft-g', 'gable loft');
check('compiles cleanly', gLoft.ok, gLoft.errors.join('; '));
check('steep gable yields a floor-1 loft', (gLoft.artifact?.floorPanels ?? []).some((panel) => panel.floor === 1));
const gLoftRoom = (gLoft.artifact?.rooms ?? []).find((room) => room.levelIndex === 1);
const gLoftReport = reportForArtifact(gLoft.artifact);
check('steep-gable loft passes R305 from the loft floor', statusOf(gLoftReport, 'IRC-R305.1', gLoftRoom?.id) === 'pass', statusOf(gLoftReport, 'IRC-R305.1', gLoftRoom?.id));

console.log('loft: single-level plan unchanged when no loft requested');
const noLoft = compileIntent(mockIntentFromBrief(parseBrief('2 bed a-frame, 40x60 lot, 5 ft side setbacks')), 'battery-noloft', 'a-frame');
check('stays single level', noLoft.artifact?.footprint?.levels !== 2);
check('no floor-1 panel', !(noLoft.artifact?.floorPanels ?? []).some((panel) => panel.floor === 1));
check('no level-1 rooms', !(noLoft.artifact?.rooms ?? []).some((room) => room.levelIndex === 1));
check('single-level plan has no fall-protection note', !(noLoft.notes ?? []).some((note) => /guard|R312|fall protection/i.test(note)), JSON.stringify(noLoft.notes ?? null));
check('single-level plan has no loft guard walls', !(noLoft.artifact?.interiorWalls ?? []).some((wall) => /guard|rail/i.test(`${wall.wallKind ?? ''} ${wall.kind ?? ''}`)));

// --- Flat roof (fire 14): built, not refused -------------------------------
// A flat roof is ONE horizontal plane at a constant ceiling height — the same
// plane-fit / clip / ceiling-profile machinery, with no rise. It must compile,
// expose a single horizontal roof plane, a flat ceiling for every habitable
// room, and pass R305 from that ceiling.
console.log('flat roof: a flat-roof brief builds a sound single-level plan');
const flat = compileIntent(mockIntentFromBrief(parseBrief('2 bed flat roof, 40x60 lot, 5 ft setbacks')), 'battery-flat', 'flat roof');
check('compiles cleanly', flat.ok, flat.errors.join('; '));
check('roof style is flat', flat.artifact?.roof?.style === 'flat', flat.artifact?.roof?.style);
check('flat roof has exactly one roof plane', (flat.artifact?.roof?.planes ?? []).length === 1, `${(flat.artifact?.roof?.planes ?? []).length} planes`);
const flatPlane = (flat.artifact?.roof?.planes ?? [])[0];
const flatYs = (flatPlane?.points ?? []).map((p) => p.y);
check('flat roof plane is horizontal (ridge == eave)', flatYs.length > 0 && Math.max(...flatYs) - Math.min(...flatYs) < 1e-6 && flat.artifact.roof.ridgeHeightFt === flat.artifact.roof.eaveHeightFt, `${flat.artifact?.roof?.ridgeHeightFt}/${flat.artifact?.roof?.eaveHeightFt}`);
check('flat roof stays single level (no loft band under a flat roof)', flat.artifact?.footprint?.levels !== 2);
check('flat roof elevations are valid outlines (>=3 pts)', (flat.artifact?.elevations ?? []).length >= 2 && (flat.artifact?.elevations ?? []).every((e) => (e.outline ?? []).length >= 3));
const flatReport = reportForArtifact(flat.artifact);
const flatBeds = flat.artifact.rooms.filter((r) => r.type === 'bedroom');
for (const bed of flatBeds) {
  check(`flat-roof ${bed.id} R305 passes on the flat ceiling`, statusOf(flatReport, 'IRC-R305.1', bed.id) === 'pass', statusOf(flatReport, 'IRC-R305.1', bed.id));
}
check('flat roof has zero constraint-fail findings', flatReport.findings.filter((f) => f.status === 'fail').length === 0, flatReport.findings.filter((f) => f.status === 'fail').map((f) => f.ruleId).join(', '));

// --- Shed roof (fire 15): built, not refused -------------------------------
// A shed roof is ONE sloped plane (high edge ridge -> low edge eave). Same
// plane-fit / clip / ceiling-profile machinery; the slope is real (ridge > eave)
// but both heights clear 7 ft, so R305 passes across the whole floor.
console.log('shed roof: a shed-roof brief builds a sound single-slope plan');
const shed = compileIntent(mockIntentFromBrief(parseBrief('2 bed shed roof, 40x60 lot, 5 ft setbacks')), 'battery-shed', 'shed roof');
check('compiles cleanly', shed.ok, shed.errors.join('; '));
check('roof style is shed', shed.artifact?.roof?.style === 'shed', shed.artifact?.roof?.style);
check('shed roof has exactly one roof plane', (shed.artifact?.roof?.planes ?? []).length === 1, `${(shed.artifact?.roof?.planes ?? []).length} planes`);
check('shed roof actually slopes (ridge > eave)', shed.artifact?.roof?.ridgeHeightFt > shed.artifact?.roof?.eaveHeightFt, `${shed.artifact?.roof?.ridgeHeightFt}/${shed.artifact?.roof?.eaveHeightFt}`);
const shedPlaneYs = ((shed.artifact?.roof?.planes ?? [])[0]?.points ?? []).map((p) => p.y);
check('shed plane spans ridge..eave', shedPlaneYs.length > 0 && Math.abs(Math.max(...shedPlaneYs) - shed.artifact.roof.ridgeHeightFt) < 1e-6 && Math.abs(Math.min(...shedPlaneYs) - shed.artifact.roof.eaveHeightFt) < 1e-6);
check('shed roof stays single level', shed.artifact?.footprint?.levels !== 2);
check('shed roof elevations are valid outlines (>=3 pts)', (shed.artifact?.elevations ?? []).length >= 2 && (shed.artifact?.elevations ?? []).every((e) => (e.outline ?? []).length >= 3));
// The across-slope (front) elevation must be ASYMMETRIC: one end at ridge, the
// other at eave — not a centered gable apex.
const shedFront = (shed.artifact?.elevations ?? []).find((e) => e.view === 'front');
const frontYs = (shedFront?.outline ?? []).map((p) => p.y);
check('shed front elevation is mono-pitch (spans ridge..eave)', frontYs.length > 0 && Math.max(...frontYs) >= shed.artifact.roof.ridgeHeightFt - 1e-6 && Math.min(...frontYs) <= shed.artifact.roof.eaveHeightFt + 1e-6);
const shedReport = reportForArtifact(shed.artifact);
for (const bed of shed.artifact.rooms.filter((r) => r.type === 'bedroom')) {
  check(`shed-roof ${bed.id} R305 passes under the slope`, statusOf(shedReport, 'IRC-R305.1', bed.id) === 'pass', statusOf(shedReport, 'IRC-R305.1', bed.id));
}
check('shed roof has zero constraint-fail findings', shedReport.findings.filter((f) => f.status === 'fail').length === 0, shedReport.findings.filter((f) => f.status === 'fail').map((f) => f.ruleId).join(', '));

// --- Hip roof (fire 16): built, not refused --------------------------------
// A hip is FOUR planes rising to a central ridge (a pyramid on a square
// footprint). The eave runs around the whole perimeter at 8 ft, so the ceiling
// is >= 8 everywhere -> R305 passes across the floor. Same plane machinery.
console.log('hip roof: square footprint -> pyramid; rectangle -> ridge line');
for (const [label, brief, expectSquare] of [['2-bed hip (square)', '2 bed hip roof, 40x60 lot, 5 ft setbacks', true], ['3-bed hip (rect)', '3 bed hip roof, 60x80 lot, 10 ft setbacks', false]]) {
  const hip = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'battery-hip', brief);
  check(`${label}: compiles cleanly`, hip.ok, hip.errors.join('; '));
  if (!hip.ok) continue;
  check(`${label}: roof style is hip`, hip.artifact.roof.style === 'hip', hip.artifact.roof.style);
  check(`${label}: hip has four roof planes`, (hip.artifact.roof.planes ?? []).length === 4, `${(hip.artifact.roof.planes ?? []).length} planes`);
  check(`${label}: ridge along the longer axis`, hip.artifact.roof.ridgeAxis === (hip.artifact.footprint.widthFt >= hip.artifact.footprint.depthFt ? 'x' : 'z'));
  // Eave around the whole perimeter: every plane reaches the eave height.
  const reachesEave = (hip.artifact.roof.planes ?? []).every((p) => (p.points ?? []).some((pt) => Math.abs(pt.y - hip.artifact.roof.eaveHeightFt) < 1e-6));
  check(`${label}: every hip plane reaches the eave (perimeter eave)`, reachesEave);
  check(`${label}: stays single level`, hip.artifact.footprint.levels !== 2);
  check(`${label}: elevations are valid outlines (>=3 pts)`, (hip.artifact.elevations ?? []).every((e) => (e.outline ?? []).length >= 3));
  const hipReport = reportForArtifact(hip.artifact);
  for (const bed of hip.artifact.rooms.filter((r) => r.type === 'bedroom')) {
    check(`${label}: ${bed.id} R305 passes (perimeter eave >= 7 ft)`, statusOf(hipReport, 'IRC-R305.1', bed.id) === 'pass', statusOf(hipReport, 'IRC-R305.1', bed.id));
  }
  check(`${label}: zero constraint-fail findings`, hipReport.findings.filter((f) => f.status === 'fail').length === 0, hipReport.findings.filter((f) => f.status === 'fail').map((f) => f.ruleId).join(', '));
}

// --- Gambrel roof (fire 17): built, not refused -----------------------------
// A gambrel is a two-pitch gable: a steep lower plane (eave -> knuckle) and a
// shallow upper plane (knuckle -> ridge) per side = four planes. Eave 8 ft so
// R305 passes; the gable end is a 5-sided silhouette.
console.log('gambrel roof: a gambrel-roof brief builds a sound two-pitch plan');
const gambrel = compileIntent(mockIntentFromBrief(parseBrief('2 bed gambrel, 40x60 lot, 5 ft setbacks')), 'battery-gambrel', 'gambrel roof');
check('compiles cleanly', gambrel.ok, gambrel.errors.join('; '));
check('roof style is gambrel', gambrel.artifact?.roof?.style === 'gambrel', gambrel.artifact?.roof?.style);
check('gambrel has four roof planes (two per side)', (gambrel.artifact?.roof?.planes ?? []).length === 4, `${(gambrel.artifact?.roof?.planes ?? []).length} planes`);
// The lower slope must be STEEPER than the upper slope (the gambrel signature).
const gPlanes = gambrel.artifact?.roof?.planes ?? [];
const slopeOf = (id) => { const p = gPlanes.find((q) => q.id === id); if (!p) return 0; const ys = p.points.map((pt) => pt.y); const xs = p.points.map((pt) => pt.x); return (Math.max(...ys) - Math.min(...ys)) / Math.max(1e-6, Math.max(...xs) - Math.min(...xs)); };
check('gambrel lower slope is steeper than the upper slope', slopeOf('roof-plane-west-lower') > slopeOf('roof-plane-west-upper'), `${slopeOf('roof-plane-west-lower').toFixed(2)} vs ${slopeOf('roof-plane-west-upper').toFixed(2)}`);
check('gambrel stays single level', gambrel.artifact?.footprint?.levels !== 2);
const gFront = (gambrel.artifact?.elevations ?? []).find((e) => e.view === 'front');
check('gambrel front elevation is a 5-sided two-pitch silhouette', (gFront?.outline ?? []).length === 5, `${(gFront?.outline ?? []).length} pts`);
const gReport = reportForArtifact(gambrel.artifact);
for (const bed of gambrel.artifact.rooms.filter((r) => r.type === 'bedroom')) {
  check(`gambrel ${bed.id} R305 passes`, statusOf(gReport, 'IRC-R305.1', bed.id) === 'pass', statusOf(gReport, 'IRC-R305.1', bed.id));
}
check('gambrel has zero constraint-fail findings', gReport.findings.filter((f) => f.status === 'fail').length === 0, gReport.findings.filter((f) => f.status === 'fail').map((f) => f.ruleId).join(', '));

// --- Barn roof (fire 18): built, not refused --------------------------------
// A barn is a gambrel hipped on all four sides = TWO STACKED HIPS (steep lower
// band eave -> knuckle ring, shallow upper band knuckle ring -> ridge) = eight
// planes. Eave 8 ft so R305 passes; both elevations are two-pitch hipped.
console.log('barn roof: gambrel hipped on all four sides (two stacked hips)');
for (const [label, brief] of [['2-bed barn (square)', '2 bed barn roof, 40x60 lot, 5 ft setbacks'], ['3-bed barn (rect)', '3 bed barn roof, 60x80 lot, 10 ft setbacks']]) {
  const barn = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'battery-barn', brief);
  check(`${label}: compiles cleanly`, barn.ok, barn.errors.join('; '));
  if (!barn.ok) continue;
  check(`${label}: roof style is barn`, barn.artifact.roof.style === 'barn', barn.artifact.roof.style);
  check(`${label}: barn has eight roof planes (two stacked hips)`, (barn.artifact.roof.planes ?? []).length === 8, `${(barn.artifact.roof.planes ?? []).length} planes`);
  // Every plane reaches either the eave (lower band) or is above it (upper band);
  // at least the four lower planes touch the perimeter eave.
  const touchesEave = (barn.artifact.roof.planes ?? []).filter((p) => (p.points ?? []).some((pt) => Math.abs(pt.y - barn.artifact.roof.eaveHeightFt) < 1e-6));
  check(`${label}: four lower planes reach the perimeter eave`, touchesEave.length === 4, `${touchesEave.length}`);
  check(`${label}: stays single level`, barn.artifact.footprint.levels !== 2);
  const bFront = (barn.artifact.elevations ?? []).find((e) => e.view === 'front');
  check(`${label}: front elevation is a two-pitch hipped silhouette (6 pts)`, (bFront?.outline ?? []).length === 6, `${(bFront?.outline ?? []).length} pts`);
  const bReport = reportForArtifact(barn.artifact);
  for (const bed of barn.artifact.rooms.filter((r) => r.type === 'bedroom')) {
    check(`${label}: ${bed.id} R305 passes`, statusOf(bReport, 'IRC-R305.1', bed.id) === 'pass', statusOf(bReport, 'IRC-R305.1', bed.id));
  }
  check(`${label}: zero constraint-fail findings`, bReport.findings.filter((f) => f.status === 'fail').length === 0, bReport.findings.filter((f) => f.status === 'fail').map((f) => f.ruleId).join(', '));
}

// --- The UI's brief echo must not hardcode the template ceiling -------------
// The brief echo ("Understood: N bed (max M)") states the generator's bedroom
// cap to the user. When it hardcodes a literal, raising MAX_TEMPLATE_BEDROOMS
// leaves the UI contradicting the compiler in the SAME view — the echo said
// "3 bed (max 3)" while the refusal underneath said "builds at most 4".
// The echo must derive the cap from the exported constant, not a literal.
{
  const pageSource = readFileSync(join(root, 'app/page.tsx'), 'utf8');
  const echoLine = pageSource.split('\n').find((line) => line.includes('bed${') && line.includes('max'));
  check('brief echo derives the bedroom cap from MAX_TEMPLATE_BEDROOMS', Boolean(echoLine) && /MAX_TEMPLATE_BEDROOMS/.test(echoLine), echoLine?.trim().slice(0, 110) ?? 'echo line not found');
  check('app imports MAX_TEMPLATE_BEDROOMS (single source of truth)', /MAX_TEMPLATE_BEDROOMS/.test(pageSource));
}

// --- 4-bedroom synthesis (fire 19) ------------------------------------------
// The generator now builds 4 bedrooms (was capped at 3). A 48x28 plan tiles
// four bedrooms + a central bath across the rear band; every bedroom gets an
// operable egress window and passes R305. a-frame is refused (low eave), 5+ is
// refused (template ceiling).
console.log('4-bed: four bedrooms synthesize on a 48x28 plan');
const fourBed = compileIntent(mockIntentFromBrief(parseBrief('4 bed gable, 80x100 lot, 10 ft setbacks')), 'battery-4bed', '4 bed gable');
check('compiles cleanly', fourBed.ok, fourBed.errors.join('; '));
const fourBeds = (fourBed.artifact?.rooms ?? []).filter((r) => r.type === 'bedroom');
check('exactly four bedrooms', fourBeds.length === 4, `${fourBeds.length}`);
check('footprint is 48x28', fourBed.artifact?.footprint?.widthFt === 48 && fourBed.artifact?.footprint?.depthFt === 28);
check('a bathroom is present', (fourBed.artifact?.rooms ?? []).some((r) => r.type === 'bathroom'));
// No overlaps + all rooms inside the footprint (the validator would have caught
// these as compile errors, but assert structurally too).
const fourReport = reportForArtifact(fourBed.artifact);
for (const bed of fourBeds) {
  check(`4-bed ${bed.id} proves egress`, statusOf(fourReport, 'IRC-R310.1', bed.id) === 'pass', statusOf(fourReport, 'IRC-R310.1', bed.id));
  check(`4-bed ${bed.id} R305 passes`, statusOf(fourReport, 'IRC-R305.1', bed.id) === 'pass', statusOf(fourReport, 'IRC-R305.1', bed.id));
  const win = (fourBed.artifact.windows ?? []).filter((w) => (w.roomIds ?? [w.roomId]).includes(bed.id));
  check(`4-bed ${bed.id} egress window operable`, win.length > 0 && win.every((w) => w.windowKind && w.windowKind !== 'fixed'));
}
check('4-bed grid passes', statusOf(fourReport, 'WH-GRID-4FT') === 'pass', statusOf(fourReport, 'WH-GRID-4FT'));
check('4-bed has zero constraint-fail findings', fourReport.findings.filter((f) => f.status === 'fail').length === 0, fourReport.findings.filter((f) => f.status === 'fail').map((f) => f.ruleId).join(', '));
// 4-bed builds for every eave->=7 roof style; a-frame is refused.
for (const s of ['gable', 'flat', 'shed', 'hip', 'gambrel', 'barn']) {
  check(`4-bed ${s} compiles`, compileIntent(mockIntentFromBrief(parseBrief(`4 bed ${s} roof, 80x100 lot, 10 ft setbacks`)), 'b', 'x').ok);
}
check('4-bed a-frame refused', !compileIntent(mockIntentFromBrief(parseBrief('4 bed a-frame, 80x100 lot, 10 ft setbacks')), 'b', 'x').ok);

console.log('loft: a roof with no headroom degrades honestly (no loft built)');
// Direct intent with a near-flat roof: buildLoft must refuse rather than fake
// a loft under a roof that cannot clear one.
const flatRoofLoft = compileIntent({
  name: 'flat-loft', footprint: { widthFt: 28, depthFt: 28 }, hasLoft: true,
  roof: { style: 'gable', ridgeAxis: 'z', ridgeHeightFt: 9, eaveHeightFt: 8 },
  rooms: [
    { id: 'room-living', label: 'Living', type: 'living', x: 0, z: 0, w: 28, d: 16 },
    { id: 'room-bed1', label: 'Bedroom 1', type: 'bedroom', x: 0, z: 16, w: 28, d: 12 },
  ],
  doors: [{ id: 'door-entry', fromRoomId: 'exterior', toRoomId: 'room-living', openingType: 'exteriorDoor', span: { x1: 12, z1: 0, x2: 15, z2: 0 } }],
  windows: [{ id: 'win-bed1', roomId: 'room-bed1', span: { x1: 0, z1: 20, x2: 0, z2: 24 } }],
  openings: [],
}, 'battery-flatloft', 'flat loft');
check('compiles cleanly', flatRoofLoft.ok, flatRoofLoft.errors.join('; '));
check('no loft under a no-headroom roof', !(flatRoofLoft.artifact?.floorPanels ?? []).some((panel) => panel.floor === 1));
check('stays single level', flatRoofLoft.artifact?.footprint?.levels !== 2);

// ---------------------------------------------------------------------------
// THE CONSTRAINT ENGINE MUST BE ABLE TO SAY NO.
//
// Every other check here asks "does a good plan pass?". None asked the harder
// question: does a BROKEN plan fail? A rule that never fires is indistinguishable
// from a rule that is always satisfied, and the whole product rests on these
// verdicts being real. So: take a plan the engine passes, break it in the exact
// way each rule exists to catch, and require that rule to report `fail`.
console.log('constraint engine: a deliberately broken plan must FAIL, per rule');
{
  const good = compileIntent(mockIntentFromBrief(parseBrief('2 bed gable, 60x90 lot, 10 ft setbacks')), 'engine-probe', 'x');
  check('probe plan compiles', good.ok, (good.errors ?? []).join('; '));
  if (good.ok) {
    const clean = reportForArtifact(good.artifact);
    check('probe plan starts with zero fails',
      clean.findings.filter((f) => f.status === 'fail').length === 0,
      clean.findings.filter((f) => f.status === 'fail').map((f) => f.ruleId).join(', '));

    const clone = () => JSON.parse(JSON.stringify(good.artifact));
    const failsFor = (artifact, ruleId) => reportForArtifact(artifact).findings
      .some((f) => f.ruleId === ruleId && f.status === 'fail');

    // Resize a room the way the SHIPPED path reads it. Compiled rooms carry both
    // `bounds` and `polygon`, and pairedArtifactToLocalHome derives dimensions
    // from the POLYGON — so mutating bounds alone changed nothing downstream.
    // These breakages did that for a long time and still "passed", because the
    // battery graded them through its own private adapter that read bounds.
    // Both are rewritten now, and the report comes from the app adapter, so a
    // breakage that does not reach the product cannot report success.
    const resizeRoom = (room, w, d) => {
      const x = room.bounds?.x ?? 0;
      const z = room.bounds?.z ?? 0;
      if (room.bounds) { room.bounds.w = w; room.bounds.d = d; }
      if (room.polygon) {
        room.polygon = [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];
      }
    };

    const BREAKAGES = [
      ['IRC-R304.1', 'a 4x4 ft bedroom (16 sqft, under the 70 sqft minimum)', (a) => {
        resizeRoom(a.rooms.find((r) => r.type === 'bedroom'), 4, 4);
      }],
      ['IRC-R304.2', 'a bedroom 3 ft across (under the 7 ft minimum dimension)', (a) => {
        const bed = a.rooms.find((r) => r.type === 'bedroom');
        resizeRoom(bed, 3, bed.bounds?.d ?? 12);
      }],
      ['IRC-R305.1', 'a 5 ft ceiling everywhere (under the 7 ft minimum)', (a) => {
        a.roof.ridgeHeightFt = 5;
        a.roof.eaveHeightFt = 5;
        a.roof.planes = (a.roof.planes ?? []).map((plane) => ({
          ...plane,
          points: (plane.points ?? []).map((pt) => ({ ...pt, y: 5 })),
        }));
      }],
      ['IRC-R310.1', 'every bedroom window removed', (a) => { a.windows = []; }],
      ['IRC-R310.1', 'every egress window made inoperable', (a) => {
        for (const w of a.windows ?? []) w.windowKind = 'fixed';
      }],
      ['IRC-R312.1', 'every fall-protection guard stripped from a loft', (a) => {
        const isGuard = (w) => /guard|rail/i.test(`${w.wallKind ?? ''} ${w.id ?? ''}`);
        a.interiorWalls = (a.interiorWalls ?? []).filter((w) => !isGuard(w));
        a.exteriorWalls = (a.exteriorWalls ?? []).filter((w) => !isGuard(w));
      }, '2 bed a-frame with loft, 40x60 lot, 5 ft setbacks'],
      ['ZON-SETBACK', 'a lot too small for the footprint once setbacks are taken', (a) => {
        a.lot = { widthFt: 30, depthFt: 30, setbacksFt: { front: 10, rear: 10, left: 10, right: 10 } };
      }],
      ['ZON-COVERAGE', 'a 10% coverage cap the footprint blows through', (a) => {
        a.lot = { ...(a.lot ?? {}), widthFt: 60, depthFt: 90, maxCoverageRatio: 0.1 };
      }],
      ['WH-GRID-4FT', 'a bedroom 1.3 ft off the 4 ft structural grid', (a) => {
        const bed = a.rooms.find((r) => r.type === 'bedroom');
        resizeRoom(bed, (bed.bounds?.w ?? 12) + 1.3, bed.bounds?.d ?? 12);
      }],
      ['ZON-HEIGHT', 'a height cap well under the ridge the plan already has', (a) => {
        a.lot = { ...(a.lot ?? {}), widthFt: 60, depthFt: 90, maxHeightFt: 6 };
      }],
    ];

    // COVERAGE MUST NOT ROT. Every rule in the registry needs at least one
    // breakage here, or a rule added later is silently never tested for whether
    // it can fail — which is the whole point of this block. (The NC site
    // advisories are deliberately excluded: they are hardcoded `not-evaluated`
    // because septic, flood and town-limits data is not derivable from a floor
    // plan, and check:code pins them there.)
    const covered = new Set(BREAKAGES.map(([ruleId]) => ruleId));
    const uncovered = CODE_ADVISORY_RULES.map((rule) => rule.ruleId).filter((id) => !covered.has(id));
    check('every registry rule has a breakage test', uncovered.length === 0,
      `no breakage proves these can fail: ${uncovered.join(', ')}`);

    for (const [ruleId, description, breakIt, altBrief] of BREAKAGES) {
      const source = altBrief
        ? compileIntent(mockIntentFromBrief(parseBrief(altBrief)), 'engine-probe-alt', altBrief)
        : good;
      if (!source.ok) { check(`probe plan for ${ruleId} compiles`, false, (source.errors ?? []).join('; ')); continue; }
      const broken = JSON.parse(JSON.stringify(source.artifact));
      breakIt(broken);
      let caught = false;
      try { caught = failsFor(broken, ruleId); } catch (error) {
        check(`${ruleId} survives ${description}`, false, `engine threw: ${String(error).slice(0, 80)}`);
        continue;
      }
      check(`${ruleId} FAILS on ${description}`, caught,
        `the engine still reported no ${ruleId} failure — the rule may be vacuous`);
    }
  }
}

console.log('');
if (failures) {
  console.error(`${failures} generation check(s) failed`);
  process.exit(1);
}
console.log('generation battery clean');
