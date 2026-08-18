// Battery for the PUBLIC-DEPLOYMENT LICENSING GATE (lib/licensing.ts).
//
// The reference set derives from Den Outdoors brochure floorplans, and their
// licence for public redistribution is not established. Keeping the research
// repo private does NOT settle that: a public deployment which SERVES those
// plans is redistributing them wherever the bytes are stored. Visibility and
// content licensing are separate boundaries; only the serving layer enforces
// the second.
//
// So this grades the decision function, in both directions. A gate that only
// ever proves "permissive default lets everything through" would pass while
// the public path leaked.
//
// Usage: node scripts/check-licensing.mjs (npm run check:licensing)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  filterManifestForDeployment,
  servablePlanIds,
  sourceKindIsPubliclyServable,
} = await import(join(root, 'lib/licensing.ts'));

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok   ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`); }
}

const manifest = JSON.parse(readFileSync(join(root, 'public/data/den-image-loop/proposal-manifest.json'), 'utf8'));

console.log('licensing: provenance decides what a public deployment may serve');
check('our own compiler output is servable', sourceKindIsPubliclyServable('constrained_json'));
check('Den-derived GPT proposals are NOT servable', !sourceKindIsPubliclyServable('gpt_proposal'));
// Unknown provenance is where guessing costs most, so it must fail closed.
check('unknown provenance fails closed', !sourceKindIsPubliclyServable(undefined) && !sourceKindIsPubliclyServable('') && !sourceKindIsPubliclyServable('something-new'));

console.log('\nlicensing: the fixture actually exercises both sides');
const kinds = new Set(Object.values(manifest.plans ?? {}).flat().map((o) => o?.sourceKind));
check('the store contains BOTH servable and non-servable provenance', kinds.has('constrained_json') && kinds.has('gpt_proposal'), [...kinds].join(', '));

console.log('\nlicensing: private deployment serves everything');
const allIds = servablePlanIds(manifest, false);
check('every plan is servable when not a public deployment', allIds.size === Object.keys(manifest.plans ?? {}).length, `${allIds.size}`);
check('the unfiltered manifest is passed through untouched', filterManifestForDeployment(manifest, false) === manifest);

console.log('\nlicensing: public deployment serves only cleared plans');
const publicIds = servablePlanIds(manifest, true);
check('public set is strictly smaller', publicIds.size > 0 && publicIds.size < allIds.size, `${publicIds.size} of ${allIds.size}`);
const denDerived = Object.entries(manifest.plans ?? {})
  .filter(([, opts]) => (opts ?? []).every((o) => o?.sourceKind !== 'constrained_json'))
  .map(([id]) => id);
check('no Den-derived plan is publicly servable', denDerived.every((id) => !publicIds.has(id)),
  denDerived.filter((id) => publicIds.has(id)).slice(0, 4).join(', '));

const filtered = filterManifestForDeployment(manifest, true);
const filteredKinds = new Set(Object.values(filtered.plans ?? {}).flat().map((o) => o?.sourceKind));
check('the published manifest contains no Den-derived option', !filteredKinds.has('gpt_proposal'), [...filteredKinds].join(', '));
// A listing that 404s still discloses the plan ids, so the two must agree.
check('published manifest and servable set agree',
  Object.keys(filtered.plans ?? {}).every((id) => publicIds.has(id))
  && publicIds.size === Object.keys(filtered.plans ?? {}).length);
check('the filtered manifest says its counts are filtered',
  filtered.summary?.publicDeploymentFiltered === true
  && filtered.summary?.planCount === Object.keys(filtered.plans ?? {}).length);

console.log('');
if (failures) { console.error(`${failures} licensing check(s) failed`); process.exit(1); }
console.log('licensing battery clean');
