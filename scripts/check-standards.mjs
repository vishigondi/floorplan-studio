// Battery for the STANDARDS VALIDATOR (lib/standards/floorplan-standards.ts).
//
// `validateStandards` is the second verdict system in this product: it grades the
// semantic BIM model (roles, required fields, host constraints, component
// mappings), feeds the readiness lanes, and is exported as "Standards + Issues
// JSON". Until now **no battery referenced it at all** — and the reason was
// structural, not neglect: the module reached `@/` aliases and extensionless
// imports that raw Node cannot resolve, so no offline gate could load it. Those
// are now relative-with-extension, which is what makes this file possible.
//
// Scope note, stated honestly: this validator is a MODEL-INTEGRITY checker, not
// a design checker. Habitability lives in the code-advisory engine
// (check:code / check:generation). Removing every door from a plan legitimately
// produces FEWER element-level issues here, because there are fewer elements —
// that is not a bug in this validator, it is a different question.
//
// Usage: node scripts/check-standards.mjs (npm run check:standards)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));
const { pairedArtifactToLocalHome } = await import(join(root, 'lib/data.ts'));
const { validateStandards } = await import(join(root, 'lib/standards/floorplan-standards.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
  }
}

function compiled(brief) {
  const result = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'standards-battery', brief);
  if (!result.ok) throw new Error(`compile failed: ${result.errors.join('; ')}`);
  return result.artifact;
}

const validate = (artifact) => validateStandards(pairedArtifactToLocalHome(artifact));
const issuesByPack = (result) => {
  const counts = {};
  for (const issue of result.issues ?? []) {
    counts[issue.standardPack] = counts[issue.standardPack] ?? { blocker: 0, warning: 0 };
    counts[issue.standardPack][issue.severity] = (counts[issue.standardPack][issue.severity] ?? 0) + 1;
  }
  return counts;
};

console.log('standards: the validator loads and runs offline');
const base = compiled('2 bed gable, 60x90 lot, 10 ft setbacks');
const baseline = validate(base);

check('validator returns packs', Array.isArray(baseline.packs) && baseline.packs.length > 0,
  `${(baseline.packs ?? []).length} packs`);
check('validator returns an issue list', Array.isArray(baseline.issues));

// Every pack must be represented in the result. A pack that silently stops being
// evaluated is the vacuous-coverage failure this project keeps hitting.
const EXPECTED_PACKS = [
  'design-basic',
  'stairs-guards',
  'roof-envelope',
  'manufacturing-panel-grid',
  'doors-openings',
  'fixtures-kitchen-bath',
  'export-ifc-experimental',
  'accessibility-optional',
  'code-advisory-dimensional',
];
const present = new Set((baseline.packs ?? []).map((pack) => pack.standardPack));
for (const pack of EXPECTED_PACKS) {
  check(`pack evaluated: ${pack}`, present.has(pack), [...present].join(', '));
}
check('no pack appears that this battery does not know about',
  [...present].every((pack) => EXPECTED_PACKS.includes(pack)),
  [...present].filter((pack) => !EXPECTED_PACKS.includes(pack)).join(', '));

// A clean compiled plan must not BLOCK. Warnings are expected (panel-grid and the
// experimental IFC lane both advise), but a blocker means the product would
// refuse to promote a plan the rest of the ladder calls good.
console.log('standards: a clean compiled plan produces no blockers');
{
  const counts = issuesByPack(baseline);
  const blockers = Object.entries(counts).filter(([, sev]) => (sev.blocker ?? 0) > 0);
  check('clean plan has zero blockers', blockers.length === 0,
    blockers.map(([pack, sev]) => `${pack}:${sev.blocker}`).join(', '));
  console.log(`       (baseline warnings by pack: ${JSON.stringify(counts)})`);
}

// THE MACHINERY MUST NOT BE INERT. If no breakage can ever produce an issue, the
// whole system is decoration — the same question asked of the code engine.
console.log('standards: a broken model produces issues');
{
  const stripped = JSON.parse(JSON.stringify(base));
  stripped.roof.planes = [];
  const counts = issuesByPack(validate(stripped));
  check('removing the roof planes raises a roof-envelope issue',
    (counts['roof-envelope']?.warning ?? 0) + (counts['roof-envelope']?.blocker ?? 0) > 0,
    JSON.stringify(counts));
  check('the broken model reports MORE issues than the clean one',
    (validate(stripped).issues ?? []).length > (baseline.issues ?? []).length,
    `${(validate(stripped).issues ?? []).length} vs ${(baseline.issues ?? []).length}`);
}

console.log('');
if (failures) {
  console.error(`${failures} standards check(s) failed`);
  process.exit(1);
}
console.log('standards battery clean');
