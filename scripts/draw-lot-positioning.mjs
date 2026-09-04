// Draws the lot-level positioning so the NEC pedestal band can be SEEN against
// the deck. The first version of this module passed both door hands because the
// stand was sized to the lot rather than the pad — a drawing would have shown
// the band floating far outboard of anything.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const M = await import(join(root, 'lib/kit/lot-positioning.ts'));
const { unitFootprint, standFootprint, pedestalZone, sideDeck, viewDeck, assessLot, rearOfStandY } = M;

const pts = (a) => a.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

function draw(lot) {
  const v = assessLot(lot);
  const all = [...standFootprint(lot), ...pedestalZone(lot), ...sideDeck(lot), ...viewDeck(lot)];
  const pad = 5;
  const minX = Math.min(...all.map((p) => p.x)) - pad, maxX = Math.max(...all.map((p) => p.x)) + pad;
  const minY = Math.min(...all.map((p) => p.y)) - pad, maxY = Math.max(...all.map((p) => p.y)) + pad;
  const flip = (minY + maxY).toFixed(2);
  const body = `<g transform="translate(0,${flip}) scale(1,-1)">
    <polygon points="${pts(standFootprint(lot))}" fill="#D8D2C4" stroke="#9A907C" stroke-width=".5" stroke-dasharray="2 1.5"/>
    <polygon points="${pts(viewDeck(lot))}" fill="#C8A87C" fill-opacity=".8" stroke="#8A6D45" stroke-width=".5"/>
    <polygon points="${pts(sideDeck(lot))}" fill="${v.deckFoulsPedestal ? '#B03A22' : '#C8A87C'}" fill-opacity=".8" stroke="#8A6D45" stroke-width=".5"/>
    <polygon points="${pts(pedestalZone(lot))}" fill="#2E9DC4" fill-opacity=".45" stroke="#1B6E8C" stroke-width=".6"/>
    <polygon points="${pts(unitFootprint(lot))}" fill="#22282A" stroke="#000" stroke-width=".6"/>
  </g>`;
  const w = maxX - minX, h = maxY - minY;
  return `<figure class="${v.ok ? '' : 'bad'}">
  <svg viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}">${body}</svg>
  <figcaption><b>${lot.id}</b><span>door on the ${lot.doorSide} &middot; rear of stand y=${rearOfStandY(lot).toFixed(1)}</span>
  <span class="${v.ok ? 'ok' : 'no'}">${v.ok ? 'pedestal band clear' : 'DECK IS IN THE PEDESTAL BAND'}</span></figcaption>
</figure>`;
}

const U = { unitWidthFt: 13.5, unitLengthFt: 32, padMarginFt: 1, sideDeckDepthFt: 8, viewDeckDepthFt: 14 };
const lots = [
  { id: 'A-Frame Studio — door RIGHT', doorSide: 'right', ...U },
  { id: 'A-Frame Studio — door LEFT', doorSide: 'left', ...U },
  { id: 'Skyview 400 — door RIGHT', doorSide: 'right', unitWidthFt: 12.67, unitLengthFt: 33, padMarginFt: 1, sideDeckDepthFt: 8, viewDeckDepthFt: 11 },
  { id: 'ÖÖD Extended — door LEFT', doorSide: 'left', unitWidthFt: 11.16, unitLengthFt: 26.08, padMarginFt: 1, sideDeckDepthFt: 8, viewDeckDepthFt: 10 },
];

const html = `<!doctype html><meta charset="utf-8"><style>
body{background:#EDEFEA;font:13px/1.45 -apple-system,system-ui,sans-serif;margin:0;padding:18px;color:#16181A}
h1{font-size:15px;margin:0 0 4px} p.k{margin:0 0 14px;color:#5A6163;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
figure{margin:0;background:#F7F8F5;border:1px solid #CDD3CB;padding:10px}
figure.bad{border-color:#B03A22;border-width:2px}
svg{width:100%;height:300px;display:block;background:#E3E7DF}
figcaption{margin-top:8px;display:flex;flex-direction:column;gap:2px;font-size:11.5px}
figcaption span{color:#5A6163}
.ok{color:#2F6B4F!important;font-weight:600}.no{color:#B03A22!important;font-weight:600}
</style><h1>Lot positioning — the lane is at the TOP (hitch faces it); the glass gable is at the bottom</h1>
<p class="k">dark = unit &middot; dashed = stand (pad, unit + 1 ft all round) &middot; tan = deck &middot; blue = NEC 551.77 pedestal band (5–7 ft outboard of the stand's LEFT edge, rear of stand to 15 ft forward) &middot; red deck = fouling the band</p>
<div class="grid">${lots.map(draw).join('')}</div>`;

writeFileSync(process.argv[2], html);
console.log('wrote', process.argv[2]);
for (const l of lots) { const v = assessLot(l); console.log((v.ok ? 'OK   ' : 'FOUL ') + l.id); }
