/**
 * Shared placement rules for envelope-aware relocation.
 *
 * Both openings and fixtures resolve authored positions against the real roof.
 * Resolving each element ALONE is not enough: a single objective ("most
 * headroom") sends every element in a room to the same optimum, so relocation
 * silently stacks them on top of each other. Two rules fix that, and they are
 * shared so the two callers cannot drift apart (principle 7):
 *
 *   1. MINIMUM DISPLACEMENT, not maximum headroom. Among positions that clear
 *      the requirement, the closest to the authored one wins — the template's
 *      layout is design intent, and relocation should disturb it as little as
 *      the envelope allows.
 *   2. RESOLVE AS A SET. Each element must also clear the ones already placed,
 *      so a legal position never lands on an occupied one.
 */

/** Axis-aligned footprint in feet. */
export interface RectFt { x: number; z: number; w: number; d: number }

/**
 * Clearance between two placed elements, in feet. Matches the project-wide
 * fixture clearance: below this they are touching, not overlapping.
 */
export const PLACEMENT_CLEARANCE_FT = 0.06;

export function rectsOverlap(a: RectFt, b: RectFt, clearance = PLACEMENT_CLEARANCE_FT): boolean {
  const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const iz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
  return ix > clearance && iz > clearance;
}

/** Distance between two rectangles' centers — how far a relocation moved something. */
export function displacementFt(a: RectFt, b: RectFt): number {
  return Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.z + a.d / 2 - (b.z + b.d / 2));
}

/**
 * Pick the candidate closest to the authored position. Ties break on (x, z) so
 * the same intent always resolves identically — the pipeline is deterministic.
 */
export function chooseMinimalMove<T>(
  candidates: T[],
  rectOf: (candidate: T) => RectFt,
  authored: RectFt,
): T | null {
  let best: T | null = null;
  let bestKey: [number, number, number] | null = null;
  for (const candidate of candidates) {
    const rect = rectOf(candidate);
    const key: [number, number, number] = [displacementFt(rect, authored), rect.x, rect.z];
    if (!bestKey || key[0] < bestKey[0] - 1e-9
      || (Math.abs(key[0] - bestKey[0]) <= 1e-9 && (key[1] < bestKey[1] - 1e-9
        || (Math.abs(key[1] - bestKey[1]) <= 1e-9 && key[2] < bestKey[2] - 1e-9)))) {
      best = candidate;
      bestKey = key;
    }
  }
  return best;
}
