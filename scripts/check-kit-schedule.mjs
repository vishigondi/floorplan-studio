// Battery for the customer-facing kit schedule.
//
// The schedule is the first thing this project produces that is aimed at a
// BUYER rather than a builder or a validator, which changes what can go wrong
// with it. A wrong number in the BOM is a bug; a number in a buyer's document
// that overstates what they are getting is a different kind of failure, and the
// checks here are mostly about that second kind.
//
// Three properties are load-bearing:
//   1. The schedule never bills more than the validator did, and never less.
//      Dropping a line would understate the kit; inventing one would overstate
//      it, and a buyer cannot tell either way by looking.
//   2. Omissions survive. They are the reason the document is trustworthy, so a
//      schedule that quietly loses them is worse than no schedule.
//   3. Pricing exists ONLY when the user supplies a price, and always carries
//      its basis. We hold no price data; a number that appeared without one
//      would be fabricated.
//
// Usage: node scripts/check-kit-schedule.mjs (npm run check:kit)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));
const { pairedArtifactToLocalHome } = await import(join(root, 'lib/data.ts'));
const { buildKitSchedule } = await import(join(root, 'lib/kit/kit-schedule.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

const BRIEFS = [
  '1 bed a-frame roof, 80x100 lot, 10 ft setbacks',
  '2 bed gable roof, 80x100 lot, 10 ft setbacks',
  '3 bed barn roof, 100x120 lot, 10 ft setbacks',
  '4 bed gable roof, 200x200 lot, 5 ft setbacks',
  '2 bed a-frame roof with loft, 40x60 lot, 5 ft setbacks',
];

console.log('kit schedule: every part the validator bills reaches the buyer');
for (const brief of BRIEFS) {
  const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'kit', brief);
  if (!res.ok) { check(`${brief}: compiles`, false, res.errors.join('; ')); continue; }
  const home = pairedArtifactToLocalHome(res.artifact);
  const bom = home.buildValidation?.bom ?? [];
  const omissions = home.buildValidation?.omissions ?? [];
  const schedule = buildKitSchedule({ planId: 'kit', bom, omissions });

  // 1. CONSERVATION. Same ids, same quantities, nothing added, nothing lost.
  const scheduled = schedule.groups.flatMap((g) => g.lines);
  const bomTotal = bom.reduce((n, i) => n + i.quantity, 0);
  check(`${brief}: bills every BOM line (${bom.length})`,
    scheduled.length === bom.length, `${scheduled.length} vs ${bom.length}`);
  check(`${brief}: piece total matches the validator (${bomTotal})`,
    schedule.totalPieces === bomTotal, `${schedule.totalPieces} vs ${bomTotal}`);
  const byId = new Map(scheduled.map((l) => [l.componentId, l.quantity]));
  const drifted = bom.filter((i) => byId.get(i.componentId) !== i.quantity);
  check(`${brief}: no quantity drifts between BOM and schedule`, drifted.length === 0,
    drifted.map((d) => d.componentId).join(', '));

  // 2. OMISSIONS SURVIVE, verbatim.
  check(`${brief}: carries the validator's omissions (${omissions.length})`,
    schedule.omissions.length === omissions.length
      && omissions.every((o) => schedule.omissions.includes(o)));
  check(`${brief}: states what it does not supply`, schedule.notSupplied.length > 0);

  // 3. NO PRICE WITHOUT A USER PRICE.
  check(`${brief}: no pricing when none was supplied`, schedule.pricing === undefined);
}

console.log('\nkit schedule: pricing is arithmetic on the user\'s number, and says so');
{
  const brief = '2 bed gable roof, 80x100 lot, 10 ft setbacks';
  const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'kit', brief);
  const home = pairedArtifactToLocalHome(res.artifact);
  const bom = home.buildValidation?.bom ?? [];
  const total = bom.reduce((n, i) => n + i.quantity, 0);

  for (const bad of [undefined, 0, -5, Number.NaN]) {
    const s = buildKitSchedule({ bom, unitPrice: bad });
    check(`unitPrice ${String(bad)} produces no pricing block`, s.pricing === undefined);
  }

  const priced = buildKitSchedule({ bom, unitPrice: 10, currency: 'USD' });
  check('a supplied price produces a pricing block', Boolean(priced.pricing));
  check('the total is exactly quantity x the user price',
    priced.pricing?.total === total * 10, `${priced.pricing?.total} vs ${total * 10}`);
  check('the pricing carries its basis', Boolean(priced.pricing?.basis?.length));
  // The words matter as much as the number: this is the line that stops a
  // buyer reading arithmetic on their own figure as a quote from us.
  check('the basis refuses the words quote and estimate',
    /not a quote or an estimate/i.test(priced.pricing?.basis ?? ''));
  check('the basis points at the exclusions',
    /not covered/i.test(priced.pricing?.basis ?? ''));
}

console.log('\nkit schedule: no invented sheet count');
{
  // We know the sheet stock and the block families but hold no sheets-per-block
  // figure, so a sheet total would be a guess wearing a unit. This asserts the
  // absence, because the tempting number is exactly the one we cannot support.
  const res = compileIntent(mockIntentFromBrief(parseBrief('2 bed gable roof, 80x100 lot, 10 ft setbacks')), 'kit', 'b');
  const home = pairedArtifactToLocalHome(res.artifact);
  const s = buildKitSchedule({ bom: home.buildValidation?.bom ?? [] });
  const text = JSON.stringify(s).toLowerCase();
  check('no sheet-count field is published', !/"sheets?(count|total)"|sheetcount|sheetstotal/.test(text));
  check('sheet stock is stated as stock, not as a total',
    s.sheetStock.lengthMm === 2440 && s.sheetStock.widthMm === 1220 && s.sheetStock.thicknessMm === 18);
}

console.log('');
if (failures) {
  console.error(`${failures} kit-schedule check(s) failed`);
  process.exit(1);
}
console.log('kit-schedule battery clean');
