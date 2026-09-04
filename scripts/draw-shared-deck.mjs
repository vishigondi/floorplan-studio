// Draws the plan of record with the ENTRY marked, and shows what changes when
// the door sits at the far end of the unit instead of near the deck.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = await import(join(root, 'lib/kit/shared-deck-plan.ts'));
const C = await import(join(root, 'lib/kit/site-composition.ts'));
const { SHARED_DECK, assessFit, preferredStance } = S;

const P = (a) => a.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const R = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

// Plan frame: deck along the bottom (downhill), units above it, path up the middle.
function scene(u) {
  const f = assessFit(u);
  const gap = SHARED_DECK.unitGapFt;
  const dw = SHARED_DECK.deckWidthFt, dd = SHARED_DECK.deckDepthFt;
  const deck = R(-dw / 2, -dd, dw / 2, 0);
  const parts = [];

  if (f.stance === 'gable-on') {
    const w = u.widthFt, l = u.lengthFt;
    // Two units, gable ends on the deck's back edge (y=0), path between.
    for (const s of [-1, 1]) {
      const cx = s * (gap / 2 + w / 2);
      parts.push({ t: 'unit', pts: R(cx - w / 2, 0, cx + w / 2, l) });
      // Glass is the gable meeting the deck.
      parts.push({ t: 'glass', pts: [{ x: cx - w / 2, y: 0 }, { x: cx + w / 2, y: 0 }] });
      // Door on the INNER wall (facing the path), at its fraction along the length.
      const dy = l * u.doorAtFractionFromGlass;
      const dx = cx - s * (w / 2);
      parts.push({ t: 'door', at: { x: dx, y: dy } });
      // The walk from deck to door, up the inner flank.
      if (f.needsFlankWalk) parts.push({ t: 'walk', pts: R(dx - s * 4, 0, dx, dy) });
    }
    parts.push({ t: 'path', pts: R(-gap / 2 + 2, 0, gap / 2 - 2, u.lengthFt + 14) });
  } else {
    // Broadside: the long glazed wall faces the deck. Two of these will not fit
    // the render's symmetry, so this draws ONE against the same deck.
    const w = u.widthFt, l = u.lengthFt;
    parts.push({ t: 'unit', pts: R(-l / 2, 0, l / 2, w) });
    parts.push({ t: 'glass', pts: [{ x: -l / 2, y: 0 }, { x: l / 2, y: 0 }] });
    parts.push({ t: 'door', at: { x: 0, y: 0 } });
    parts.push({ t: 'note', text: 'one unit only — two will not fit this deck broadside' });
  }
  return { f, deck, parts };
}

function draw(u) {
  const { f, deck, parts } = scene(u);
  const all = [...deck, ...parts.flatMap((p) => p.pts || (p.at ? [p.at] : []))];
  const pad = 8;
  const minX = Math.min(...all.map((p) => p.x)) - pad, maxX = Math.max(...all.map((p) => p.x)) + pad;
  const minY = Math.min(...all.map((p) => p.y)) - pad, maxY = Math.max(...all.map((p) => p.y)) + pad;
  const flip = (minY + maxY).toFixed(1);
  const g = [`<g transform="translate(0,${flip}) scale(1,-1)">`,
    `<polygon points="${P(deck)}" fill="#C9A97D" stroke="#8B6E46" stroke-width=".5"/>`];
  for (const p of parts) {
    if (p.t === 'path') g.push(`<polygon points="${P(p.pts)}" fill="#B9B3A6" fill-opacity=".85"/>`);
    if (p.t === 'walk') g.push(`<polygon points="${P(p.pts)}" fill="#C2701A" fill-opacity=".45" stroke="#C2701A" stroke-width=".4" stroke-dasharray="2 1.5"/>`);
  }
  for (const p of parts) {
    if (p.t === 'unit') g.push(`<polygon points="${P(p.pts)}" fill="#202628" stroke="#000" stroke-width=".5"/>`);
    if (p.t === 'glass') g.push(`<line x1="${p.pts[0].x}" y1="${p.pts[0].y}" x2="${p.pts[1].x}" y2="${p.pts[1].y}" stroke="#5EC7E7" stroke-width="1.8"/>`);
    if (p.t === 'door') g.push(`<circle cx="${p.at.x.toFixed(1)}" cy="${p.at.y.toFixed(1)}" r="1.7" fill="#E7A23C" stroke="#7a5410" stroke-width=".3"/>`);
  }
  g.push('</g>');
  const cls = f.verdict.startsWith('✅') ? 'ok' : f.verdict.startsWith('⚠️') ? 'warn' : 'bad';
  return `<figure class="${cls}">
  <svg viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}">${g.join('')}</svg>
  <figcaption><b>${u.maker} ${u.model}</b>
  <span>${u.widthFt} &times; ${u.lengthFt} ft &middot; ${u.glassWall} glazing &middot; ${f.stance}</span>
  <span class="${cls}">walk from deck to door: ${f.walkToDoorFt} ft</span>
  <span class="v">${f.verdict}</span></figcaption></figure>`;
}

const order = ['Cabana PMRV', 'A-Frame Classic', 'A-Frame Studio', 'Skyview 400', 'Extended Park Model RV', 'Luna'];
const units = order.map((m) => C.OBSERVED_UNITS.find((u) => u.model === m)).filter(Boolean);

const html = `<!doctype html><meta charset="utf-8"><style>
body{background:#EFEFEA;font:13px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:18px;color:#15181A}
h1{font-size:16px;margin:0 0 4px}p.k{margin:0 0 16px;color:#5A6163;font-size:12px;max-width:80ch}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
figure{margin:0;background:#F8F8F4;border:1px solid #CCD1CA;padding:10px}
figure.warn{border-color:#C2701A}figure.bad{border-color:#A03A1E;border-width:2px}
svg{width:100%;height:270px;display:block;background:#E4E5DE}
figcaption{margin-top:8px;display:flex;flex-direction:column;gap:2px;font-size:11.5px}
figcaption span{color:#5A6163}
.ok{color:#2F6B4F!important;font-weight:600}.warn{color:#9A5A14!important;font-weight:600}.bad{color:#A03A1E!important;font-weight:600}
.v{font-size:11px;line-height:1.35}
</style>
<h1>The plan of record — where the entry actually is</h1>
<p class="k">Deck (tan) at the bottom, downhill. Cyan = the glazed wall meeting the deck. Amber dot = the entry door. Grey = the stone path up the middle. <b>Dashed amber = the flank walkway you have to build when the door is at the far end of the unit.</b> The render assumes you step off the deck into the unit; on five of the eight units you do not.</p>
<div class="grid">${units.map(draw).join('')}</div>`;

writeFileSync(process.argv[2], html);
console.log('wrote', process.argv[2]);
for (const u of C.OBSERVED_UNITS) {
  const f = assessFit(u);
  console.log(`${f.needsFlankWalk ? 'FLANK ' : 'CLOSE '}${u.model.padEnd(24)} ${f.stance.padEnd(10)} ${String(f.walkToDoorFt).padStart(5)} ft`);
}
