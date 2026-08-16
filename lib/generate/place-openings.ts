/**
 * Envelope-aware opening placement.
 *
 * THE ARCHITECTURAL RULE: an opening may only exist where the envelope actually
 * leaves wall to put it in. Templates author a PREFERRED position; this module
 * resolves it against the real roof geometry and relocates or refuses.
 *
 * Why this exists: window spans used to be hardcoded literals in
 * mockIntentFromBrief, authored before the roof was even computed (the roof is
 * built later, in compileIntent). Nothing ever asked "is there wall here?", so
 * an a-frame put its bedroom EGRESS windows on the 2.13 ft eave wall — a legal
 * impossibility that R310 happily passed, because the engine checked presence
 * and operability but never whether the opening could physically exist.
 *
 * That is a class, not an edge case: any roof whose height varies across a
 * facade can strand a hardcoded opening. Fixing it per-roof-style would be the
 * Nth special case (principle 1). Instead, placement consults the SAME ceiling
 * planes the 3D clip, the elevations and the constraint engine use (principle 7),
 * so compliance, model and drawing cannot disagree about where a window fits.
 */

// Relative path WITH extension: the offline gate batteries load this through
// raw Node, which cannot resolve `@/` aliases or extensionless imports.
import { ceilingHeightAt, type CeilingPlane } from '../bim/envelope-clip.ts';

/** IRC R310.1 emergency escape and rescue opening minimums. */
export const EGRESS_MIN = {
  clearHeightFt: 24 / 12,
  clearWidthFt: 20 / 12,
  clearAreaSqFt: 5.7,
  maxSillFt: 44 / 12,
} as const;

/** Head clearance below the ceiling/roof line a window frame needs. */
const HEAD_CLEARANCE_FT = 0.3;
/** Sill height the templates use for a normal window. */
const DEFAULT_SILL_FT = 0.3;

export interface PlacementRoom {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface PlacementSpan { x1: number; z1: number; x2: number; z2: number }

/**
 * Vertical wall available at (x, z): the roof/ceiling height there. This is the
 * one shared envelope query — never re-derive roof math locally.
 */
export function availableWallHeightFt(planes: CeilingPlane[], x: number, z: number): number {
  if (!planes.length) return Infinity;
  const h = ceilingHeightAt(planes, x, z);
  return Number.isFinite(h) ? h : Infinity;
}

/** Does a span of the given width fit an egress opening along this wall? */
function egressFits(planes: CeilingPlane[], span: PlacementSpan): boolean {
  const widthFt = Math.hypot(span.x2 - span.x1, span.z2 - span.z1);
  if (widthFt < EGRESS_MIN.clearWidthFt) return false;
  // Sample across the opening; the LOWEST point governs (a sloped roof cuts the
  // head down over part of the span).
  let lowest = Infinity;
  for (let t = 0; t <= 1; t += 0.25) {
    const x = span.x1 + (span.x2 - span.x1) * t;
    const z = span.z1 + (span.z2 - span.z1) * t;
    lowest = Math.min(lowest, availableWallHeightFt(planes, x, z));
  }
  const head = lowest - HEAD_CLEARANCE_FT;
  const clearHeight = head - DEFAULT_SILL_FT;
  if (clearHeight < EGRESS_MIN.clearHeightFt) return false;
  if (DEFAULT_SILL_FT > EGRESS_MIN.maxSillFt) return false;
  return clearHeight * widthFt >= EGRESS_MIN.clearAreaSqFt;
}

/** The room's exterior-facing wall lines, as (fixed-axis) candidate edges. */
function exteriorEdges(room: PlacementRoom, widthFt: number, depthFt: number) {
  const EPS = 1e-6;
  const edges: Array<{ axis: 'x' | 'z'; at: number; from: number; to: number }> = [];
  if (Math.abs(room.x) < EPS) edges.push({ axis: 'x', at: 0, from: room.z, to: room.z + room.d });
  if (Math.abs(room.x + room.w - widthFt) < EPS) edges.push({ axis: 'x', at: widthFt, from: room.z, to: room.z + room.d });
  if (Math.abs(room.z) < EPS) edges.push({ axis: 'z', at: 0, from: room.x, to: room.x + room.w });
  if (Math.abs(room.z + room.d - depthFt) < EPS) edges.push({ axis: 'z', at: depthFt, from: room.x, to: room.x + room.w });
  return edges;
}

export interface EgressResolution {
  span: PlacementSpan | null;
  relocated: boolean;
  reason?: string;
}

/**
 * Resolve a sleeping room's egress opening against the envelope.
 *
 * Keeps the authored span when it genuinely works (stability — a plan should not
 * shuffle its windows for no reason), otherwise slides along the room's exterior
 * walls to the best position that satisfies R310, and reports failure honestly
 * when the envelope leaves nowhere legal.
 */
export function resolveEgressWindow(
  room: PlacementRoom,
  preferred: PlacementSpan,
  planes: CeilingPlane[],
  footprint: { widthFt: number; depthFt: number },
  openingWidthFt = 4,
): EgressResolution {
  if (egressFits(planes, preferred)) return { span: preferred, relocated: false };

  let best: { span: PlacementSpan; head: number } | null = null;
  for (const edge of exteriorEdges(room, footprint.widthFt, footprint.depthFt)) {
    const usable = edge.to - edge.from;
    if (usable < openingWidthFt) continue;
    // Slide the opening along the edge; keep the position with the most headroom.
    for (let start = edge.from; start + openingWidthFt <= edge.to + 1e-9; start += 0.5) {
      const span: PlacementSpan = edge.axis === 'x'
        ? { x1: edge.at, z1: start, x2: edge.at, z2: start + openingWidthFt }
        : { x1: start, z1: edge.at, x2: start + openingWidthFt, z2: edge.at };
      if (!egressFits(planes, span)) continue;
      const mid = { x: (span.x1 + span.x2) / 2, z: (span.z1 + span.z2) / 2 };
      const head = availableWallHeightFt(planes, mid.x, mid.z);
      if (!best || head > best.head) best = { span, head };
    }
  }

  if (best) return { span: best.span, relocated: true };
  return {
    span: null,
    relocated: false,
    reason: `sleeping room ${room.id} has no exterior wall tall enough for an IRC R310.1 egress opening `
      + `(needs ${EGRESS_MIN.clearHeightFt.toFixed(1)} ft clear height and ${EGRESS_MIN.clearAreaSqFt} sq ft `
      + `net clear); the roof leaves too little wall on every face of this room`,
  };
}
