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
import { chooseMinimalMove, rectsOverlap, type RectFt } from './placement.ts';
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
  /** Why it moved — the plan says so in plain words, so neither is silent. */
  reason?: 'headroom' | 'clearance';
  /** Set when no position in the room works. */
  unplaceable?: string;
}

/**
 * Resolve one fixture against the envelope, keeping clear of everything already
 * placed: keep it where authored if the headroom is genuinely there, otherwise
 * slide it within its room to the NEAREST position that clears both the
 * headroom it needs and its neighbours, otherwise report honestly.
 *
 * `occupied` is what has already been placed. Without it each fixture resolves
 * to the same single optimum and the whole room piles up on one spot; see
 * placement.ts.
 */
export function resolveFixturePlacement(
  fixtureType: string,
  authored: FixtureBounds,
  room: PlacementRoomRect,
  planes: CeilingPlane[],
  occupied: RectFt[] = [],
): FixtureResolution {
  const need = requiredHeadroomFt(fixtureType);
  const clearsNeighbours = (rect: RectFt) => !occupied.some((other) => rectsOverlap(rect, other));
  const headroomShort = headroomOverFt(planes, authored) < need;
  if (!headroomShort && clearsNeighbours(authored)) return { bounds: authored, moved: false };
  const reason: 'headroom' | 'clearance' = headroomShort ? 'headroom' : 'clearance';

  // Slide inside the room only — a fixture never leaves the room it belongs to.
  const candidates: FixtureBounds[] = [];
  const maxX = room.x + room.w - authored.w;
  const maxZ = room.z + room.d - authored.d;
  for (let x = room.x; x <= maxX + 1e-9; x += 0.5) {
    for (let z = room.z; z <= maxZ + 1e-9; z += 0.5) {
      const candidate = { ...authored, x, z };
      if (headroomOverFt(planes, candidate) < need) continue;
      if (!clearsNeighbours(candidate)) continue;
      candidates.push(candidate);
    }
  }
  const best = chooseMinimalMove(candidates, (c) => c, authored);
  if (best) return { bounds: best, moved: true, reason };

  return {
    bounds: authored,
    moved: false,
    unplaceable: reason === 'headroom'
      ? `${fixtureType} in ${room.id} has no position with the ${need.toFixed(2)} ft of headroom it needs `
        + `(best available ${headroomOverFt(planes, authored).toFixed(2)} ft) — the roof leaves this room unusable for it`
      : `${fixtureType} in ${room.id} has no position clear of the other fixtures — the room is too small to hold them all`,
  };
}

export interface FixtureToPlace {
  id: string;
  type: string;
  roomId?: string;
  bounds?: FixtureBounds;
}

export interface SetResolution {
  bounds?: FixtureBounds;
  moved: boolean;
  reason?: 'headroom' | 'clearance';
  unplaceable?: string;
}

/**
 * Resolve a whole plan's fixtures AS A SET, so relocation can never stack two
 * of them.
 *
 * ORDER MATTERS, and the tightest fit chooses first — first-fit-decreasing. Let
 * a 4 ft table in a 12 ft room take its authored spot first and it can block the
 * 8 ft sofa group out of the only band that holds it, so the room reports
 * "unplaceable" though both plainly fit; sized the other way round, both land.
 * Each fixture then keeps its authored position unless the roof or an earlier
 * fixture has taken it, and otherwise shifts the shortest distance that clears
 * both.
 */
export function resolveFixtureSet(
  fixtures: FixtureToPlace[],
  roomById: Map<string, PlacementRoomRect>,
  planes: CeilingPlane[],
): Map<string, SetResolution> {
  const out = new Map<string, SetResolution>();
  const placed: RectFt[] = [];
  const queue: Array<{ fixture: FixtureToPlace; room: PlacementRoomRect; slots: number }> = [];

  for (const fixture of fixtures) {
    const room = fixture.roomId ? roomById.get(fixture.roomId) : undefined;
    if (!room || !fixture.bounds) { out.set(fixture.id, { moved: false }); continue; }
    // How much room the fixture has to move in — the sofa that only just fits
    // its room has far fewer choices than the side table beside it.
    const slots = Math.max(0, room.w - fixture.bounds.w) * Math.max(0, room.d - fixture.bounds.d);
    queue.push({ fixture, room, slots });
  }
  queue.sort((a, b) => a.slots - b.slots || (a.fixture.id < b.fixture.id ? -1 : a.fixture.id > b.fixture.id ? 1 : 0));

  for (const { fixture, room } of queue) {
    const resolved = resolveFixturePlacement(fixture.type, fixture.bounds as FixtureBounds, room, planes, placed);
    out.set(fixture.id, resolved);
    placed.push(resolved.bounds);
  }
  return out;
}
