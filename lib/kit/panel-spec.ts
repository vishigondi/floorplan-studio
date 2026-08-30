// PROVIDER-NEUTRAL PANEL SPECIFICATION.
//
// The document a buyer sends to several panel manufacturers at once, so they
// quote the same building and the buyer can change supplier between builds — or
// midway through one — without redrawing anything.
//
// WHY THIS IS NOT A PANEL SCHEDULE.
//
// The obvious artifact is a list of panels: "panel W1, 8 ft x 4 ft, 6.5 in".
// That document locks the buyer to one manufacturer twice over. Subdividing
// walls into panels bakes in one supplier's maximum panel size — 4x16 for one
// maker, considerably larger for another — so a second supplier cannot quote it
// without re-drawing. And naming a thickness names a core: 6.5 in is R-25 in
// EPS and R-45 in polyurethane. Two numbers, and the competition is over.
//
// So this specifies WALL RUNS AND PERFORMANCE, and lets each manufacturer do
// their own panel layout in their own product. They produce shop drawings
// anyway; handing them runs instead of panels is less work for us and portable
// by construction. It is also how a performance specification differs from a
// proprietary one, which is the industry's own distinction rather than ours.
//
// WHAT MAKES SUPPLIER SWITCHING ACTUALLY WORK.
//
// Portability is necessary but not sufficient. If the spec fixes only R, each
// manufacturer meets it at a different thickness, and thickness is dimensional:
// it moves interior faces, rough openings and the foundation. A building half
// built in 4.5 in EPS cannot be finished in 3 in polyurethane.
//
// So a spec that must survive a mid-build switch has to fix the WALL THICKNESS
// as well, and state R as a minimum within it. Then every manufacturer who can
// reach the R inside that thickness is dimensionally interchangeable, and the
// ones who cannot are visibly excluded rather than quietly quoting a different
// building. `nominalThicknessIn` is that commitment; leaving it undefined means
// quotes stay comparable on price but are NOT interchangeable mid-build, and
// `switchable` says which of the two you have.

import type { ThermalEnvelopeTargets } from '../standards/code-advisory.ts';

export interface WallRunSpec {
  id: string;
  /** 'exterior' runs carry the thermal target; 'interior' do not. */
  kind: 'exterior' | 'interior';
  lengthFt: number;
  heightFt: number;
  /** Rough openings in this run, positioned from the run's start. */
  openings: Array<{ id: string; type: 'door' | 'window'; offsetFt: number; widthFt: number; headFt: number }>;
}

export interface RoofPlaneSpec {
  id: string;
  areaSqFt: number;
  pitchDeg: number;
}

export interface PanelSpec {
  planId: string;
  footprint: { widthFt: number; depthFt: number };
  wallRuns: WallRunSpec[];
  roofPlanes: RoofPlaneSpec[];
  /** Performance, not product. Absent when the jurisdiction's targets are not sourced. */
  thermal?: {
    climateZone: string;
    wallMinR: number;
    ceilingMinR: number;
    alternatives: { wall?: string; ceiling?: string };
    citation: string;
  };
  /** Fixed to keep suppliers dimensionally interchangeable. Undefined = not fixed. */
  nominalThicknessIn?: number;
  /** True only when a mid-build supplier change cannot move a dimension. */
  switchable: boolean;
  /** Why switchable is what it is, in words a buyer can act on. */
  switchableBasis: string;
  /** Stated so absence is never read as permission. */
  excludes: string[];
}

const EXCLUDES = [
  'Panel layout and subdivision — each manufacturer lays out to their own panel sizes',
  'Core material and spline type — the manufacturer chooses how to meet the stated R',
  'Structural calculations and stamping — the buyer procures these where the authority requires them',
  'Fasteners, sealants, tapes and connection hardware',
  'Windows and doors themselves — rough openings are specified, units are not',
];

export function buildPanelSpec(input: {
  planId?: string;
  footprint: { widthFt: number; depthFt: number };
  wallRuns: WallRunSpec[];
  roofPlanes: RoofPlaneSpec[];
  thermalEnvelope?: ThermalEnvelopeTargets;
  /** Fix this to make suppliers interchangeable mid-build. */
  nominalThicknessIn?: number;
}): PanelSpec {
  const thermal = input.thermalEnvelope
    ? {
      climateZone: input.thermalEnvelope.climateZone,
      wallMinR: input.thermalEnvelope.wallR,
      ceilingMinR: input.thermalEnvelope.ceilingR,
      alternatives: {
        wall: input.thermalEnvelope.wallAlternative,
        ceiling: input.thermalEnvelope.ceilingAlternative,
      },
      citation: input.thermalEnvelope.citation,
    }
    : undefined;

  // Switchable requires BOTH halves: a fixed dimension so nothing moves, and a
  // stated performance floor so "same thickness" does not silently mean "worse
  // wall". Either alone is a different, weaker promise.
  const fixed = typeof input.nominalThicknessIn === 'number' && input.nominalThicknessIn > 0;
  const switchable = fixed && Boolean(thermal);
  // Written against `thermal` directly rather than behind a non-null assertion.
  // The assertion was sound only because `switchable` happened to guard it, and
  // mutation testing showed what that coupling costs: loosening the switchable
  // rule turned a wrong ANSWER into a crash, which is a worse failure and one
  // that hid itself from a failure count.
  const switchableBasis = switchable && thermal
    ? `Wall thickness is fixed at ${input.nominalThicknessIn} in with a minimum of R-${thermal.wallMinR}. `
      + 'Any manufacturer who reaches that R within that thickness builds the same building, so a '
      + 'supplier can be changed between builds or partway through one without moving an interior '
      + 'face, a rough opening or the foundation. Manufacturers who cannot are excluded by the '
      + 'specification rather than by discovering it late.'
    : fixed
      ? 'Thickness is fixed but no performance floor is stated, so suppliers are dimensionally '
        + 'interchangeable while the wall they deliver may not be equivalent. Not switchable on '
        + 'performance grounds.'
      : 'Thickness is not fixed, so each manufacturer meets the R at their own thickness. Quotes '
        + 'stay comparable on price, but a mid-build supplier change would move interior faces, '
        + 'rough openings and the foundation. Comparable, not interchangeable.';

  return {
    planId: input.planId ?? 'plan',
    footprint: input.footprint,
    wallRuns: input.wallRuns,
    roofPlanes: input.roofPlanes,
    thermal,
    nominalThicknessIn: fixed ? input.nominalThicknessIn : undefined,
    switchable,
    switchableBasis,
    excludes: [...EXCLUDES],
  };
}

/** Cores a buyer might be quoted, for checking a fixed thickness is reachable.
 * Published R per inch: EPS from Mighty Small Homes' supplier disclosure,
 * polyurethane from eco-panels' product information. Both retrieved 2026-08-28. */
export const CORE_R_PER_INCH: Readonly<Record<string, number>> = {
  eps: 3.9,
  polyurethane: 7.0,
};

/** Which cores can reach `minR` inside `thicknessIn` — i.e. who can actually bid.
 * A thickness nobody can meet is a specification with one supplier and no
 * competition, which is the failure this whole document exists to avoid. */
export function coresMeeting(minR: number, thicknessIn: number): string[] {
  return Object.entries(CORE_R_PER_INCH)
    .filter(([, rPerIn]) => rPerIn * thicknessIn >= minR)
    .map(([core]) => core);
}
