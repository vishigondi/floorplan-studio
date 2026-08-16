/**
 * Envelope-aware fixture placement.
 *
 * Same architectural rule as place-openings: a fixture may only sit where the
 * envelope leaves usable headroom above it. Templates author a PREFERRED
 * position; this module resolves it against the real roof geometry.
 *
 * Without this, fixtures are placed in 2D plan coordinates with no knowledge of
 * the roof — so an a-frame, whose ceiling falls to ~2 ft at the eave, will put a
 * bed or a shower in space nobody can occupy. The drawing looks plausible and
 * every existing gate passes, because the fixture is inside its room and clear
 * of other fixtures; nothing ever asked how much air was above it.
 *
 * Thresholds come from the code, not taste:
 *   - 6 ft 8 in — IRC R305.1 minimum ceiling for bath/laundry: the height at
 *     which a person can stand at a fixture. Applied to anything used standing.
 *   - 5 ft — R305's cutoff below which floor area does not count as habitable.
 *     Applied to seated/lying fixtures: below this the space is not usable at all.
 */

import { availableWallHeightFt } from './place-openings.ts';
import type { CeilingPlane } from '../bim/envelope-clip.ts';

/** Used standing — needs the R305 bath-ceiling minimum overhead. */
const STANDING_FIXTURES = new Set([
  'counter_run', 'range', 'refrigerator', 'sink', 'toilet', 'vanity_sink', 'shower', 'loft_access_ladder',
]);

const STANDING_HEADROOM_FT = 6 + 8 / 12;
const OCCUPIED_HEADROOM_FT = 5;

export function requiredHeadroomFt(fixtureType: string): number {
  return STANDING_FIXTURES.has(fixtureType) ? STANDING_HEADROOM_FT : OCCUPIED_HEADROOM_FT;
}

export interface FixtureBounds { x: number; z: number; w: number; d: number }
export interface PlacementRoomRect { id: string; x: number; z: number; w: number; d: number }

/** Lowest ceiling anywhere over the fixture's footprint. */
export function headroomOverFt(planes: CeilingPlane[], b: FixtureBounds): number {
  if (!planes.length) return Infinity;
  let lowest = Infinity;
  for (let fx = 0; fx <= 1; fx += 0.5) {
    for (let fz = 0; fz <= 1; fz += 0.5) {
      lowest = Math.min(lowest, availableWallHeightFt(planes, b.x + b.w * fx, b.z + b.d * fz));
    }
  }
  return lowest;
}

export interface FixtureResolution {
  bounds: FixtureBounds;
  moved: boolean;
  /** Set when no position in the room has enough headroom. */
  unplaceable?: string;
}

/**
 * Resolve one fixture against the envelope: keep it where authored if the
 * headroom is genuinely there, otherwise slide it within its room to the position
 * with the most headroom that clears the requirement, otherwise report honestly.
 */
export function resolveFixturePlacement(
  fixtureType: string,
  authored: FixtureBounds,
  room: PlacementRoomRect,
  planes: CeilingPlane[],
): FixtureResolution {
  const need = requiredHeadroomFt(fixtureType);
  if (headroomOverFt(planes, authored) >= need) return { bounds: authored, moved: false };

  // Slide inside the room only — a fixture never leaves the room it belongs to.
  let best: { bounds: FixtureBounds; head: number } | null = null;
  const maxX = room.x + room.w - authored.w;
  const maxZ = room.z + room.d - authored.d;
  for (let x = room.x; x <= maxX + 1e-9; x += 0.5) {
    for (let z = room.z; z <= maxZ + 1e-9; z += 0.5) {
      const candidate = { ...authored, x, z };
      const head = headroomOverFt(planes, candidate);
      if (head < need) continue;
      if (!best || head > best.head) best = { bounds: candidate, head };
    }
  }
  if (best) return { bounds: best.bounds, moved: true };

  return {
    bounds: authored,
    moved: false,
    unplaceable: `${fixtureType} in ${room.id} has no position with the ${need.toFixed(2)} ft of headroom it needs `
      + `(best available ${headroomOverFt(planes, authored).toFixed(2)} ft) — the roof leaves this room unusable for it`,
  };
}
