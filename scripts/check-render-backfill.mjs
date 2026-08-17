// Live gate for the DETACHED RENDER BACKFILL.
//
// POST /api/generate-plan writes the artifact and manifest entry, then spawns a
// detached child to capture the stored deterministic SVG. Neither the API
// response nor any offline battery can see whether that child succeeded:
// throwaway gen-* plans are deleted before the ladder runs, and the child's
// stdio used to go to /dev/null.
//
// It did not succeed. The route handed the renderer a `127.0.0.1` origin, which
// Next blocks for dev-origin data fetches, so the renderer loaded a page with
// zero plans and timed out. Meanwhile the manifest already advertised
// `deterministicRenderUrl`, so every generated plan served a permanent 404 into
// an <img> and into the brochure export, in total silence.
//
// Two invariants, both live:
//   1. the render actually lands, and
//   2. the manifest never claims it before the bytes exist.
//
// One plan, then deleted — the full sweep's generated lane covers the matrix,
// this stays fast enough to run on every live ladder.
//
// Usage: node scripts/check-render-backfill.mjs   (BACKFILL_URL=http://localhost:3000)

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOOP_ROOT = join(root, 'public/data/den-image-loop');
const MANIFEST = join(LOOP_ROOT, 'proposal-manifest.json');
const BASE = (process.env.BACKFILL_URL || process.env.SWEEP_BASE || 'http://localhost:3000').replace(/\/$/, '');

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
  }
}

const readManifest = () => JSON.parse(readFileSync(MANIFEST, 'utf8'));
const optionFor = (planId) => (readManifest().plans?.[planId] ?? [])[0];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let planId = null;
try {
  const res = await fetch(`${BASE}/api/generate-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief: '2 bed gable, 60x90 lot, 10 ft setbacks' }),
  });
  const body = await res.json().catch(() => ({}));
  planId = typeof body.planId === 'string' ? body.planId : null;
  check('the API generated a plan', Boolean(planId), `HTTP ${res.status} ${JSON.stringify(body).slice(0, 160)}`);

  if (planId) {
    // A claim written before the file is a promise the product cannot keep.
    check('manifest does not claim a stored render before it exists',
      !optionFor(planId)?.deterministicRenderUrl,
      `claimed ${optionFor(planId)?.deterministicRenderUrl} with no bytes yet`);

    let status = 0;
    let waited = 0;
    // /api/plan-file, the path the APP fetches — not the static `public/` URL.
    // Next enumerates `public/` at build time, so a plan written after the
    // build is unreachable there in production; polling the static path would
    // grade a surface the product no longer uses.
    const url = `${BASE}/api/plan-file/${planId}/paired/${planId}-proposal-paired-v1.render.svg`;
    for (let i = 0; i < 30; i += 1) {
      status = await fetch(url).then((r) => r.status).catch(() => 0);
      if (status === 200) break;
      await sleep(2000);
      waited += 2;
    }
    check(`the detached render backfill lands (${waited}s)`, status === 200, `HTTP ${status} at ${url}`);

    const claimed = optionFor(planId)?.deterministicRenderUrl;
    check('the manifest claims the render once the bytes exist', Boolean(claimed), `${claimed}`);
    if (claimed) {
      check('the claimed path is the file that was written',
        existsSync(join(LOOP_ROOT, planId, claimed)), claimed);
    }
  }
} finally {
  // Throwaway gen-* never survive a gate run (project guardrail). In `finally`
  // so a failure above still cleans up rather than leaving the store dirty.
  if (planId) {
    rmSync(join(LOOP_ROOT, planId), { recursive: true, force: true });
    const manifest = readManifest();
    if (manifest.plans?.[planId]) {
      delete manifest.plans[planId];
      writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    console.log(`  (cleaned up throwaway ${planId})`);
  }
}

console.log('');
if (failures) {
  console.error(`${failures} render-backfill check(s) failed`);
  process.exit(1);
}
console.log('render-backfill battery clean');
