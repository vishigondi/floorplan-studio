// Ad-hoc visual capture: plan sheet, elevations, and 3D for one plan.
// Usage: node scripts/qa-shots.mjs [planId] [baseUrl]
// Writes PNGs to .qa-shots/ (gitignored scratch — not a gate).

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const planId = process.argv[2] ?? 'loft-showcase';
const base = process.argv[3] ?? 'http://localhost:3000';
const outDir = join(root, '.qa-shots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });

await page.goto(`${base}/?home=${planId}`, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(2500);

async function shotFigure(label, file) {
  const fig = page.getByRole('figure', { name: label }).first();
  if (!(await fig.count())) { console.log(`  MISS  figure "${label}"`); return false; }
  await fig.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await fig.screenshot({ path: join(outDir, file) });
  console.log(`  ok    ${file}  <- figure "${label}"`);
  return true;
}

async function clickView(name) {
  const b = page.getByRole('button', { name, exact: true }).first();
  if (await b.count()) { await b.click(); await page.waitForTimeout(2000); return true; }
  console.log(`  MISS  view button "${name}"`);
  return false;
}

// 1. Plan Top -> the dimensioned deterministic sheet
await clickView('Plan Top');
await shotFigure('Deterministic Render', `${planId}-1-plan.png`);

// 2. Elevations (front + side), drawn from the same compiled geometry
await shotFigure('Elevations - Front + Side', `${planId}-2-elevations.png`);

// 3. BIM 3D -> the WebGL canvas
await clickView('BIM 3D');
const canvas = page.locator('canvas').first();
if (await canvas.count()) {
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  await canvas.screenshot({ path: join(outDir, `${planId}-3-bim3d.png`) });
  console.log(`  ok    ${planId}-3-bim3d.png  <- canvas`);
}

// 4. Front elevation view (the app's own elevation camera)
if (await clickView('Front')) {
  const c2 = page.locator('canvas').first();
  if (await c2.count()) {
    await c2.screenshot({ path: join(outDir, `${planId}-4-front-view.png`) });
    console.log(`  ok    ${planId}-4-front-view.png  <- canvas (Front)`);
  }
}

console.log(`  console errors: ${errors.length}${errors.length ? ' -> ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
