// Battery for lib/kit/pad-spec.ts — the pad assembled as one document.
//
// Its job is to be HONEST about completeness. A spec sheet that quietly marks
// its own gaps as done is worse than no spec sheet, so most of these checks
// guard the status flags and the to-close notes rather than the prose.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  PAD_ELEMENTS, elementsByStatus, openItems, padCompleteness, PAD_OUTLIVES_THE_UNIT,
} = await import(join(root, 'lib/kit/pad-spec.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}
const el = (frag) => PAD_ELEMENTS.find((e) => e.element.includes(frag));

console.log('the correction the spec exists to make: no piers under the unit');
// Conflating the two foundation systems produces the exact thing the maker
// forbids and the state refuses, so both must be present and separate.
check('the unit bears on stone and blocking, and the deck has its own piers',
  el('Pad —').status === 'specified'
  && /crushed stone/.test(el('Pad —').spec)
  && /own piers or helicals/.test(el('Deck foundation').spec));
check('and the deck element says it bears on nothing but the ground',
  /bearing on nothing but/.test(el('Deck foundation').spec)
  && /SEPARATE from the pad/.test(el('Deck foundation').element));
check('blocking never lets the unit rest ON its wheels',
  /never rest ON its wheels/.test(el('Blocking').spec));

console.log('completeness, counted from the elements rather than asserted');
const c = padCompleteness();
check('nine elements, five specified, three partial, one gap',
  c.total === 9 && c.specified === 5 && c.partial === 3 && c.gap === 1);
check('and the counts are derived, summing to the total',
  c.specified + c.partial + c.gap === c.total
  && c.specified === elementsByStatus('specified').length
  && c.gap === elementsByStatus('gap').length);
// Open items are exactly the things a contractor could not price.
check('open items are everything not fully specified',
  openItems().length === c.partial + c.gap
  && openItems().every((e) => e.status !== 'specified'));
check('and every open item carries a toClose note saying what would finish it',
  openItems().every((e) => typeof e.toClose === 'string' && e.toClose.length > 60));
check('while every specified element does NOT — so the two states stay distinct',
  elementsByStatus('specified').every((e) => e.toClose === undefined));

console.log('the one real hole, kept visible');
check('data to the lot is the only outright gap',
  el('DATA').status === 'gap'
  && elementsByStatus('gap').length === 1
  && /NOTHING SPECIFIED AT LOT LEVEL/.test(el('DATA').spec));
check('and it names what closing it needs, including the trench argument',
  /separate communications conduit/.test(el('DATA').toClose)
  && /before the B1 civil bid/.test(el('DATA').toClose)
  && /retrofitting a data path into a finished lot is a trench/.test(el('DATA').toClose));
check('anchoring is honest that it is a rule of thumb, not engineering',
  el('Anchoring').status === 'partial'
  && /rule of thumb, not engineering/.test(el('Anchoring').toClose)
  && /wind load/.test(el('Anchoring').toClose));
check('and the risers are honest that positional is not dimensioned',
  /tells a designer which END, not where/.test(el('Water and sewer').toClose));

console.log('the unit connects at 50 A, and the pedestal is lot equipment');
check('the unit ceiling and the lot capacity are kept apart',
  /50 A MAXIMUM by cord-and-plug/.test(el('Electrical pedestal — capacity').spec)
  && /The pedestal is lot equipment; the unit is not/.test(el('Electrical pedestal — capacity').spec));
check('the pedestal position carries the NEC band',
  /left/.test(el('Electrical pedestal — position').spec)
  && /5-7 ft/.test(el('Electrical pedestal — position').spec)
  && /15 ft forward/.test(el('Electrical pedestal — position').spec));
check('and water and sewer are quick-disconnect, never hard-piped',
  /Quick-disconnect only/.test(el('Water and sewer').spec)
  && /never hard-piped/.test(el('Water and sewer').spec));

console.log('the pad has to outlive the unit — which is what makes it an asset');
check('five properties recorded that let it',
  PAD_OUTLIVES_THE_UNIT.length === 5
  && PAD_OUTLIVES_THE_UNIT.some((p) => /a pull and never a trench/.test(p))
  && PAD_OUTLIVES_THE_UNIT.some((p) => /FINAL geometry from day one/.test(p)));
check('including the one that makes unit swaps possible at all',
  PAD_OUTLIVES_THE_UNIT.some((p) => /No foundation under the unit at all/.test(p)));
check('every element cites a source, or an em dash where there is none',
  PAD_ELEMENTS.every((e) => typeof e.source === 'string' && e.source.length > 0)
  && el('DATA').source === '—');

if (failures > 0) { console.error(`\npad-spec battery: ${failures} FAILURE(S)`); process.exit(1); }
console.log('\npad-spec battery clean');
