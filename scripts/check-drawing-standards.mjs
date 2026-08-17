// Battery for 2D drawing standards on the STORED renders.
//
// Every plan's stored deterministic SVG must carry the architect sheet
// elements: title block (with the plan id), north arrow, graphic scale bar,
// and chained band dimensions. Elevation honesty is asserted per plan: every
// opening the elevation model draws must correspond to a real artifact
// opening on that facade (no invented openings, anywhere).
//
// Usage: node scripts/check-drawing-standards.mjs (npm run check:drawing)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { buildElevationModel, facadeFor, drawnElevationViews } = await import(join(root, 'lib/elevations.ts'));

const PLANS = ['a-frame-bunk', 'a-frame-22', 'outpost-medium', 'gen-001', 'brief-aframe-2br'];
// Stored renders for traced plans are source-frame-aligned primitive-QA
// artifacts (the capture path strips overlays + dimensions by design); their
// sheet presentation is the LIVE render, asserted per plan by the sweep.
// JSON-only plans' stored render IS the sheet, so it must carry the elements.
const SHEET_PLANS = new Set(['gen-001', 'brief-aframe-2br']);

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
  }
}

const manifest = JSON.parse(readFileSync(join(root, 'public/data/den-image-loop/proposal-manifest.json'), 'utf8'));

for (const planId of PLANS) {
  console.log(`plan: ${planId}`);
  const option = (manifest.plans[planId] ?? []).find((item) => item.latestPairedArtifact);
  check('manifest has stored render url', Boolean(option?.deterministicRenderUrl));
  if (!option?.deterministicRenderUrl) continue;
  const svg = readFileSync(join(root, 'public/data/den-image-loop', planId, option.deterministicRenderUrl), 'utf8');
  if (SHEET_PLANS.has(planId)) {
    check('title block present', svg.includes('data-plan-title-block'));
    check('title block names the plan', svg.toUpperCase().includes(planId.toUpperCase()));
    check('north arrow present', svg.includes('data-north-arrow'));
    check('scale bar present', svg.includes('data-scale-bar'));
    check('band dimensions present', svg.includes('band-dimension'));
  } else {
    check('stored render is a primitive-QA artifact (source frames aligned)', svg.includes('source-floor-frame') || svg.includes('data-drawing-layer'));
  }

  const artifact = JSON.parse(readFileSync(join(root, 'public/data/den-image-loop', planId, option.pairedJsonUrl), 'utf8'));
  const input = { planId, footprint: artifact.footprint, roof: artifact.roof, windows: artifact.windows, doors: artifact.doors };
  // Grade EVERY facade this plan draws, not a fixed front/side pair — a rear or
  // right elevation the product ships but no gate reads is an ungraded drawing.
  // Facade geometry comes from lib/elevations (facadeFor), never a local copy.
  for (const side of drawnElevationViews(input.footprint, [...(artifact.doors ?? []), ...(artifact.windows ?? [])])) {
    const model = buildElevationModel(input, side);
    const tol = 1.6;
    const facade = facadeFor(side, input.footprint.widthFt, input.footprint.depthFt);
    const onFacade = (span) => {
      if (!span) return false;
      const [c1, c2] = facade.axis === 'z' ? [span.z1, span.z2] : [span.x1, span.x2];
      return Math.max(Math.abs(c1 - facade.atFt), Math.abs(c2 - facade.atFt)) < tol;
    };
    const centers = [...(artifact.doors ?? []), ...(artifact.windows ?? [])]
      .filter((o) => onFacade(o.span))
      .map((o) => {
        const [a, b] = facade.axis === 'z' ? [o.span.x1, o.span.x2] : [o.span.z1, o.span.z2];
        const along = (a + b) / 2;
        return facade.mirrored ? facade.spanFt - along : along;
      });
    const honest = model.openings.every((o) => centers.some((c) => Math.abs(c - o.center) <= 0.5));
    check(`${side} elevation openings all map to artifact openings (${model.openings.length})`, honest);
    check(`${side} elevation openings stay under the ridge`, model.openings.every((o) => o.headFt <= model.ridgeFt + 1e-6));
  }
}

console.log('');
if (failures) {
  console.error(`${failures} drawing-standards check(s) failed`);
  process.exit(1);
}
console.log('drawing-standards battery clean');
