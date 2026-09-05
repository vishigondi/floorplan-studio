// Battery for the KIT'S OWN ARCHITECTURE.
//
// The review found a defect no per-module gate could see: lot-positioning and
// shared-deck-plan BOTH reasoned about which side of a unit the deck goes on,
// they disagreed, and nothing connected them. Every module was individually
// green.
//
// A dependency picture would not have caught it either — the two modules
// genuinely do not import each other, and that IS the defect. So this checks
// something stricter than imports: CONCERN OWNERSHIP. Each governing concept has
// exactly one owning module. Any other module that reasons about that concept
// must either import the owner, or be listed as deliberately cross-checked.
//
// Usage: node scripts/check-kit-architecture.mjs (npm run check:kit-architecture)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = join(root, 'lib/kit');

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}

const files = readdirSync(KIT).filter((f) => f.endsWith('.ts'));
const src = Object.fromEntries(files.map((f) => [f, readFileSync(join(KIT, f), 'utf8')]));
const mod = (f) => f.replace(/\.ts$/, '');

/** Real imports, parsed from the source rather than declared. */
const importsOf = Object.fromEntries(files.map((f) => {
  const hits = [...src[f].matchAll(/from\s+'\.\/([\w-]+)(?:\.ts)?'/g)].map((m) => m[1]);
  return [mod(f), [...new Set(hits)]];
}));

/**
 * Concerns that GOVERN something — a rule other modules must not re-derive.
 * `markers` are what reasoning about the concern actually looks like in source.
 * `crossChecked` names modules allowed to touch it without importing the owner,
 * because a battery ties them instead.
 */
const CONCERNS = [
  {
    concern: 'which side of the unit the deck may occupy (NEC 551.77 pedestal band)',
    owner: 'lot-positioning',
    // Markers took three passes to get right, and each wrong one was
    // instructive. /doorSide/ matched deck-pergola, which uses it as a side
    // LABEL for the four sides of a deck — a naming collision. /doorFacing/
    // then matched site-composition, which DEFINES it — a different concern
    // (where a door faces) that merely shares the word "door". Only the two
    // NEC-specific markers actually identify reasoning about this rule.
    markers: [/551\.77/, /pedestalZone/],
    crossChecked: ['shared-deck-plan'],
    note: 'The seam that failed. shared-deck-plan reasons about flank side; the shared-deck battery '
      + 'now runs assessLot() from lot-positioning to tie them.',
  },
  {
    concern: 'NC classification rules — wheels, connections, accessory structures, labels',
    owner: 'nc-classification',
    markers: [/wheels and axles/, /GROSS_TRAILER_AREA/, /loftCountsTowardArea/],
    crossChecked: ['site-composition', 'lot-positioning', 'unit-program', 'pad-spec'],
    note: 'Several modules cite the NC rules. They may quote them; they may not restate them as their '
      + 'own thresholds.',
  },
  {
    concern: 'unit door and glass geometry — where they are and what they face',
    owner: 'site-composition',
    markers: [/doorFacing\(/, /glassFacing\(/, /doorPoint\(/],
    crossChecked: ['shared-deck-plan'],
    note: 'Distinct from the pedestal-band concern despite both involving the word "door". This one '
      + 'is about the unit; that one is about the lot.',
  },
  {
    concern: 'the unit catalogue and what each model actually is',
    owner: 'site-composition',
    markers: [/OBSERVED_UNITS/],
    crossChecked: [],
    note: 'One catalogue. Anything needing unit facts imports it rather than hardcoding dimensions.',
  },
  {
    concern: 'cantilever limits (IRC R507 quarter rule and the absolute caps)',
    owner: 'deck-pergola',
    markers: [/maxWoodOverhangFt/, /R507/],
    crossChecked: ['accent-budget'],
    note: 'accent-budget points at the function rather than repeating the numbers.',
  },
];

console.log('the kit imports what it says it imports');
check(`${files.length} kit modules found`, files.length >= 14, String(files.length));
check('every import target exists',
  Object.entries(importsOf).every(([, deps]) => deps.every((d) => files.includes(`${d}.ts`))),
  Object.entries(importsOf).flatMap(([m, ds]) => ds.filter((d) => !files.includes(`${d}.ts`)).map((d) => `${m}->${d}`)).join());
// A cycle between kit modules would make ownership meaningless.
const cycles = [];
for (const [m, deps] of Object.entries(importsOf)) {
  for (const d of deps) if ((importsOf[d] || []).includes(m)) cycles.push([m, d].sort().join(' <-> '));
}
check('no import cycles between kit modules', cycles.length === 0, [...new Set(cycles)].join(', '));

console.log('every governing concern has exactly one owner');
check('five concerns declared, each with an owning module that exists',
  CONCERNS.length === 5 && CONCERNS.every((c) => files.includes(`${c.owner}.ts`)));
// Two concerns share the word "door" and are NOT the same rule. Keeping them
// separate is what stopped the check flagging a false positive as a defect.
check('the pedestal-band concern and the door-geometry concern have different owners',
  CONCERNS.find((c) => /pedestal band/.test(c.concern)).owner === 'lot-positioning'
  && CONCERNS.find((c) => /door and glass geometry/.test(c.concern)).owner === 'site-composition');
check('and no two concerns claim the same owner for the same rule',
  new Set(CONCERNS.map((c) => c.concern)).size === CONCERNS.length);

console.log('nobody re-derives a concern they do not own');
// THE CHECK THAT WOULD HAVE CAUGHT THE REVIEW DEFECT.
for (const c of CONCERNS) {
  const claimants = files.map(mod).filter((m) => {
    if (m === c.owner) return false;
    return c.markers.some((re) => re.test(src[`${m}.ts`]));
  });
  const unlinked = claimants.filter((m) =>
    !(importsOf[m] || []).includes(c.owner) && !c.crossChecked.includes(m));
  check(`${c.concern.slice(0, 52)}… — every claimant imports the owner or is cross-checked`,
    unlinked.length === 0,
    unlinked.length ? `unlinked: ${unlinked.join(', ')} (owner: ${c.owner})` : '');
}
check('the seam that failed is recorded as cross-checked, not as clean',
  CONCERNS[0].crossChecked.includes('shared-deck-plan')
  && /The seam that failed/.test(CONCERNS[0].note));

console.log('couplings we know about and have not closed');
/**
 * Sharpening the marker above cleared deck-pergola of RE-DERIVING the pedestal
 * rule — it was a naming collision. But the check surfaced a real coupling on
 * the way past, and burying it would waste the finding.
 *
 * deck-pergola is the module that PLACES PILES. lot-positioning owns the NEC
 * pedestal band. Neither knows about the other, so a deck configuration can put
 * a pile straight through the band and nothing here would catch it — which is
 * rework on site, not a drawing error.
 *
 * Not closed, because pilePositions() returns 1-D offsets along a run rather
 * than coordinates, so a real check means reconstructing the deck geometry in
 * site space. Recorded with what would close it, the same way the pad spec
 * carries its own gaps.
 */
const OPEN_COUPLINGS = [
  {
    between: ['deck-pergola', 'lot-positioning'],
    concern: 'Deck piles may land inside the NEC 551.77 pedestal band.',
    why: 'deck-pergola places piles; lot-positioning owns the band; neither imports the other.',
    toClose:
      'pilePositions() returns 1-D offsets along a run, not site coordinates. Closing this means '
      + 'projecting the deck plan into the same frame as pedestalZone() and asserting no pile falls '
      + 'inside it. Worth doing before the B1 civil bid, because it is rework on site rather than a '
      + 'drawing error.',
  },
];
check('open couplings are declared rather than left implicit',
  OPEN_COUPLINGS.length === 1
  && OPEN_COUPLINGS.every((c) => c.between.length === 2 && c.between.every((m) => files.includes(`${m}.ts`))));
check('and each carries what would actually close it',
  OPEN_COUPLINGS.every((c) => c.toClose.length > 80 && /pedestalZone/.test(c.toClose)));
check('the pile-versus-pedestal coupling is the one on the list',
  OPEN_COUPLINGS[0].between.join() === 'deck-pergola,lot-positioning'
  && /pedestal band/.test(OPEN_COUPLINGS[0].concern));

console.log('the catalogue is not duplicated');
// Unit dimensions living in two places is how the two Lunas nearly merged.
const hardcodedUnits = files.map(mod).filter((m) =>
  m !== 'site-composition' && /widthFt:\s*13\.83|widthFt:\s*11\.16/.test(src[`${m}.ts`]));
check('no module hardcodes catalogue unit dimensions outside site-composition',
  hardcodedUnits.length === 0, hardcodedUnits.join(', '));

if (failures > 0) { console.error(`\nkit-architecture battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\nkit-architecture battery clean');
