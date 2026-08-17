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
import { pairedArtifactToLocalHome } from '../lib/data.ts';
import { codeAdvisoryReportForHome } from '../lib/standards/floorplan-standards.ts';
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
// Assertions only print when they FAIL, so silence is ambiguous: it means either
// "everything passed" or "nothing ran". A check placed after `browser.close()`
// once produced a crash, zero FAIL lines, and a green read. Count executions so
// coverage is a number, not an inference.
const executed = new Map();
function check(planId, label, ok, detail = '') {
  executed.set(planId, (executed.get(planId) ?? 0) + 1);
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

    // 2e. PROGRAM RECONCILIATION REACHES THE VIEWER. Notes were computed at
    //     generation, returned in the API response, and dropped: the generate
    //     flow navigates straight to the plan, so a stored plan showed a brief
    //     asking for 4 baths beside two bathrooms with no explanation.
    if (artifactForKit) {
      const recorded = (artifactForKit.notes ?? []).filter((note) => /requested .* built/.test(note));
      const shown = await page.locator('[data-plan-notes]').count();
      check(planId, 'program-reconciliation notes are shown when recorded',
        recorded.length === 0 || shown > 0,
        `${recorded.length} recorded, ${shown} shown`);
      // Only read it if it is actually there: querying a missing locator burns a
      // 30 s timeout and reports a confusing second failure on top of the real one.
      if (recorded.length && shown > 0) {
        const text = await page.locator('[data-plan-notes]').first().innerText();
        check(planId, 'the shown note states the mismatch', /requested .* built/.test(text), text.slice(0, 80));
      }
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

  // The stored deterministic render is produced by a DETACHED child after the
  // API responds, so nothing above proves it ever arrives — and for a long
  // while it never did: the child was handed a 127.0.0.1 origin that Next
  // blocks for dev-origin data fetches, loaded a page with zero plans, and
  // timed out with its stdio pointed at /dev/null. Every generated plan served
  // a 404 into an <img> and into the brochure export, silently. The offline
  // batteries cannot see this (throwaway gen-* plans are deleted before the
  // ladder runs), so the assertion has to live here, against the real API.
  console.log('waiting for detached render backfill...');
  for (const plan of generated) {
    const url = `${base}/api/plan-file/${plan.id}/paired/${plan.id}-proposal-paired-v1.render.svg`;
    let status = 0;
    for (let i = 0; i < 30; i += 1) {
      status = await fetch(url).then((r) => r.status).catch(() => 0);
      if (status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    check(plan.id, 'detached render backfill lands', status === 200, `HTTP ${status} after 60s at ${url}`);
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
    // WAIT for the feed, do not guess at it. A fixed sleep on a cold dev server
    // finds zero cards, and the sweep then quietly covers only the plans it
    // generated itself while still reporting success — coverage shrinking in
    // silence is the failure mode this whole harness exists to prevent.
    await page.locator('[data-feed-plan-id]').first().waitFor({ state: 'attached', timeout: 60000 })
      .catch(() => {});
    const ids = await page.locator('[data-feed-plan-id]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-feed-plan-id')).filter(Boolean));
    const found = [...new Set(ids)].filter((id) => !generated.some((g) => g.id === id)).sort();
    if (!found.length) {
      console.error('[visual-sweep] the feed listed no stored plans — refusing to report a pass over a shrunken set.');
      // Two environment traps produce exactly this, and both cost real time:
      //  1. A DIFFERENT project's dev server holding this port (mine had been
      //     replaced on :3000 mid-sweep; its 401s looked like product failures).
      //  2. Reaching the server as 127.0.0.1 instead of localhost — Next 16
      //     blocks client data fetches from a dev origin outside
      //     `allowedDevOrigins`, so the page renders with ZERO plans and no
      //     failed request to show for it.
      console.error(`[visual-sweep] base was ${base}. Check that this port is THIS app`);
      console.error('[visual-sweep] and prefer http://localhost:<port> — Next 16 blocks dev-origin fetches from 127.0.0.1.');
      await browser.close();
      process.exit(2);
    }
    return found;
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
// ---------------------------------------------------------------------------
// THE CLIENT PACKET MUST READ LIKE A DELIVERABLE, NOT A DATA DUMP.
// Downloaded once, for one compiled plan: its BOM table must name components in
// words, not print internal ids under a "Component" heading with the category
// mislabelled as "Label".
if (!only.length) {
  // Pick a plan that HAS a failing rule where one exists. Downloading the packet
  // for a spotless plan makes the "failures reach the client" assertion vacuous —
  // it loops over an empty set and proves nothing, which is how a packet that
  // filtered out its fail rows first slipped past this gate.
  const packetPlan = (() => {
    for (const candidate of targets) {
      const artifact = artifactFor(candidate);
      if (!artifact) continue;
      try {
        const report = codeAdvisoryReportForHome(pairedArtifactToLocalHome(artifact));
        if (report.findings.some((finding) => finding.status === 'fail')) return candidate;
      } catch { /* fall through to the default */ }
    }
    return generated.find((entry) => entry.id)?.id ?? targets[0];
  })();
  try {
    await page.goto(`${base}/?home=${packetPlan}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    const exportBtn = page.getByRole('button', { name: /^Export$/ }).first();
    if (await exportBtn.count()) { await exportBtn.click(); await page.waitForTimeout(1000); }
    const trigger = page.locator('[data-export-client-packet]').first();
    if (await trigger.count()) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        trigger.click(),
      ]);
      const html = readFileSync(await download.path(), 'utf8');
      const headerRow = html.match(/<thead><tr>(.*?)<\/tr><\/thead>/)?.[1] ?? '';
      check(packetPlan, 'packet BOM table has no mislabelled "Label" column',
        !/>Label</.test(headerRow), headerRow.slice(0, 120));
      const firstCells = [...html.matchAll(/<tr><td>([^<]*)<\/td>/g)].map((m) => m[1]);
      const slugLike = firstCells.filter((cell) => /^[a-z0-9]+(-[a-z0-9]+)+$/.test(cell));
      check(packetPlan, 'packet BOM names components in words, not slugs',
        slugLike.length === 0, `slug-like first cells: ${slugLike.slice(0, 4).join(', ')}`);
      check(packetPlan, 'packet BOM has rows', firstCells.length > 0);

      // THE CODE REPORT A CLIENT READS MUST BE THE ENGINE'S, NOT A RE-DERIVATION.
      // A packet that quietly recomputes (or rounds, or filters) its pass/fail
      // counts would tell a client the plan is cleaner than the product believes.
      const artifact = artifactFor(packetPlan);
      if (artifact) {
        const engine = codeAdvisoryReportForHome(pairedArtifactToLocalHome(artifact));
        const printed = html.match(/Summary: (\d+) pass \/ (\d+) fail \/ (\d+) not evaluated/);
        check(packetPlan, 'packet prints a code-report summary', Boolean(printed));
        if (printed) {
          const [, pass, fail, notEvaluated] = printed.map(Number);
          check(packetPlan, `packet summary matches the engine (${engine.summary.pass}/${engine.summary.fail}/${engine.summary.notEvaluated})`,
            pass === engine.summary.pass && fail === engine.summary.fail && notEvaluated === engine.summary.notEvaluated,
            `packet says ${pass}/${fail}/${notEvaluated}`);
        }
        // A failing rule must reach the client, not be filtered out of the table.
        for (const finding of engine.findings.filter((entry) => entry.status === 'fail')) {
          check(packetPlan, `packet shows the ${finding.ruleId} failure`,
            html.includes(finding.ruleId), 'rule missing from the packet table');
        }
      }
    }
  } catch (error) {
    check(packetPlan, 'client packet downloads', false, String(error).split('\n')[0].slice(0, 90));
  }
}

// ---------------------------------------------------------------------------
// THE READINESS LANES MUST BE ABLE TO GO RED.
//
// The lanes aggregate both verdict systems into the promote/block decision, and
// aggregation is exactly where a blocker gets quietly downgraded on its way to
// the UI. Every plan we sweep is healthy, so a green run proves only that good
// plans look good. This deliberately breaks one and requires the design lane to
// turn `blocked` — then puts it back.
if (!only.length) {
  const probeId = generated[0]?.id ?? targets[0];
  const dir = join(root, 'public', 'data', 'den-image-loop', probeId, 'paired');
  const file = existsSync(dir) ? readdirSyncSafe(dir).find((name) => name.endsWith('.paired.json')) : null;
  if (file) {
    const path = join(dir, file);
    const original = readFileSync(path, 'utf8');
    try {
      const broken = JSON.parse(original);
      broken.exteriorWalls = [];
      broken.interiorWalls = [];
      writeFileSync(path, `${JSON.stringify(broken, null, 2)}\n`);
      await page.goto(`${base}/?home=${probeId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
      const reviewToggle = page.getByRole('button', { name: /review tools/i }).first();
      if (await reviewToggle.count()) { await reviewToggle.click(); await page.waitForTimeout(1200); }
      const statuses = await page.locator('[data-validation-lane]').evaluateAll((nodes) => nodes.map((node) => ({
        lane: node.getAttribute('data-validation-lane'),
        status: node.getAttribute('data-validation-status') ?? '',
      })));
      check(probeId, 'a plan with no wall graph turns the design lane red',
        statuses.some((entry) => entry.lane === 'design' && entry.status === 'blocked'),
        statuses.map((entry) => `${entry.lane}:${entry.status}`).join(' ') || 'no lane elements found');
    } finally {
      writeFileSync(path, original);
    }
  }
}

await browser.close();

writeFileSync(join(outDir, 'sweep.json'), JSON.stringify({ records, findings, generated }, null, 2));
// A swept plan that contributed no assertions was not checked, whatever the
// exit code says. Surface it as a failure rather than counting it as covered.
// Measured, not guessed: a compiled plan runs 18-19 assertions here and a traced
// plan 10 (it has no semantic elevation panel), while a plan whose page never
// loads reaches only 3. 8 separates those cleanly with margin either side.
const MIN_ASSERTIONS_PER_PLAN = 8;
for (const planId of targets) {
  const count = executed.get(planId) ?? 0;
  if (count < MIN_ASSERTIONS_PER_PLAN) {
    findings.push({
      planId,
      label: 'plan was swept but barely checked',
      detail: `${count} assertion(s) ran — expected at least ${MIN_ASSERTIONS_PER_PLAN}; the page probably never loaded`,
    });
    console.error(`  FAIL [${planId}] plan was swept but barely checked: ${count} assertion(s) ran`);
  }
}
const totalAssertions = [...executed.values()].reduce((sum, n) => sum + n, 0);
console.log(`\n${totalAssertions} assertion(s) executed across ${executed.size} plan(s)`);

const hard = findings.filter((f) => !f.soft);
const soft = findings.filter((f) => f.soft);
console.log(`\n${records.length} plans swept -> ${outDir}`);
console.log(`${hard.length} failure(s), ${soft.length} thing(s) to eyeball`);
process.exit(hard.length ? 1 : 0);
