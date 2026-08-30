// The customer-facing KIT SCHEDULE: what a given plan needs from the kit.
//
// This is a presentation layer over the bill of materials the buildability
// validator already derives from the plan's geometry. It sources nothing and
// computes nothing new — every quantity here is the validator's, re-labelled
// for someone who is buying rather than debugging.
//
// WHY IT IS CALLED A SCHEDULE AND NOT "WHAT'S INCLUDED".
//
// Kit-home sites publish a fixed "what's included" list — panels, house wrap,
// fasteners, instructions, tools. That list is a FULFILMENT PROMISE: it says
// those things arrive on a truck. We promise nothing of the sort. What we have
// is a schedule of parts this plan requires, derived from its geometry, and the
// distinction is the whole integrity of the document. So:
//
//   - `groups` are quantities this plan needs. Ours, computed, defensible.
//   - `notSupplied` names the things a kit list would normally include and this
//     schedule deliberately does not, so nobody reads an omission as an implied
//     inclusion.
//   - `omissions` are the validator's own statements about what its counts do
//     NOT cover, carried through verbatim at the same weight as the counts.
//
// The omissions are not a disclaimer to be set in small type at the bottom. A
// schedule that says what it cannot account for is worth more than one that
// quietly rounds those things away, and rendering them at equal weight is the
// point rather than a concession.
//
// NO PANEL COUNT. The obvious next number — "your house is N panels" — is
// absent on purpose, and now for a stronger reason than before. Panel
// subdivision is the MANUFACTURER'S decision: eco-panels cap at 4x16 and
// Insulspan reach 8x24, so the same wall is a different number of panels
// depending on who quotes it. A count here would be one supplier's answer
// printed as if it were the building's.
//
// The counts below are 4 ft modules, which is the grid the plan is designed to
// and the widest panel both cores are made in. How those modules are grouped
// into panels belongs in the tender, not here.

import { PANEL_MODULE_FT, CORE_THICKNESS_LADDER, CORE_MAX_PANEL_FT } from './sip.ts';

export interface KitScheduleLine {
  componentId: string;
  label: string;
  quantity: number;
  unit: string;
  category: string;
}

export interface KitScheduleGroup {
  title: string;
  /** What this group of parts does in the building, in one line. */
  role: string;
  lines: KitScheduleLine[];
  subtotal: number;
}

export interface KitSchedulePricing {
  /** The number the USER typed. Never sourced, never inferred, never averaged. */
  unitPrice: number;
  currency: string;
  unitLabel: string;
  lineTotals: Array<{ componentId: string; quantity: number; total: number }>;
  total: number;
  /** The sentence any surface rendering this MUST show beside the number. */
  basis: string;
}

export interface KitSchedule {
  planId: string;
  groups: KitScheduleGroup[];
  totalPieces: number;
  /** Verbatim from the validator: what these counts do not cover. */
  omissions: string[];
  /** Named so an absence is never read as an implied inclusion. */
  notSupplied: string[];
  /** The module these counts are expressed in, and why it is 4 ft. */
  panelBasis: { moduleFt: number; rationale: string };
  /** Thicknesses available per core, so a reader can see the spec is not
   * written to one supplier's product line. */
  thicknessOptionsIn: Record<string, readonly number[]>;
  /** Largest panel each core makes — the reason subdivision is not ours. */
  maxPanelFt: Record<string, { widthFt: number; lengthFt: number }>;
  pricing?: KitSchedulePricing;
}

/** Human labels for the validator's component ids. Anything unmapped falls back
 * to the id itself rather than being dropped — a part with no nice name is still
 * a part the builder needs, and silently omitting it would understate the kit. */
const LABELS: Record<string, { label: string; unit: string }> = {
  'wall-ext': { label: 'External wall block', unit: 'block' },
  'wall-ext-opening': { label: 'External wall block, openings', unit: 'block' },
  'wall-int': { label: 'Internal wall block', unit: 'block' },
  'wall-int-opening': { label: 'Internal wall block, openings', unit: 'block' },
  'floor-std': { label: 'Floor cassette', unit: 'cassette' },
  'floor-deck': { label: 'Deck cassette', unit: 'cassette' },
  'foundation': { label: 'Foundation sill module', unit: 'module' },
  'roof-gable': { label: 'Roof module, gable', unit: 'module' },
  'roof-flat': { label: 'Roof module, flat', unit: 'module' },
  'roof-shed': { label: 'Roof module, shed', unit: 'module' },
  'roof-hip': { label: 'Roof module, hip', unit: 'module' },
  'roof-gambrel': { label: 'Roof module, gambrel', unit: 'module' },
  'roof-barn': { label: 'Roof module, barn', unit: 'module' },
  'roof-a-frame': { label: 'Roof module, a-frame', unit: 'module' },
  'guard-rail': { label: 'Guard rail module', unit: 'module' },
  'door-ext': { label: 'External door', unit: 'opening' },
  'door-int': { label: 'Internal door', unit: 'opening' },
  'window-std': { label: 'Window', unit: 'opening' },
};

const GROUPS: Array<{ title: string; role: string; categories: string[] }> = [
  { title: 'Structure', role: 'Sill and floor decks the walls stand on.', categories: ['structural', 'floor'] },
  { title: 'Walls', role: 'External envelope and internal partitions, on the 4 ft grid.', categories: ['wall'] },
  { title: 'Roof', role: 'Roof modules along the ridge.', categories: ['roof'] },
  { title: 'Openings', role: 'Doors and windows the wall blocks are cut for.', categories: ['opening'] },
];

/** Things a conventional kit list carries that this schedule does NOT cover, so
 * their absence is stated rather than left to be assumed either way. */
const NOT_SUPPLIED = [
  'House wrap, membranes and tapes',
  'Fasteners, connectors and adhesives',
  'Assembly tools',
  'Insulation, services and internal finishes',
  'Windows and doors themselves — the schedule counts the openings, not the units',
];

export interface BomItemLike { componentId: string; quantity: number; category?: string }

export function buildKitSchedule(input: {
  planId?: string;
  bom: BomItemLike[];
  omissions?: string[];
  /** Supplied by the USER, per part. Omit for no pricing at all. */
  unitPrice?: number;
  currency?: string;
}): KitSchedule {
  const bom = input.bom ?? [];
  const groups: KitScheduleGroup[] = [];
  const claimed = new Set<string>();

  for (const spec of GROUPS) {
    const lines = bom
      .filter((item) => spec.categories.includes(String(item.category ?? '')))
      .map((item) => {
        claimed.add(item.componentId);
        const known = LABELS[item.componentId];
        return {
          componentId: item.componentId,
          label: known?.label ?? item.componentId,
          quantity: item.quantity,
          unit: known?.unit ?? 'piece',
          category: String(item.category ?? ''),
        };
      })
      .sort((a, b) => b.quantity - a.quantity);
    if (lines.length) {
      groups.push({ ...spec, lines, subtotal: lines.reduce((n, l) => n + l.quantity, 0) });
    }
  }

  // A BOM line in no known category would otherwise vanish from the schedule
  // while still being billed by the validator — the schedule would then
  // understate the kit. Collect the remainder rather than drop it.
  const rest = bom.filter((item) => !claimed.has(item.componentId));
  if (rest.length) {
    const lines = rest.map((item) => ({
      componentId: item.componentId,
      label: LABELS[item.componentId]?.label ?? item.componentId,
      quantity: item.quantity,
      unit: LABELS[item.componentId]?.unit ?? 'piece',
      category: String(item.category ?? 'uncategorised'),
    }));
    groups.push({
      title: 'Other parts',
      role: 'Billed by the validator but outside the standard groups.',
      lines,
      subtotal: lines.reduce((n, l) => n + l.quantity, 0),
    });
  }

  const totalPieces = groups.reduce((n, g) => n + g.subtotal, 0);

  const schedule: KitSchedule = {
    planId: input.planId ?? 'plan',
    groups,
    totalPieces,
    omissions: [...(input.omissions ?? [])],
    notSupplied: [...NOT_SUPPLIED],
    panelBasis: {
      moduleFt: PANEL_MODULE_FT,
      rationale: `Counts are ${PANEL_MODULE_FT} ft modules — the grid the plan is designed to, and `
        + 'the widest panel both core types are manufactured in. Grouping modules into panels is '
        + 'the manufacturer\'s job and differs between them.',
    },
    thicknessOptionsIn: { ...CORE_THICKNESS_LADDER },
    maxPanelFt: { ...CORE_MAX_PANEL_FT },
  };

  // PRICING IS ARITHMETIC ON THE USER'S OWN NUMBER, and only exists when they
  // give one. We hold no price data, so anything we generated would be invented;
  // multiplying a figure the user typed by a quantity we derived invents
  // nothing. It is never called an estimate, and `basis` travels with the number
  // so no surface can render the total without saying where it came from.
  if (typeof input.unitPrice === 'number' && Number.isFinite(input.unitPrice) && input.unitPrice > 0) {
    const lineTotals = groups.flatMap((g) => g.lines).map((l) => ({
      componentId: l.componentId,
      quantity: l.quantity,
      total: Math.round(l.quantity * input.unitPrice! * 100) / 100,
    }));
    schedule.pricing = {
      unitPrice: input.unitPrice,
      currency: input.currency ?? 'USD',
      unitLabel: 'per part',
      lineTotals,
      total: Math.round(lineTotals.reduce((n, l) => n + l.total, 0) * 100) / 100,
      basis: 'Your price per part multiplied by the quantities this plan needs. '
        + 'Not a quote or an estimate: it carries no supplier pricing, no regional '
        + 'adjustment and no date, and it excludes everything under Not covered.',
    };
  }

  return schedule;
}
