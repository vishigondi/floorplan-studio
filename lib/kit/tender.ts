/**
 * The bid packages, as documents you can actually send.
 *
 * Everything upstream of this produces objects. An object cannot be emailed to
 * a panel plant or a pile crew, so the whole chain — geometry, performance
 * targets, take-offs, provider-neutrality — has until now stopped one step
 * short of the thing it was for.
 *
 * Two documents, because they go to two different trades who will never read
 * each other's scope. Both are Markdown: it reads as plain text in an email
 * body, prints, and pastes into a spreadsheet without a converter.
 *
 * THE DESIGN RULE HERE IS TRANSCRIPTION HONESTY. A renderer that silently drops
 * a wall run, or rounds a total differently from the take-off, produces bids for
 * a building nobody modelled — and it does it while looking completely correct.
 * So every figure printed is read from the source object, never recomputed, and
 * the batteries assert the document's own totals against it.
 */

import type { PanelSpec } from './panel-spec.ts';
import type { PileSchedule } from './foundation.ts';
import { isPanelised, WET_WALL_ID } from './unit-plan.ts';

/** What a bidder has to fill in for two quotes to be comparable. */
function bidForm(lines: string[]): string {
  return [
    '',
    '## Your quote',
    '',
    'Please price the lines below. Quoting in this format is what makes two bids',
    'comparable; a lump sum is not.',
    '',
    '| Line | Amount | Currency |',
    '|---|---|---|',
    ...lines.map((l) => `| ${l} |  |  |`),
    '| **Total delivered** |  |  |',
    '',
    'State your currency explicitly on every line. Bids are NOT converted or',
    'ranked across currencies — a quote in a currency we cannot compare is a quote',
    'we cannot use.',
    '',
    '| Question | Your answer |',
    '|---|---|',
    '| Lead time from order to delivery |  |',
    '| Quote valid until |  |',
    '| Anything in this scope you cannot supply |  |',
  ].join('\n');
}

function warningsBlock(title: string, warnings: string[]): string[] {
  if (!warnings.length) return [];
  return ['', `## ${title}`, '', ...warnings.map((w) => `- ${w}`)];
}

export interface TenderMeta {
  /** Where it ships to. Freight is a real part of delivered cost. */
  deliverTo?: string;
  /** Free text: who to reply to. Never invented. */
  contact?: string;
}

/**
 * The panel tender. Performance and geometry only — no core, no brand, no
 * spline — so any manufacturer who can meet the numbers can bid.
 */
export function renderPanelTender(
  spec: PanelSpec,
  meta: TenderMeta = {},
  /**
   * The geometry adapter's warnings. They live on its output rather than on the
   * spec, so they have to be passed in — and they are the part a bidder most
   * needs (which facades are not walls, which openings belong to the roof). A
   * battery asserts they reach the page, because a caller dropping them is
   * silent and the document still looks complete.
   */
  notes: string[] = [],
): string {
  const ext = spec.wallRuns.filter((r) => r.kind === 'exterior');
  // The wet wall is NOT in the panel package. A SIP has no cavity and is not cut
  // for a stack, so the one wall carrying the kitchen and the bath is
  // conventionally framed. Quoting it here would have a manufacturer price a
  // wall nobody can plumb, and the error surfaces on site with the plumber.
  const interior = spec.wallRuns.filter((r) => r.kind === 'interior' && isPanelised(r.id));
  const excluded = spec.wallRuns.filter((r) => r.kind === 'interior' && !isPanelised(r.id));
  const quotable = ext.filter((r) => r.profile !== 'slope');
  const wallArea = quotable.reduce((t, r) => t + r.grossAreaSqFt, 0);
  const openingArea = quotable.reduce((t, r) => t + r.openingAreaSqFt, 0);
  const roofArea = spec.roofPlanes.reduce((t, p) => t + p.areaSqFt, 0);
  const out: string[] = [];

  out.push(`# Structural insulated panel package — request for quotation`);
  out.push('');
  out.push(`Plan reference: **${spec.planId}**  `);
  out.push(`Footprint: **${spec.footprint.widthFt} x ${spec.footprint.depthFt} ft**`);
  if (meta.deliverTo) out.push(`Deliver to: **${meta.deliverTo}**`);
  if (meta.contact) out.push(`Reply to: ${meta.contact}`);
  out.push('');
  out.push('This document specifies **performance and geometry, not a product**. No core');
  out.push('type, panel brand or spline system is named anywhere in it. Quote whatever you');
  out.push('manufacture that meets the numbers below — overbuild is expected and fine, and');
  out.push('the prices decide it.');

  if (spec.thermal) {
    out.push('');
    out.push('## Thermal performance (the requirement)');
    out.push('');
    out.push('| Element | Minimum | Prescriptive alternative |');
    out.push('|---|---|---|');
    out.push(`| Wall | R-${spec.thermal.wallMinR} | ${spec.thermal.alternatives.wall ?? '—'} |`);
    out.push(`| Ceiling/roof | R-${spec.thermal.ceilingMinR} | ${spec.thermal.alternatives.ceiling ?? '—'} |`);
    out.push('');
    out.push(`Climate zone ${spec.thermal.climateZone}. Basis: ${spec.thermal.citation}`);
  }

  if (spec.nominalThicknessIn !== undefined) {
    out.push('');
    out.push(`**Nominal panel thickness is fixed at ${spec.nominalThicknessIn} in.** This is a`);
    out.push('dimensional requirement, not a performance one: interior faces, rough openings');
    out.push('and foundation setting-out are all built to it. Meeting the R-value at a');
    out.push('different thickness does not meet this specification.');
  }

  out.push('');
  out.push('## Wall panel schedule');
  out.push('');
  out.push('Gross area is the panel area to manufacture, with gable triangles already taken');
  out.push('off. Opening area is stated separately and is **not** deducted from gross — apply');
  out.push('your own deduction policy to the same quantity, so the quantity itself stays');
  out.push('identical between bidders.');
  out.push('');
  out.push('| Run | Profile | Length ft | Height ft | Gross sq ft | Openings sq ft |');
  out.push('|---|---|---|---|---|---|');
  for (const r of ext) {
    out.push(`| ${r.id} | ${r.profile} | ${r.lengthFt} | ${r.heightFt} | ${r.grossAreaSqFt} | ${r.openingAreaSqFt} |`);
  }
  out.push(`| **Exterior total (excl. slope)** |  |  |  | **${Math.round(wallArea * 100) / 100}** | **${Math.round(openingArea * 100) / 100}** |`);

  if (interior.length) {
    out.push('');
    out.push('### Interior partitions');
    out.push('');
    out.push('| Run | Length ft | Height ft | Gross sq ft |');
    out.push('|---|---|---|---|');
    for (const r of interior) out.push(`| ${r.id} | ${r.lengthFt} | ${r.heightFt} | ${r.grossAreaSqFt} |`);
  }

  const withOpenings = ext.filter((r) => r.openings.length);
  if (withOpenings.length) {
    out.push('');
    out.push('## Rough openings');
    out.push('');
    out.push('Offset is from the start of its run. **Sill and head are both given** because a');
    out.push('panel is cut from both edges — a head alone does not locate the opening.');
    out.push('');
    out.push('| Run | Opening | Type | Offset ft | Width ft | Sill ft | Head ft |');
    out.push('|---|---|---|---|---|---|---|');
    for (const r of withOpenings) {
      for (const o of r.openings) {
        out.push(`| ${r.id} | ${o.id} | ${o.type} | ${o.offsetFt} | ${o.widthFt} | ${o.sillFt} | ${o.headFt} |`);
      }
    }
  }

  if (spec.roofPlanes.length) {
    out.push('');
    out.push('## Roof panels');
    out.push('');
    out.push('| Plane | Area sq ft | Pitch deg |');
    out.push('|---|---|---|');
    for (const p of spec.roofPlanes) out.push(`| ${p.id} | ${p.areaSqFt} | ${p.pitchDeg} |`);
    out.push(`| **Total** | **${Math.round(roofArea * 100) / 100}** |  |`);
  }

  if (excluded.length) {
    out.push('');
    out.push('## Excluded from this package — do not quote');
    out.push('');
    out.push('| Run | Length ft | Height ft | Why |');
    out.push('|---|---|---|---|');
    for (const r of excluded) {
      out.push(`| ${r.id} | ${r.lengthFt} | ${r.heightFt} | Wet wall — carries the plumbing stack. `
        + 'Conventionally framed by others; a panel has no cavity for it |');
    }
    out.push('');
    out.push('**This is a scope boundary, not an omission.** It is stated so your quote and the');
    out.push('framer\'s do not overlap, and so nobody discovers on site that the only wall carrying');
    out.push('pipe was supplied as a solid panel.');
  }

  out.push(...warningsBlock('Read these before quoting', notes));
  out.push(bidForm([
    'Wall panels, delivered',
    'Roof panels, delivered',
    'Interior partition panels, delivered',
    'Splines, connectors and sealant',
    'Freight to site',
    'Installation labour (state hours and rate, or mark not offered)',
  ]));
  return out.join('\n');
}

/**
 * The foundation tender. Locations, capacities and a verification method — never
 * a depth and never a pile product, so any installer can bid it.
 */
export function renderFoundationTender(schedule: PileSchedule, meta: TenderMeta = {}): string {
  const out: string[] = [];
  const byKind = (k: string) => schedule.piles.filter((p) => p.kind === k).length;

  out.push('# Helical pile foundation — request for quotation');
  out.push('');
  out.push(`Plan reference: **${schedule.planId}**  `);
  out.push(`Pile count: **${schedule.piles.length}** (${byKind('corner')} corner, `
    + `${byKind('perimeter')} perimeter, ${byKind('interior')} interior)`);
  if (meta.deliverTo) out.push(`Site: **${meta.deliverTo}**`);
  if (meta.contact) out.push(`Reply to: ${meta.contact}`);
  out.push('');
  out.push('**This is a schematic take-off for bidding, not a foundation design.** Allowable');
  out.push('capacity depends on soil nobody has tested. A North Carolina PE must confirm pile');
  out.push('capacity, helix configuration and embedment before installation. It is issued so');
  out.push('two installers can price the same scope, line for line.');
  out.push('');
  out.push('**No pile product is specified and no depth is given.** Drive each pile to the');
  out.push('torque that develops its required capacity per your own published torque');
  out.push('correlation, and record the achieved torque per pile.');

  if (schedule.wind) {
    out.push('');
    out.push('## Site design basis');
    out.push('');
    out.push(`| Ultimate wind speed | ${schedule.wind.ultimateMph} mph |`);
    out.push('|---|---|');
    out.push(`| Seismic design category | ${schedule.wind.seismicDesignCategory} |`);
    out.push(`| Ground snow | ${schedule.loads.snow.psf} psf |`);
    out.push('');
    out.push(`Wind basis: ${schedule.wind.citation}`);
  }

  out.push('');
  out.push('## Pile schedule');
  out.push('');
  out.push(`Positions are in feet from the footprint origin. Bearing lines run at `
    + `${schedule.bearingLinesFt.join(', ')} ft; piles are at no more than `
    + `${schedule.spacingFt} ft centres along them.`);
  out.push('');
  out.push('| Pile | x ft | z ft | Type | Tributary sq ft | Compression lb | Hold-down lb |');
  out.push('|---|---|---|---|---|---|---|');
  for (const p of schedule.piles) {
    out.push(`| ${p.id} | ${p.xFt} | ${p.zFt} | ${p.kind} | ${p.tributarySqFt} | ${p.serviceLoadLb} | ${p.upliftResistanceLb} |`);
  }
  out.push('');
  out.push(`**Governing pile: ${schedule.maxServiceLoadLb} lb** service compression, unfactored.`);
  out.push(`**Least hold-down: ${schedule.minUpliftResistanceLb} lb** (0.6 x dead load).`);
  out.push('');
  out.push('Quote **tension capacity as well as compression**. A pile rated only for');
  out.push('compression is a different product — different helix configuration, often a');
  out.push('different shaft, and always a different cap.');

  out.push(...warningsBlock('Read these before quoting', schedule.notes));
  out.push(bidForm([
    'Piles, supplied and driven (state capacity offered, compression and tension)',
    'New-construction caps or brackets',
    'Mobilisation to site',
    'Torque logging and as-driven report',
    'Additional depth beyond the allowance, per ft (state the allowance)',
  ]));
  return out.join('\n');
}
