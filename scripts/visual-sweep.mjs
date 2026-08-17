// Visual sweep: drive EVERY plan in the real browser, capture the plan sheet,
// the full elevation drawing set and the 3D, and assert on what actually
// rendered — not on what the compiler says it produced.
//
// This exists because three real defects (stacked fixtures, undrawn rear/right
// facades, a template authoring furniture on top of itself) all shipped past a
// green offline ladder. The batteries check the artifact; this checks the
// picture a customer sees.
//
// Usage:
//   node scripts/visual-sweep.mjs [--stored] [--generated] [--only id,id] [--limit N] [--base URL]
// Writes PNGs + sweep.json to .qa-shots/sweep/ (gitignored scratch).

import { chromium } from 'playwright';
import { assessSkylarkKitForPlan } from '../lib/kit/skylark.ts';
import { mkdirSync, writeFileSync, readFileSync, readdirSync as readdirSyncSafe, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

// The live-gate runner starts its own server on a free port and passes it in.
const base = value('base', process.env.SWEEP_BASE || 'http://localhost:3000');
const limit = Number(value('limit', '999'));
// --only names the plans explicitly, so neither discovery nor generation runs.
const onlyIds = value('only', '').split(',').map((part) => part.trim()).filter(Boolean);
const wantStored = !onlyIds.length && (flag('stored') || !flag('generated'));
const wantGenerated = !onlyIds.length && (flag('generated') || !flag('stored'));
const outDir = join(root, '.qa-shots', 'sweep');
mkdirSync(outDir, { recursive: true });

const FACADE_EPS = 0.35;

// Briefs that exercise the compiler's whole support matrix. Kept small and
// deliberate: one per roof style, plus the shapes that historically broke
// (loft, small lot, single bedroom, three bedrooms).
const BRIEFS = [
  '2 bed a-frame, 40x60 lot, 5 ft setbacks',
  '2 bed gable, 60x90 lot, 10 ft setbacks',
  '2 bed flat roof, 60x90 lot, 10 ft setbacks',
  '2 bed shed roof, 60x90 lot, 10 ft setbacks',
  '2 bed hip roof, 60x90 lot, 10 ft setbacks',
  '2 bed gambrel roof, 60x90 lot, 10 ft setbacks',
  '2 bed barn roof, 60x90 lot, 10 ft setbacks',
  '2 bed a-frame with loft, 40x60 lot, 5 ft setbacks',
  '2 bed gable with loft, 60x90 lot, 10 ft setbacks',
  '1-bed gable cabin, 30x50 lot, 5 ft setbacks',
  '3 bed a-frame, 80x100 lot, 10 ft setbacks',
  '3 bed 2 bath hip roof, 80x100 lot, 10 ft setbacks',
];

// `findings` is the ONLY record of failure — a second counter alongside it can
// disagree with the exit code, which is how a red gate reports green.
const findings = [];
function check(planId, label, ok, detail = '') {
  if (!ok) {
    findings.push({ planId, label, detail });
    console.error(`  FAIL [${planId}] ${label}${detail ? `: ${detail}` : ''}`);
  }
  return ok;
}

/** The plan's compiled artifact, read from the same file the app serves. */
function artifactFor(planId) {
  const dir = join(root, 'public', 'data', 'den-image-loop', planId, 'paired');
  if (!existsSync(dir)) return null;
  const file = readdirSyncSafe(dir).find((name) => name.endsWith('.paired.json'));
  if (!file) return null;
  try {
    return JSON.parse(readFileSync(join(dir, file), 'utf8'));
  } catch {
    return null;
  }
}

/** Which facade an opening sits on, by the same rule the drawing layer uses. */
function facadeOf(span, widthFt, depthFt) {
  const on = (c1, c2, at) => Math.abs(c1 - at) < FACADE_EPS && Math.abs(c2 - at) < FACADE_EPS;
  if (on(span.z1, span.z2, 0)) return 'front';
  if (on(span.z1, span.z2, depthFt)) return 'rear';
  if (on(span.x1, span.x2, 0)) return 'side';
  if (on(span.x1, span.x2, widthFt)) return 'right';
  return null;
}

async function sweepPlan(page, planId) {
  const errors = [];
  const onError = (msg) => { if (msg.type() === 'error') errors.push(msg.text().slice(0, 160)); };
  page.on('console', onError);
  // A console "404 (Not Found)" without the URL is not actionable. Record the
  // request that failed, not just that one did.
  const badRequests = [];
  const onResponse = (res) => {
    if (res.status() >= 400) badRequests.push(`${res.status()} ${res.url().replace(base, '')}`);
  };
  page.on('response', onResponse);

  const record = { planId, shots: [], views: [], openingsByView: {}, consoleErrors: [] };
  try {
    await page.goto(`${base}/?home=${planId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('load', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1800);

    // 1. The dimensioned plan sheet.
    const planTop = page.getByRole('button', { name: 'Plan Top', exact: true }).first();
    if (await planTop.count()) { await planTop.click(); await page.waitForTimeout(1200); }
    const planFig = page.getByRole('figure', { name: 'Deterministic Render' }).first();
    if (await planFig.count()) {
      await planFig.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await planFig.screenshot({ path: join(outDir, `${planId}--plan.png`) });
      record.shots.push('plan');
    }
    check(planId, 'plan sheet renders', await planFig.count() > 0);

    // 2. The FULL elevation drawing set (the container scrolls; expand it so
    //    every facade is captured, not just the two above the fold).
    const set = page.locator('[data-elevation-views]').first();
    if (await set.count()) {
      record.views = ((await set.getAttribute('data-elevation-views')) ?? '').split(',').filter(Boolean);
      const blocks = await page.locator('[data-elevation-openings]').evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute('data-elevation-openings'))));
      record.views.forEach((view, i) => { record.openingsByView[view] = blocks[i] ?? null; });
      check(planId, 'every declared elevation actually rendered', blocks.length === record.views.length, `${record.views.length} declared, ${blocks.length} rendered`);
      await set.evaluate((n) => { n.style.height = 'auto'; n.style.maxHeight = 'none'; n.style.overflow = 'visible'; });
      await page.waitForTimeout(500);
      await set.screenshot({ path: join(outDir, `${planId}--elevations.png`) });
      record.shots.push('elevations');
    } else {
      record.views = [];
      record.note = 'no semantic elevation set (traced plan shows its GPT proposal here)';
    }

    // 2b. STACKED LEVELS SHARE ONE FRAME. A loft drawn in its own frame, at its
    //     own offset, cannot be read against the rooms below it — and the
    //     "ground floor outline" ghost on the upper level then outlines the
    //     upper level itself, which is not context, it is a false statement.
    const levels = await page.locator('[data-role="floor-level"]').evaluateAll((nodes) => nodes.map((n) => ({
      floor: n.getAttribute('data-source-floor'),
      w: n.getAttribute('data-frame-width'),
      d: n.getAttribute('data-frame-depth'),
      x: n.getAttribute('data-frame-x'),
    })));
    // Compiled plans DERIVE their frame, so it must be the building's. Traced
    // plans carry an authored per-floor frame from the source drawing, and we
    // do not overrule the source (separate data lanes, neither faked).
    const lane = await page.locator('[data-plan-lane]').first().getAttribute('data-plan-lane').catch(() => null);
    record.lane = lane;
    const distinct = new Map();
    for (const level of levels) distinct.set(`${level.floor}`, level);
    if (distinct.size > 1 && lane === 'compiled') {
      const frames = [...distinct.values()];
      const base = frames[0];
      record.levels = frames;
      check(planId, 'stacked levels share one drawing frame',
        frames.every((f) => f.w === base.w && f.d === base.d && f.x === base.x),
        frames.map((f) => `L${f.floor} ${f.w}x${f.d}@${f.x}`).join('  '));
    }

    // 2c. THE OPEN-KIT VERDICT IS VISIBLE and matches the compiled artifact. The
    //     assessment was gated offline for a whole fire while showing nowhere,
    //     so the one question a WikiHouse customer has had no on-screen answer.
    const artifactForKit = artifactFor(planId);
    if (artifactForKit?.roof && artifactForKit.footprint) {
      const shown = await page.locator('[data-kit-status]').first().getAttribute('data-kit-status').catch(() => null);
      record.kitStatus = shown;
      const expected = assessSkylarkKitForPlan(artifactForKit).status;
      check(planId, 'open-kit verdict is shown', Boolean(shown), 'no [data-kit-status] on the page');
      check(planId, `open-kit verdict matches the artifact (${expected})`, shown === expected, `screen says ${shown}`);
    }

    // 2d. THE IFC EXPORT ROUTE. The writer is round-tripped offline by
    //     check:ifc, but the ROUTE is what a user clicks — and it broke on
    //     exactly this: Next bundled web-ifc and its WASM stopped resolving,
    //     returning a 500 that no offline battery could see.
    if (artifactForKit) {
      const res = await fetch(`${base}/api/export-ifc?planId=${encodeURIComponent(planId)}`).catch(() => null);
      const body = res && res.ok ? await res.text() : '';
      record.ifcBytes = body.length;
      check(planId, 'IFC export route responds 200', Boolean(res?.ok), `status ${res?.status ?? 'no response'}`);
      check(planId, 'IFC export is a STEP file with entities',
        body.startsWith('ISO-10303-21') && /#\d+=IFCWALL\(/.test(body),
        `${body.length} bytes`);
      check(planId, 'IFC export declares what it omits',
        Boolean(res?.headers.get('x-ifc-coverage')), 'no X-Ifc-Coverage header');
    }

    // 3. The 3D model.
    const bim = page.getByRole('button', { name: 'BIM 3D', exact: true }).first();
    if (await bim.count()) {
      await bim.click();
      await page.waitForTimeout(2200);
      const canvas = page.locator('canvas').first();
      if (await canvas.count()) {
        await canvas.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1200);
        await canvas.screenshot({ path: join(outDir, `${planId}--3d.png`) });
        record.shots.push('3d');
      }
      check(planId, '3D canvas present', await canvas.count() > 0);
    }

    // 4. THE ASSERTION THAT MATTERS: every exterior opening the artifact has is
    //    drawn on exactly one elevation, verified through the rendered DOM.
    const artifact = artifactFor(planId);
    if (artifact && record.views.length) {
      const widthFt = Number(artifact.footprint?.widthFt ?? 0);
      const depthFt = Number(artifact.footprint?.depthFt ?? 0);
      const exterior = [
        ...(artifact.doors ?? []).filter((d) => d.openingType === 'exteriorDoor'),
        ...(artifact.windows ?? []),
      ].filter((o) => o.span);
      const wanted = {};
      let homeless = 0;
      for (const opening of exterior) {
        const facade = facadeOf(opening.span, widthFt, depthFt);
        if (!facade) { homeless += 1; continue; }
        wanted[facade] = (wanted[facade] ?? 0) + 1;
      }
      check(planId, 'every exterior opening sits on a facade', homeless === 0, `${homeless} opening(s) on no facade`);
      for (const [facade, count] of Object.entries(wanted)) {
        check(planId, `facade "${facade}" is in the drawing set`, record.views.includes(facade), `drawn: ${record.views.join(', ')}`);
        if (!record.views.includes(facade)) continue;
        // Openings can be legitimately skipped when the roof leaves no viable
        // pane; they may never be silently ADDED.
        const drawn = record.openingsByView[facade] ?? 0;
        check(planId, `facade "${facade}" draws no invented openings`, drawn <= count, `artifact has ${count}, drawing shows ${drawn}`);
        if (drawn < count) {
          findings.push({ planId, label: `facade "${facade}" drew ${drawn} of ${count} openings`, detail: 'clamped under the roof line — verify visually', soft: true });
        }
      }
    }

    record.consoleErrors = errors;
    record.badRequests = [...new Set(badRequests)];
    check(planId, 'no failed requests', record.badRequests.length === 0, record.badRequests.slice(0, 3).join(' | '));
    const otherErrors = errors.filter((e) => !/Failed to load resource/.test(e));
    check(planId, 'no console errors', otherErrors.length === 0, otherErrors.slice(0, 2).join(' | '));
  } catch (error) {
    check(planId, 'sweep completed', false, String(error).slice(0, 180));
  } finally {
    page.off('console', onError);
    page.off('response', onResponse);
  }
  return record;
}

// ---------------------------------------------------------------------------

// A gate that dies on a stack trace when nothing is listening reads as a code
// failure. Say what is actually wrong.
try {
  const probe = await fetch(`${base}/`, { method: 'HEAD' });
  if (!probe.ok && probe.status >= 500) throw new Error(`server at ${base} returned ${probe.status}`);
} catch (error) {
  console.error(`[visual-sweep] no app reachable at ${base} — start one (\`npm run dev\`) or pass --base/SWEEP_BASE.`);
  console.error(`  ${String(error).split('\n')[0]}`);
  process.exit(2);
}

const generated = [];
if (wantGenerated) {
  console.log(`generating ${BRIEFS.length} plans through the real API`);
  for (const brief of BRIEFS) {
    const res = await fetch(`${base}/api/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief }),
    });
    const body = await res.json().catch(() => ({}));
    const id = typeof body.url === 'string' ? body.url.split('home=')[1] : null;
    if (id) { generated.push({ id, brief }); console.log(`  ${id.padEnd(10)} <- ${brief}`); }
    else console.log(`  REFUSED    <- ${brief}: ${body.error ?? res.status}`);
  }
}

const only = onlyIds;

console.log('launching browser...');
const browser = await chromium.launch();
console.log('browser up');
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });

// The plans the APP SERVES, read from the feed itself. Enumerating directories
// instead sweeps archived plans the app deliberately does not serve, then
// reports their absence as failures — measuring the wrong population.
const stored = wantStored && !only.length
  ? await (async () => {
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2200);
    const ids = await page.locator('[data-feed-plan-id]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-feed-plan-id')).filter(Boolean));
    return [...new Set(ids)].filter((id) => !generated.some((g) => g.id === id)).sort();
  })()
  : [];

const targets = (only.length ? only : [...generated.map((g) => g.id), ...stored]).slice(0, limit);
console.log(`\nsweeping ${targets.length} plans in a real browser\n`);
const records = [];
for (const [i, planId] of targets.entries()) {
  process.stdout.write(`  [${String(i + 1).padStart(2)}/${targets.length}] ${planId.padEnd(24)}`);
  const record = await sweepPlan(page, planId);
  const brief = generated.find((g) => g.id === planId)?.brief;
  if (brief) record.brief = brief;
  records.push(record);
  process.stdout.write(`${record.shots.join('+') || 'no shots'}  views=[${record.views.join(',')}]\n`);
}
await browser.close();

writeFileSync(join(outDir, 'sweep.json'), JSON.stringify({ records, findings, generated }, null, 2));
const hard = findings.filter((f) => !f.soft);
const soft = findings.filter((f) => f.soft);
console.log(`\n${records.length} plans swept -> ${outDir}`);
console.log(`${hard.length} failure(s), ${soft.length} thing(s) to eyeball`);
process.exit(hard.length ? 1 : 0);
