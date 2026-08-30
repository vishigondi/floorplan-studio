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

import { buildElevationModel, facadeFor, drawnElevationViews } from '../elevations.ts';
import type { ThermalEnvelopeTargets } from '../standards/code-advisory.ts';

export interface WallRunSpec {
  id: string;
  /** 'exterior' runs carry the thermal target; 'interior' do not. */
  kind: 'exterior' | 'interior';
  /** 'plate' is a rectangle to the top plate — area is length x height.
   * 'gable-end' is triangular to the ridge; heightFt is the APEX, so area is
   * not length x height and the bidder must take it off separately.
   * 'slope' is an eave-side facade on a plan whose eave is too low to be a wall
   * at all — an a-frame's 1 ft stub. Openings on it are cut into the ROOF
   * PLANE, not into a wall panel, and it must not be quoted as wall area. */
  profile: 'plate' | 'gable-end' | 'slope';
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

// Core data and the "who can meet this" helper live in ./sip.ts. This module
// previously carried its own CORE_R_PER_INCH and coresMeeting, which is exactly
// the kind of duplicate that drifts: two files disagreeing about a number a
// compliance decision rests on.
export { CORE_R_PER_INCH, coresMeeting } from './sip.ts';

// ---------------------------------------------------------------------------
// FROM A COMPILED PLAN TO THAT SPECIFICATION.
//
// Previously lib/kit/panel-spec-adapter.ts. Split into its own file when it was
// written, then merged back: a document type and the one function that builds it
// from an artifact are a single concern, and the split meant every reader had to
// open two files to see how a tender is produced.
//
// Opening heads come from the ELEVATION MODEL, not recomputed here. A plan span
// gives position and width but says nothing about head height, and
// buildElevationModel already answers that and is already gated to invent
// nothing — so this reuses that answer rather than deriving a second, unchecked
// one.


interface ArtifactLike {
  planId?: string;
  footprint: { widthFt: number; depthFt: number };
  roof: { style?: string; ridgeHeightFt: number; eaveHeightFt: number; ridgeAxis?: string; planes?: Array<{ id?: string; points?: Array<{ x: number; y: number; z: number }> }> };
  exteriorWalls?: Array<{ id: string; span?: { x1: number; z1: number; x2: number; z2: number } }>;
  interiorWalls?: Array<{ id: string; span?: { x1: number; z1: number; x2: number; z2: number } }>;
  doors?: Array<{ id: string; span?: { x1: number; z1: number; x2: number; z2: number } }>;
  windows?: Array<{ id: string; span?: { x1: number; z1: number; x2: number; z2: number } }>;
}

/** Below this, an eave-side facade is a stub rather than a wall: no standard
 * panel, and no room for a door head. Set at 4 ft because the shortest opening
 * head this generator produces sits well above it. */
const MIN_PLATE_WALL_FT = 4;

const lengthOf = (span?: { x1: number; z1: number; x2: number; z2: number }): number =>
  span ? Math.hypot(span.x2 - span.x1, span.z2 - span.z1) : 0;

/** Area of a planar quad from its corner points, by triangle split. */
function planeAreaSqFt(points: Array<{ x: number; y: number; z: number }>): number {
  if (points.length < 3) return 0;
  const cross = (a: typeof points[0], b: typeof points[0], c: typeof points[0]) => {
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    return 0.5 * Math.hypot(
      u.y * v.z - u.z * v.y,
      u.z * v.x - u.x * v.z,
      u.x * v.y - u.y * v.x,
    );
  };
  let total = 0;
  for (let i = 1; i < points.length - 1; i += 1) total += cross(points[0], points[i], points[i + 1]);
  return Math.round(total * 10) / 10;
}

/** Pitch of a plane from its own geometry — rise over run between its corners,
 * rather than read off the roof style, so a plane that disagrees with its label
 * reports what it actually is. */
function planePitchDeg(points: Array<{ x: number; y: number; z: number }>): number {
  if (points.length < 3) return 0;
  let best = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i];
      const b = points[j];
      const run = Math.hypot(b.x - a.x, b.z - a.z);
      const rise = Math.abs(b.y - a.y);
      if (run > 0.01 && rise > 0.01) best = Math.max(best, Math.atan2(rise, run) * 180 / Math.PI);
    }
  }
  return Math.round(best * 10) / 10;
}

export interface AdaptedGeometry {
  wallRuns: WallRunSpec[];
  roofPlanes: RoofPlaneSpec[];
  /** Stated rather than folded into a wall, because it is real work nobody quoted. */
  notes: string[];
}

export function adaptArtifactToPanelGeometry(artifact: ArtifactLike): AdaptedGeometry {
  const { widthFt, depthFt } = artifact.footprint;
  const eaveFt = artifact.roof.eaveHeightFt;
  const notes: string[] = [];

  // Openings, resolved per facade through the elevation model so heads and
  // sills come from the same computation the drawings use.
  const openingsByWall = new Map<string, WallRunSpec['openings']>();
  const allOpenings = [...(artifact.doors ?? []), ...(artifact.windows ?? [])];
  for (const side of drawnElevationViews(artifact.footprint, allOpenings)) {
    const model = buildElevationModel(artifact as never, side);
    const facade = facadeFor(side, widthFt, depthFt);
    const wall = (artifact.exteriorWalls ?? []).find((w) => {
      if (!w.span) return false;
      const [c1, c2] = facade.axis === 'z' ? [w.span.z1, w.span.z2] : [w.span.x1, w.span.x2];
      return Math.abs(c1 - facade.atFt) < 0.5 && Math.abs(c2 - facade.atFt) < 0.5;
    });
    if (!wall) continue;
    openingsByWall.set(wall.id, model.openings.map((o) => ({
      id: o.id,
      type: o.kind === 'door' ? 'door' as const : 'window' as const,
      // Offset from the run's start, in the facade's own direction.
      offsetFt: Math.round((o.center - o.widthFt / 2) * 100) / 100,
      widthFt: o.widthFt,
      headFt: o.headFt,
    })));
  }

  // Which facades are gable ends: the ones the ridge runs into. Ridge along z
  // means the z-facing walls (north/south) are the gable ends.
  const ridgeAlongZ = (artifact.roof.ridgeAxis ?? 'z') === 'z';
  const ridgeFt = artifact.roof.ridgeHeightFt;
  const isGableEnd = (span?: { x1: number; z1: number; x2: number; z2: number }) => {
    if (!span || ridgeFt <= eaveFt + 0.01) return false;
    const constantZ = Math.abs(span.z1 - span.z2) < 0.01;
    return ridgeAlongZ ? constantZ : !constantZ;
  };

  const wallRuns: WallRunSpec[] = [];
  for (const wall of artifact.exteriorWalls ?? []) {
    const lengthFt = Math.round(lengthOf(wall.span) * 100) / 100;
    if (lengthFt <= 0) continue;
    const gable = isGableEnd(wall.span);
    // An eave-side facade on a plan with almost no eave is not a wall. On an
    // a-frame it is a 1 ft stub where the roof meets the ground, and any opening
    // on that facade is cut into the ROOF PLANE. Quoting it as wall area would
    // sell panels for a wall that does not exist, and testing an opening head
    // against a 1 ft height would fail a window that is perfectly fine.
    const profile = gable ? 'gable-end' as const
      : eaveFt < MIN_PLATE_WALL_FT ? 'slope' as const
        : 'plate' as const;
    wallRuns.push({
      id: wall.id,
      kind: 'exterior',
      profile,
      lengthFt,
      // Gable ends report their apex because that is what contains their
      // openings; plate walls the plate, because that is the panel. A slope
      // reports the stub it actually is, and its openings belong to the roof.
      heightFt: gable ? ridgeFt : eaveFt,
      openings: openingsByWall.get(wall.id) ?? [],
    });
  }
  for (const wall of artifact.interiorWalls ?? []) {
    const lengthFt = Math.round(lengthOf(wall.span) * 100) / 100;
    if (lengthFt <= 0) continue;
    wallRuns.push({ id: wall.id, kind: 'interior', profile: 'plate', lengthFt, heightFt: eaveFt, openings: [] });
  }

  const roofPlanes: RoofPlaneSpec[] = (artifact.roof.planes ?? [])
    .filter((p) => (p.points?.length ?? 0) >= 3)
    .map((p, i) => ({
      id: p.id ?? `roof-plane-${i + 1}`,
      areaSqFt: planeAreaSqFt(p.points!),
      pitchDeg: planePitchDeg(p.points!),
    }));

  const gableEnds = wallRuns.filter((r) => r.profile === 'gable-end');
  if (gableEnds.length) {
    notes.push(
      `${gableEnds.map((r) => r.id).join(', ')} are GABLE ENDS: triangular, rising to the `
      + `${ridgeFt} ft ridge. Their reported height is the apex, so panel area is NOT length x `
      + 'height and needs its own take-off. Remaining walls are quoted to the '
      + `${eaveFt} ft plate, where a wall panel stops.`,
    );
  }
  const slopes = wallRuns.filter((r) => r.profile === 'slope');
  if (slopes.length) {
    const slopeOpenings = slopes.flatMap((r) => r.openings.map((o) => o.id));
    notes.push(
      `The ${eaveFt} ft eave means ${slopes.map((r) => r.id).join(', ')} are NOT walls — they are `
      + 'the stub where the roof meets the ground. Do not quote them as wall area.'
      + (slopeOpenings.length
        ? ` The openings on them (${slopeOpenings.join(', ')}) are cut into the ROOF PLANE, and `
          + 'belong in the roof take-off rather than a wall panel.'
        : ''),
    );
    notes.push(
      'This plan has effectively no plate-height wall: the envelope is roof planes plus gable '
      + 'ends. Quote it as a roof-and-gable assembly rather than as walls.',
    );
  }
  if (!roofPlanes.length) notes.push('No roof planes were present on the artifact; roof area is unquoted.');

  return { wallRuns, roofPlanes, notes };
}
