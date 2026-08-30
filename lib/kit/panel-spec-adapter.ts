// Turns a compiled plan into the provider-neutral panel specification.
//
// This is the join that makes the chain work end to end: a one-line brief
// becomes a code-checked plan, and the plan becomes a document two panel
// manufacturers can quote against. Everything either side of it already existed
// and was gated; nothing connected them.
//
// TWO DECISIONS WORTH KNOWING ABOUT.
//
// A wall run is quoted to the TOP PLATE, not the ridge — a SIP wall panel stops
// at the plate and the gable triangle above is separate work. But that is only
// true of EAVE walls. A gable-end wall is triangular and rises to the ridge, and
// on an a-frame the eave is 1 ft, so there is no plate-height wall on that
// facade at all: the entire end is gable, and the front door sits in it.
//
// Quoting every wall at eave height therefore produced a 1 ft run containing a
// 6.8 ft door — geometry no manufacturer could cut. Walls now carry a profile:
//   'plate'     rectangular to the top plate; area is length x height.
//   'gable-end' triangular to the ridge; area is NOT length x height, and the
//               height reported is the apex, not a uniform panel height.
// The distinction is the difference between a quotable rectangle and a shape
// that needs its own take-off.
//
// Opening heads come from the ELEVATION MODEL, not from the plan. A plan span
// gives position and width but says nothing about sill or head height, and a
// panel manufacturer cutting a rough opening needs both. buildElevationModel
// already computes them, and is already gated to invent nothing — so this reuses
// that answer instead of deriving a second, unchecked one.

import { buildElevationModel, facadeFor, drawnElevationViews } from '../elevations.ts';
import type { WallRunSpec, RoofPlaneSpec } from './panel-spec.ts';

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
