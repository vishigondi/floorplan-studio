// Draws every site layout to one HTML sheet so the geometry can be LOOKED AT.
// Numeric gates pass happily on plans that are self-consistently wrong; three
// of the worst bugs in this repo were only ever caught by drawing them.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { LAYOUTS, unitCorners, towSweep, checkTowEgress, minGapFt, layoutTowsClear,
  glassPoint, glassFacing, viewCorridor, glassHasView, glassOpensOntoDeck,
  doorPoint, doorOpensOntoDeck, deckAreaSqFt } =
  await import(join(root, 'lib/kit/site-composition.ts'));

const pts = (a) => a.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

function draw(L) {
  const all = [
    ...L.units.flatMap(unitCorners),
    ...L.units.flatMap(towSweep),
    ...L.units.flatMap(viewCorridor),
    ...L.decks.flatMap((d) => d.outline),
  ];
  const pad = 8;
  const minX = Math.min(...all.map((p) => p.x)) - pad, maxX = Math.max(...all.map((p) => p.x)) + pad;
  const minY = Math.min(...all.map((p) => p.y)) - pad, maxY = Math.max(...all.map((p) => p.y)) + pad;
  const w = maxX - minX, h = maxY - minY;
  const verdicts = checkTowEgress(L);

  // +y is uphill; flip so uphill is up the page, the way a site plan reads.
  const body = [
    `<g transform="translate(0,${(minY + maxY).toFixed(2)}) scale(1,-1)">`,
    ...L.decks.map((d) =>
      `<polygon points="${pts(d.outline)}" fill="#C8A87C" fill-opacity=".55" stroke="#8A6D45" stroke-width=".5"/>`),
    // View corridor first so it sits under everything.
    ...L.units.map((u) => {
      const ok = glassHasView(u, L);
      return `<polygon points="${pts(viewCorridor(u))}" fill="${ok ? '#7FB0C8' : '#B03A22'}" fill-opacity=".14" stroke="${ok ? '#4A7F9B' : '#B03A22'}" stroke-width=".4"/>`;
    }),
    ...L.units.map((u, i) => {
      const c = unitCorners(u);
      const v = verdicts[i];
      const g = glassPoint(u), gf = glassFacing(u);
      const px = -gf.y * (u.widthFt / 2), py = gf.x * (u.widthFt / 2);
      const d = doorPoint(u);
      return `<polygon points="${pts(c)}" fill="#22282A" stroke="#000" stroke-width=".6"/>`
        + `<polygon points="${pts(towSweep(u))}" fill="${v.clear ? '#3E6B54' : '#B03A22'}" fill-opacity=".16" `
        + `stroke="${v.clear ? '#3E6B54' : '#B03A22'}" stroke-width=".5" stroke-dasharray="3 2"/>`
        + `<line x1="${(g.x + px).toFixed(2)}" y1="${(g.y + py).toFixed(2)}" x2="${(g.x - px).toFixed(2)}" y2="${(g.y - py).toFixed(2)}" stroke="${glassOpensOntoDeck(u, L) ? '#5FC8E8' : '#B03A22'}" stroke-width="2.6"/>`
        + `<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="1.6" fill="${doorOpensOntoDeck(u, L) ? '#E8A33D' : '#B03A22'}"/>`;
    }),
    '</g>',
    // Labels drawn unflipped so text is not mirrored.
    ...L.units.map((u, i) => {
      const y = (minY + maxY) - u.at.y;
      return `<text x="${u.at.x}" y="${y + 1.6}" fill="#EDEFEA" font-size="4.4" font-family="monospace" `
        + `text-anchor="middle">${u.id}${verdicts[i].clear ? '' : ' X'}</text>`;
    }),
  ].join('\n');

  const gap = (L.units.length > 1 ? `min gap ${minGapFt(L)} ft` : 'single unit') + ` &middot; ${deckAreaSqFt(L)} sq ft deck`;
  const viewBad = L.units.filter((u) => !glassHasView(u, L)).map((u) => u.id);
  const tow = layoutTowsClear(L) ? 'tow lanes clear' : `BLOCKED: ${verdicts.filter((v) => !v.clear).map((v) => `${v.unitId}<-${v.blockedBy.join('/')}`).join(', ')}`;
  return `<figure class="${L.rejected ? 'bad' : ''}">
  <svg viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}">${body}</svg>
  <figcaption><b>${L.title}</b><span>${L.unitCount} unit(s) &middot; ${gap}</span>
  <span class="${layoutTowsClear(L) ? 'ok' : 'no'}">${tow}</span>
  <span class="${viewBad.length ? 'no' : 'ok'}">${viewBad.length ? 'GLASS BLOCKED: ' + viewBad.join(',') : 'every glass wall has open ground'}</span></figcaption>
</figure>`;
}

const html = `<!doctype html><meta charset="utf-8"><style>
body{background:#EDEFEA;font:13px/1.45 -apple-system,system-ui,sans-serif;margin:0;padding:18px;color:#16181A}
h1{font-size:15px;margin:0 0 14px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
figure{margin:0;background:#F7F8F5;border:1px solid #CDD3CB;padding:10px}
figure.bad{border-color:#B03A22;border-width:2px}
svg{width:100%;height:290px;display:block;background:#E3E7DF}
figcaption{margin-top:8px;display:flex;flex-direction:column;gap:2px;font-size:11.5px}
figcaption span{color:#5A6163}
.ok{color:#2F6B4F!important;font-weight:600}
.no{color:#B03A22!important;font-weight:600}
</style><h1>Glass-wall layouts — dark = unit, tan = deck, cyan bar = glass wall, amber dot = door, blue = view corridor, dashed = tow sweep. Uphill is up.</h1>
<div class="grid">${LAYOUTS.map(draw).join('\n')}</div>`;

const out = process.argv[2] || join(root, 'site-layouts.html');
writeFileSync(out, html);
console.log(`wrote ${out}`);
for (const L of LAYOUTS) {
  const v = checkTowEgress(L);
  console.log(`${layoutTowsClear(L) ? 'CLEAR  ' : 'BLOCKED'} ${L.id.padEnd(20)} gap=${L.units.length > 1 ? minGapFt(L) : '-'} ${v.filter((x) => !x.clear).map((x) => `${x.unitId}<-${x.blockedBy}`).join(' ')}`);
}
