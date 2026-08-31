// Battery for the two bid documents.
//
// Everything upstream is gated on being CORRECT. This is gated on being
// FAITHFUL: the document must say what the take-off says. A renderer is a
// uniquely dangerous place for a bug, because its output looks authoritative by
// construction — a dropped wall run or a total that does not match its own rows
// produces bids for a building nobody modelled, and nothing about the page
// looks wrong.
//
// So the assertions here mostly re-derive from the SOURCE OBJECT and compare
// against what was printed, rather than checking that the text contains
// plausible words.
//
// Usage: node scripts/check-tender.mjs (npm run check:tender)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { adaptArtifactToPanelGeometry, buildPanelSpec } = await import(join(root, 'lib/kit/panel-spec.ts'));
const { buildPileSchedule, CHEROKEE_GROUND_SNOW, CHEROKEE_WIND, GROUND_SNOW_UNCONFIRMED } =
  await import(join(root, 'lib/kit/foundation.ts'));
const { renderPanelTender, renderFoundationTender } = await import(join(root, 'lib/kit/tender.ts'));
const { JURISDICTION_PACKS } = await import(join(root, 'lib/standards/code-advisory.ts'));
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

const thermalEnvelope = JURISDICTION_PACKS.find((p) => p.id === 'nc-cherokee-county')?.thermalEnvelope;
const BRIEFS = [
  '2 bed gable roof, 80x100 lot, 10 ft setbacks',
  '1 bed a-frame roof, 80x100 lot, 10 ft setbacks',
  '3 bed gable roof, 100x120 lot, 10 ft setbacks',
];

/** Pull a numeric cell out of the row whose first cell matches `label`. */
function totalCell(doc, label, column) {
  const row = doc.split('\n').find((l) => l.includes(label));
  if (!row) return null;
  const cells = row.split('|').map((c) => c.replace(/\*/g, '').trim());
  const nums = cells.slice(1).map((c) => (c === '' ? null : Number(c)));
  return nums.filter((n) => n !== null && Number.isFinite(n))[column] ?? null;
}

for (const brief of BRIEFS) {
  const res = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'tender', brief);
  if (!res.ok) { check(`${brief}: compiles`, false, res.errors.join('; ')); continue; }
  const a = res.artifact;
  const g = adaptArtifactToPanelGeometry(a);
  const spec = buildPanelSpec({
    planId: 'tender', footprint: a.footprint, wallRuns: g.wallRuns,
    roofPlanes: g.roofPlanes, thermalEnvelope, nominalThicknessIn: 4.5,
  });
  const sched = buildPileSchedule({
    planId: 'tender', footprint: a.footprint, interiorWalls: a.interiorWalls,
    eaveHeightFt: a.roof.eaveHeightFt, snow: CHEROKEE_GROUND_SNOW, wind: CHEROKEE_WIND,
  });
  const panelDoc = renderPanelTender(spec, { deliverTo: 'Andrews, NC' }, g.notes);
  const foundDoc = renderFoundationTender(sched, { deliverTo: 'Andrews, NC' });

  // NOTHING MAY BE SILENTLY DROPPED. A missing run is a missing quantity, and
  // the bidder has no way to know it was ever there.
  check(`${brief}: every wall run reaches the document`,
    spec.wallRuns.every((r) => panelDoc.includes(r.id)),
    spec.wallRuns.filter((r) => !panelDoc.includes(r.id)).map((r) => r.id).join(','));
  const allOpenings = spec.wallRuns.flatMap((r) => r.openings);
  check(`${brief}: every rough opening reaches the document (${allOpenings.length})`,
    allOpenings.every((o) => panelDoc.includes(o.id)),
    allOpenings.filter((o) => !panelDoc.includes(o.id)).map((o) => o.id).join(','));
  check(`${brief}: every roof plane reaches the document`,
    spec.roofPlanes.every((p) => panelDoc.includes(p.id)));
  check(`${brief}: every pile reaches the foundation document (${sched.piles.length})`,
    sched.piles.every((p) => foundDoc.includes(`| ${p.id} |`)),
    sched.piles.filter((p) => !foundDoc.includes(`| ${p.id} |`)).map((p) => p.id).join(','));

  // THE PRINTED TOTAL MUST EQUAL THE SOURCE. This is the assertion that catches
  // a renderer computing its own numbers, which is how a document drifts from
  // the take-off while every individual row still looks right.
  const quotable = spec.wallRuns.filter((r) => r.kind === 'exterior' && r.profile !== 'slope');
  const wantArea = Math.round(quotable.reduce((t, r) => t + r.grossAreaSqFt, 0) * 100) / 100;
  check(`${brief}: printed exterior total equals the take-off (${wantArea})`,
    totalCell(panelDoc, 'Exterior total', 0) === wantArea,
    `printed ${totalCell(panelDoc, 'Exterior total', 0)}`);
  const wantOpen = Math.round(quotable.reduce((t, r) => t + r.openingAreaSqFt, 0) * 100) / 100;
  check(`${brief}: printed opening total equals the take-off (${wantOpen})`,
    totalCell(panelDoc, 'Exterior total', 1) === wantOpen,
    `printed ${totalCell(panelDoc, 'Exterior total', 1)}`);

  // A gable row must carry the taken-off area, not length x apex. If the
  // renderer recomputed naively, this is where it would show.
  for (const r of spec.wallRuns.filter((x) => x.profile === 'gable-end')) {
    const row = panelDoc.split('\n').find((l) => l.startsWith(`| ${r.id} |`));
    check(`${brief}: ${r.id} prints the taken-off area, not length x apex`,
      Boolean(row && row.includes(`| ${r.grossAreaSqFt} |`) && !row.includes(`| ${r.lengthFt * r.heightFt} |`)),
      row ?? 'row missing');
  }

  // The adapter's warnings live on the GEOMETRY, not the spec, so a caller can
  // drop them and the document still looks complete. That is exactly why this
  // is asserted rather than trusted.
  if (g.notes.length) {
    check(`${brief}: the geometry warnings reach the bidder`,
      g.notes.every((n) => panelDoc.includes(n.slice(0, 40))),
      `${g.notes.filter((n) => !panelDoc.includes(n.slice(0, 40))).length} missing`);
  }
  check(`${brief}: the pile schedule's warnings reach the bidder`,
    sched.notes.every((n) => foundDoc.includes(n.slice(0, 40))));

  // Sill and head both, or the panel cannot be cut from the document.
  if (allOpenings.length) {
    check(`${brief}: the openings table gives sill AND head`,
      /\| Sill ft \| Head ft \|/.test(panelDoc));
  }

  // Provider-neutrality has to survive rendering too.
  const both = `${panelDoc}\n${foundDoc}`.toLowerCase();
  for (const banned of ['insulspan', 'eco-panels', 'ecosips', 'plasti-fab', 'thermapan',
    'techno metal', 'ram jack', 'chance', 'polyurethane', 'eps ']) {
    check(`${brief}: no product or core leaks into the documents ("${banned.trim()}")`,
      !both.includes(banned));
  }
  check(`${brief}: the foundation document specifies torque, never a depth`,
    /torque/i.test(foundDoc) && !/drive (each pile )?to \d+ ?ft/i.test(foundDoc));
  check(`${brief}: it says plainly it is not a foundation design`,
    /not a foundation design/i.test(foundDoc) && /PE/.test(foundDoc));

  // A bid form is what makes two quotes comparable. Without a currency column
  // the cross-currency refusal upstream is meaningless.
  for (const doc of [panelDoc, foundDoc]) {
    check(`${brief}: the document asks for a priced bid form`, /## Your quote/.test(doc));
    check(`${brief}: with an explicit currency column`, /\| Currency \|/.test(doc));
    check(`${brief}: and warns bids are not ranked across currencies`,
      /not converted or\s*\n?\s*ranked across currencies/i.test(doc));
    check(`${brief}: and asks for lead time`, /Lead time/.test(doc));
  }
}

// An unconfirmed load must be visible in the DOCUMENT, not only in the object.
// This is the failure mode where a warning exists, is asserted by its own
// battery, and never reaches the person who needed it.
const a2 = compileIntent(mockIntentFromBrief(parseBrief(BRIEFS[0])), 'tender', BRIEFS[0]).artifact;
const unconf = buildPileSchedule({
  planId: 'tender', footprint: a2.footprint, interiorWalls: a2.interiorWalls,
  eaveHeightFt: a2.roof.eaveHeightFt, snow: GROUND_SNOW_UNCONFIRMED,
});
console.log('an unconfirmed input is visible on the page, not just in the object');
check('the UNCONFIRMED snow warning is printed', /UNCONFIRMED/.test(renderFoundationTender(unconf)));
check('and a schedule with no wind basis says so',
  /No wind basis was supplied/.test(renderFoundationTender(unconf)));

if (failures) {
  console.error(`${failures} tender check(s) failed`);
  process.exit(1);
}
console.log('tender battery clean (both bid documents)');
