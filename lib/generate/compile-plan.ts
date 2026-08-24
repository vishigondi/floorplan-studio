// Compiles constrained generation intent into a full paired_gpt_floorplan_v1
// artifact. The LLM (or mock template) emits only high-level design intent —
// rooms, doors, windows, roof, lot — and this module deterministically derives
// walls, swing geometry, roof planes, elevations, floor panels, and dimension
// lines. The compiler, not the model, owns geometry: same intent in, same
// artifact out.
//
// Single-story V1. All coordinates in feet, rooms expected on the 4 ft grid.

// Coverage cap is owned by the constraint engine; the compiler imports it so a
// generated footprint is refused on the SAME threshold the report would fail
// (one source of truth — never two 0.35s that can drift apart).
import { DEFAULT_MAX_COVERAGE_RATIO } from '../standards/code-advisory.ts';
import { ceilingHeightAt as envelopeCeilingHeightAt, type CeilingPlane as EnvelopeCeilingPlane } from '../bim/envelope-clip.ts';
// Openings are RESOLVED against the envelope, never authored blind to it — the
// templates' spans are preferences, the roof decides what is physically possible.
import { resolveEgressWindow } from './place-openings.ts';
import { resolveFixtureSet } from './place-fixtures.ts';
import { ceilingPlanesFromRoofPoints } from '../bim/envelope-clip.ts';
// The kit is discrete: its pitches are measured from the real Skylark blocks,
// so a "buildable from the kit" request constrains geometry, not marketing.
import { assessSkylarkKit, SKYLARK_ROOF_PITCHES_DEG } from '../kit/skylark.ts';
import { ridgeHeightForPitchFt, roofPitchDeg } from '../roof-geometry.ts';

export interface IntentRoom {
  id: string;
  label: string;
  type: string;
  x: number;
  z: number;
  w: number;
  d: number;
  /** A labelled REGION of a larger open volume rather than an enclosed room --
   * Den's plans call out Entry, Kitchen, Dining and Living as four numbers
   * inside one wall-free space. Zones carry no wall against their neighbours
   * and are excluded from panel-grid compliance, which is measured on physical
   * boundaries. */
  semanticZone?: boolean;
}

export interface IntentSpan {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface IntentDoor {
  id: string;
  fromRoomId: string;
  toRoomId: string;
  openingType: 'exteriorDoor' | 'interiorDoor' | 'slidingDoor' | 'bifoldDoor';
  span: IntentSpan;
}

export interface IntentWindow {
  id: string;
  roomId: string;
  span: IntentSpan;
}

export interface IntentOpening {
  id: string;
  fromRoomId: string;
  toRoomId: string;
  span: IntentSpan;
}

export interface GenerationIntent {
  name: string;
  footprint: { widthFt: number; depthFt: number };
  roof: { style: 'a-frame' | 'gable' | 'flat' | 'shed' | 'hip' | 'gambrel' | 'barn'; ridgeAxis: 'x' | 'z'; ridgeHeightFt: number; eaveHeightFt: number };
  lot?: { widthFt: number; depthFt: number; setbacksFt?: { front?: number; rear?: number; left?: number; right?: number }; maxCoverageRatio?: number; maxHeightFt?: number } | null;
  /** Brief asked for a loft. A loft level is emitted only if the roof gives headroom. */
  hasLoft?: boolean;
  /** Bedrooms the brief asked for, BEFORE any template clamp — so the compiler can
   * refuse (rather than silently misrepresent) a program it can't build. */
  requestedBedrooms?: number;
  /** Baths the brief asked for, BEFORE any fit downgrade — so the compiler can
   * SURFACE (rather than silently drop) a 2nd bath that didn't fit the size/lot. */
  requestedBaths?: number;
  /** The ≤ sqft cap the brief asked for — so the compiler can refuse (rather than
   * silently exceed) a cap no template is small enough to meet. */
  requestedMaxSqft?: number;
  /** Brief asked for a home the open WikiHouse kit can actually build. */
  kitBuildable?: boolean;
  /** Storeys the brief asked for, RAW. The generator builds one storey plus an
   *  optional loft, so anything more must be refused rather than quietly
   *  delivered as a bungalow. */
  requestedLevels?: number;
  /** The roof style the brief asked for, BEFORE any flatten to a buildable
   * template — so the compiler can refuse (rather than silently substitute an
   * a-frame for) a style it does not implement. */
  requestedRoofStyle?: string;
  rooms: IntentRoom[];
  doors: IntentDoor[];
  windows: IntentWindow[];
  openings: IntentOpening[];
}

export interface CompileResult {
  ok: boolean;
  errors: string[];
  /** Non-fatal program reconciliations the user must be told about — e.g. a
   * requested 2nd bath that the fitting footprint couldn't host. Honest output:
   * an accommodation is surfaced here, never silently applied. */
  notes?: string[];
  artifact?: Record<string, unknown>;
}

const EPS = 1e-6;

/** The deterministic (no-API) generator hand-authors layouts for 1–3 bedrooms
 * only. A brief asking for more is refused at compile with a clear message
 * rather than silently collapsed to a 3-bedroom plan that misrepresents it. */
export const MAX_TEMPLATE_BEDROOMS = 4;

/** Baths the deterministic templates host (a 2nd bath needs a primary footprint).
 * Exported for the same reason as the bedroom ceiling: the UI's brief echo states
 * this cap to the user, and a hardcoded copy there silently drifts when it moves. */
export const MAX_TEMPLATE_BATHS = 2;

/** Roof styles the deterministic generator actually builds (geometry, planes,
 * elevations, and clipping all implemented). A brief requesting any other
 * recognized style is refused at compile rather than silently substituted with
 * an a-frame that misrepresents the massing. */
export const BUILDABLE_ROOF_STYLES = ['a-frame', 'gable', 'flat', 'shed', 'hip', 'gambrel', 'barn'] as const;

/** Interior ceiling height of a flat roof (constant, no slope). 8 ft clears
 * R305's 7 ft minimum AND is a manufacturable wall-height SKU (the same ~2.4 m
 * panel every other roof's eave uses) — a 9 ft wall is not a buildable SKU. */
const FLAT_ROOF_HEIGHT_FT = 8;

/** Shed (mono-pitch) roof: a single plane sloping from a high edge to a low
 * edge. Both heights clear R305's 7 ft minimum, so the whole floor is habitable
 * (no headroom-limited footprint needed). */
const SHED_RIDGE_FT = 12;
const SHED_EAVE_FT = 8;

/** Hip roof: four planes rising from an eave that runs around the WHOLE
 * perimeter (8 ft, so R305 passes everywhere) to a central ridge (a ridge line
 * on a rectangle, a single apex on a square -> a pyramid). */
const HIP_RIDGE_FT = 14;
const HIP_EAVE_FT = 8;

/** Gambrel roof: a two-pitch gable — a STEEP lower slope from the eave up to a
 * "knuckle", then a SHALLOW upper slope to the ridge (mirrored). Four planes (two
 * per side). Eave 8 ft so R305 passes; the steep lower slope maximizes headroom. */
const GAMBREL_EAVE_FT = 8;
const GAMBREL_KNUCKLE_FT = 14;
const GAMBREL_RIDGE_FT = 16;

/** Barn (gambrel hip): a gambrel hipped on all four sides — a steep lower hip
 * (eave perimeter → knuckle ring) stacked under a shallow upper hip (knuckle
 * ring → ridge). Eave 8 ft so R305 passes. Same heights as the gambrel. */
const BARN_EAVE_FT = 8;
const BARN_KNUCKLE_FT = 14;
const BARN_RIDGE_FT = 16;

function rectsOverlap(a: IntentRoom, b: IntentRoom): boolean {
  return a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.z < b.z + b.d - EPS && b.z < a.z + a.d - EPS;
}

function poly(x: number, z: number, w: number, d: number) {
  return [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];
}

const LOFT_BASE_FT = 8;          // loft floor height above the ground floor
const MIN_LOFT_HEADROOM_FT = 5;  // clearance needed before a band counts as a loft
const MIN_LOFT_SPAN_FT = 6;      // a central band narrower than this isn't usable

interface LoftBuild {
  bounds: { x: number; z: number; w: number; d: number };
  baseFt: number;
}

/**
 * A loft is compiler-derived, not authored: it occupies the central band where
 * the roof clears LOFT_BASE_FT + MIN_LOFT_HEADROOM_FT, computed from the same
 * ridge/eave geometry the roof planes use (one source of truth). Returns null
 * when the roof is too low to give honest headroom — the plan stays single
 * level rather than fake a loft under a roof that can't hold one.
 */
/**
 * Snap an interior passthrough onto the 4 ft panel module.
 *
 * Rooms are placed on the grid, so wall runs start and end on module — but the
 * openings punched through them were hand-placed (z 2 -> 10 on a 0 -> 12 wall),
 * which is 2 ft into the run and straddling the joints at 4 and 8. Every
 * passthrough the compiler emitted was off-module, so `check:buildable`'s
 * openings rule refused all of them the moment it was fed real segmented walls.
 *
 * Shrink INWARD (ceil the start, floor the end): that lands both edges on a
 * joint and never eats the corner return. If the result is narrower than one
 * panel the opening cannot be module-aligned where it sits, so fall back to a
 * single centred panel.
 */
function snapOpeningToModule(lo: number, hi: number): { lo: number; hi: number } {
  const start = Math.ceil(lo / 4) * 4;
  const end = Math.floor(hi / 4) * 4;
  if (end - start >= 4) return { lo: start, hi: end };
  const mid = Math.round(((lo + hi) / 2) / 4) * 4;
  return { lo: Math.max(0, mid - 2), hi: Math.max(4, mid + 2) };
}

function buildLoft(
  roof: { ridgeAxis: 'x' | 'z'; ridgeHeightFt: number; eaveHeightFt: number },
  widthFt: number,
  depthFt: number,
): LoftBuild | null {
  const ridge = roof.ridgeHeightFt;
  const eave = roof.eaveHeightFt;
  const target = LOFT_BASE_FT + MIN_LOFT_HEADROOM_FT;
  if (ridge < target + EPS || ridge <= eave + EPS) return null;
  const overhang = 1;
  const ridgeAlongZ = roof.ridgeAxis === 'z';
  const span = ridgeAlongZ ? widthFt : depthFt; // axis the slope varies along
  const mid = span / 2;
  // Ceiling at inboard distance c from the low edge:
  //   h(c) = eave + (ridge - eave) * (c + overhang) / (mid + overhang)
  // Solve h = target for the offset where usable headroom begins; round the
  // band inward (low up, high down) so the whole loft clears the target.
  const offset = ((target - eave) / (ridge - eave)) * (mid + overhang) - overhang;
  const rawLow = Math.max(0, Math.ceil(offset * 2) / 2);
  const rawBand = Math.min(span, span - rawLow) - rawLow;
  // Snap the loft band to a 4 ft panel multiple (round INWARD, so it stays within
  // the headroom envelope) and recenter — the loft's gable wall must be a
  // panel-buildable length, not the raw continuous headroom width.
  const band = Math.floor(rawBand / 4) * 4;
  if (band < MIN_LOFT_SPAN_FT) return null; // central band too narrow once snapped
  const low = rawLow + (rawBand - band) / 2;
  const high = low + band;
  // The loft runs the full depth in the headroom band so it reaches the gable
  // ends — that's where its window gets daylight at loft height. The long
  // sides of the band stay open to the floor below (mezzanine).
  const bounds = ridgeAlongZ
    ? { x: low, z: 0, w: high - low, d: depthFt }
    : { x: 0, z: low, w: widthFt, d: high - low };
  return { bounds, baseFt: LOFT_BASE_FT };
}

interface WallSegment {
  id: string;
  kind: 'solidExterior' | 'solidInterior';
  facing: string;
  span: IntentSpan;
}

/** Interior walls: maximal shared-edge segments between adjacent rooms. */
/** Rooms that are OUTDOOR platforms rather than enclosed space. They sit outside
 * the conditioned footprint, carry no interior walls, and are not habitable --
 * the habitable-room rules (R304/R305) must never be applied to them. */
function isUnconditioned(room: IntentRoom): boolean {
  return /^(deck|porch|patio|balcony|terrace)$/.test(String(room.type ?? ''));
}

function deriveInteriorWalls(rooms: IntentRoom[]): WallSegment[] {
  const walls: WallSegment[] = [];
  let counter = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const a = rooms[i];
      const b = rooms[j];
      // A deck abutting the facade shares an edge with the room behind it, but
      // that edge is the EXTERIOR wall -- which already exists. Deriving an
      // interior wall there would double the facade, put a stud wall across the
      // entry door, and bill the panel twice in the BOM.
      if (isUnconditioned(a) || isUnconditioned(b)) continue;
      // Two zones of the same open volume have no wall between them. That is
      // what makes the core open: the boundary is a label, not a partition.
      if (a.semanticZone && b.semanticZone) continue;
      // Vertical shared edge: a's right == b's left (or vice versa)
      for (const [left, right] of [[a, b], [b, a]] as const) {
        if (Math.abs(left.x + left.w - right.x) < EPS) {
          const z0 = Math.max(left.z, right.z);
          const z1 = Math.min(left.z + left.d, right.z + right.d);
          if (z1 - z0 > 0.5) {
            counter += 1;
            walls.push({ id: `iw-${counter}-${left.id}-${right.id}`, kind: 'solidInterior', facing: 'E', span: { x1: right.x, z1: z0, x2: right.x, z2: z1 } });
          }
        }
        if (Math.abs(left.z + left.d - right.z) < EPS) {
          const x0 = Math.max(left.x, right.x);
          const x1 = Math.min(left.x + left.w, right.x + right.w);
          if (x1 - x0 > 0.5) {
            counter += 1;
            walls.push({ id: `iw-${counter}-${left.id}-${right.id}`, kind: 'solidInterior', facing: 'S', span: { x1: x0, z1: right.z, x2: x1, z2: right.z } });
          }
        }
      }
    }
  }
  // De-duplicate identical segments (a-b and b-a directions)
  const seen = new Set<string>();
  return walls.filter((wall) => {
    const key = [wall.span.x1, wall.span.z1, wall.span.x2, wall.span.z2].map((v) => v.toFixed(2)).join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function spanOnWall(span: IntentSpan, wall: WallSegment): boolean {
  const vertical = Math.abs(wall.span.x1 - wall.span.x2) < EPS;
  if (vertical) {
    return Math.abs(span.x1 - wall.span.x1) < 0.26 && Math.abs(span.x2 - wall.span.x1) < 0.26
      && Math.min(span.z1, span.z2) >= Math.min(wall.span.z1, wall.span.z2) - 0.26
      && Math.max(span.z1, span.z2) <= Math.max(wall.span.z1, wall.span.z2) + 0.26;
  }
  return Math.abs(span.z1 - wall.span.z1) < 0.26 && Math.abs(span.z2 - wall.span.z1) < 0.26
    && Math.min(span.x1, span.x2) >= Math.min(wall.span.x1, wall.span.x2) - 0.26
    && Math.max(span.x1, span.x2) <= Math.max(wall.span.x1, wall.span.x2) + 0.26;
}

interface StarterFixture {
  id: string;
  roomId: string;
  type: string;
  floor: number;
  bounds: { x: number; z: number; w: number; d: number };
  clearance: { frontFt: number; doorSwingClear: boolean; note: string };
  sourceAnchorId: string;
  wallAnchor?: { wallId?: string; side: string; span: [number, number] };
}

/**
 * Deterministic starter furnishing per room type, using only component
 * registry ids already proven in shipped plans. Placement is recipe-based
 * (beds on the far edge, wet fixtures on the near edge, kitchen run on the
 * perimeter side) so the same intent always furnishes identically.
 */
function starterFixtures(intent: GenerationIntent, walls: WallSegment[], ceiling: EnvelopeCeilingPlane[] = []): StarterFixture[] {
  const { widthFt } = intent.footprint;
  const fixtures: StarterFixture[] = [];
  const nearestWall = (px: number, pz: number): WallSegment | undefined => {
    let best: WallSegment | undefined;
    let bestDist = Infinity;
    for (const wall of walls) {
      const vertical = Math.abs(wall.span.x1 - wall.span.x2) < EPS;
      const dist = vertical
        ? Math.abs(px - wall.span.x1) + (pz < Math.min(wall.span.z1, wall.span.z2) || pz > Math.max(wall.span.z1, wall.span.z2) ? 100 : 0)
        : Math.abs(pz - wall.span.z1) + (px < Math.min(wall.span.x1, wall.span.x2) || px > Math.max(wall.span.x1, wall.span.x2) ? 100 : 0);
      if (dist < bestDist) {
        bestDist = dist;
        best = wall;
      }
    }
    return bestDist < 1.5 ? best : undefined;
  };
  const anchor = (px: number, pz: number, fixtureCenter: { x: number; z: number }, span: [number, number]) => {
    const wall = nearestWall(px, pz);
    if (!wall) return undefined;
    const vertical = Math.abs(wall.span.x1 - wall.span.x2) < EPS;
    const side = vertical
      ? (fixtureCenter.x >= wall.span.x1 ? 'E' : 'W')
      : (fixtureCenter.z >= wall.span.z1 ? 'S' : 'N');
    return { wallId: wall.id, side, span };
  };
  const add = (
    id: string,
    roomId: string,
    type: string,
    x: number,
    z: number,
    w: number,
    d: number,
    note: string,
    wallPoint?: { x: number; z: number },
  ) => {
    const fixture: StarterFixture = {
      id,
      roomId,
      type,
      floor: 0,
      bounds: { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, w, d },
      clearance: { frontFt: 2, doorSwingClear: true, note },
      sourceAnchorId: id,
    };
    if (wallPoint) {
      const center = { x: x + w / 2, z: z + d / 2 };
      const span: [number, number] = Math.abs(wallPoint.x - center.x) < Math.abs(wallPoint.z - center.z)
        ? [z, z + d]
        : [x, x + w];
      fixture.wallAnchor = anchor(wallPoint.x, wallPoint.z, center, span);
      if (!fixture.wallAnchor) delete fixture.wallAnchor;
    }
    fixtures.push(fixture);
  };

  for (const room of intent.rooms) {
    const text = `${room.type} ${room.label}`.toLowerCase();
    const cx = room.x + room.w / 2;
    const slug = room.id.replace(/^room-/, '');
    if (/bed/.test(text) && !/bath/.test(text)) {
      if (room.w >= 7 && room.d >= 8) {
        // Centring the bed on the room is wrong where the room crosses a slope:
        // on a 36 ft a-frame Bedroom 3 runs x 28-36 and clears the 5 ft a bed
        // needs only to about x 32, so a centred bed stood half under the eave.
        // Slide it into the middle of the widest stretch that DOES clear.
        const BED_W = 5;
        const bedMid = (() => {
          if (!ceiling.length) return cx;
          const zMid = room.z + room.d - 3.25;
          let best = { lo: room.x, hi: room.x };
          let runStart: number | null = null;
          for (let x = room.x; x <= room.x + room.w + 1e-6; x += 0.5) {
            const ok = envelopeCeilingHeightAt(ceiling, x, zMid) >= 5;
            if (ok && runStart === null) runStart = x;
            if ((!ok || x + 0.5 > room.x + room.w) && runStart !== null) {
              const end = ok ? x : x - 0.5;
              if (end - runStart > best.hi - best.lo) best = { lo: runStart, hi: end };
              runStart = null;
            }
          }
          if (best.hi - best.lo < BED_W) return cx;
          return Math.min(Math.max((best.lo + best.hi) / 2, best.lo + BED_W / 2), best.hi - BED_W / 2);
        })();
        add(`fx-${slug}-bed`, room.id, 'queen_bed', bedMid - BED_W / 2, room.z + room.d - 6.5, BED_W, 6.5, 'foot and sides clear', { x: bedMid, z: room.z + room.d });
        // Wardrobe needs ~2 ft beyond the bed's 6.5 ft; skip in shallow rooms.
        if (room.w >= 9 && room.d >= 9) {
          add(`fx-${slug}-wardrobe`, room.id, 'closet_wardrobe', room.x + 1, room.z + 0.3, Math.min(4.5, room.w - 2), 1.9, 'sliding storage', { x: cx, z: room.z });
        }
      }
    } else if (/bath|wc|toilet/.test(text)) {
      if (room.w < 6 && room.d >= 6) {
        // Narrow bath: stack fixtures along the depth against the west wall.
        add(`fx-${slug}-toilet`, room.id, 'toilet', room.x + 0.5, room.z + 0.3, 2.2, 2.2, 'front clear', { x: room.x, z: room.z + 1.4 });
        add(`fx-${slug}-vanity`, room.id, 'vanity_sink', room.x + 0.5, room.z + 3.0, 2.4, 1.7, 'front clear', { x: room.x, z: room.z + 3.85 });
        if (room.d >= 8) {
          add(`fx-${slug}-shower`, room.id, 'shower', room.x + 0.5, room.z + room.d - 2.9, 2.4, 2.6, 'door clear', { x: room.x, z: room.z + room.d - 1.6 });
        }
      } else if (room.w < 6) {
        // Compact powder room (e.g. 4x4 second bath): toilet against the north
        // wall + a small lavatory below it. Every bathroom requires a sink — a
        // toilet-only room is not a bathroom — so the vanity is unconditional here.
        add(`fx-${slug}-toilet`, room.id, 'toilet', room.x + 0.3, room.z + 0.3, 1.9, 1.9, 'front clear', { x: room.x + 1.25, z: room.z });
        add(`fx-${slug}-vanity`, room.id, 'vanity_sink', room.x + 0.3, room.z + room.d - 1.5, Math.min(1.8, room.w - 0.6), 1.2, 'front clear', { x: room.x, z: room.z + room.d - 0.9 });
      } else {
        add(`fx-${slug}-toilet`, room.id, 'toilet', room.x + 0.5, room.z + 0.3, 2.2, 2.2, 'front clear', { x: room.x + 1.6, z: room.z });
        if (room.w >= 6) {
          add(`fx-${slug}-vanity`, room.id, 'vanity_sink', room.x + 3.0, room.z + 0.3, 2.4, 1.7, 'front clear', { x: room.x + 4.2, z: room.z });
        }
        if (room.w >= 8) {
          add(`fx-${slug}-shower`, room.id, 'shower', room.x + room.w - 2.5, room.z + 0.3, 2.4, 2.6, 'door clear', { x: room.x + room.w - 1.3, z: room.z });
        }
      }
    }
    // A kitchen ZONE has walls on only some of its edges -- the sides it shares
    // with the dining and living zones are open by definition. The recipe used
    // to assume a deep room against the east perimeter and anchored the fridge
    // to the room's north edge, which in a zone is thin air: the fixture came
    // out with no anchorWallId and blocked the plan. It also derived the run
    // depth from room.d, collapsing to a 2 ft counter in a 12x4 galley.
    //
    // So find the longest edge that actually CARRIES a wall and lay the run
    // along it. That is what a galley kitchen is, and it works for the old deep
    // room too.
    if (/kitchen/.test(text)) {
      const edges = [
        { axis: 'z' as const, at: room.z, lo: room.x, hi: room.x + room.w, len: room.w, inward: 1 },
        { axis: 'z' as const, at: room.z + room.d, lo: room.x, hi: room.x + room.w, len: room.w, inward: -1 },
        { axis: 'x' as const, at: room.x, lo: room.z, hi: room.z + room.d, len: room.d, inward: 1 },
        { axis: 'x' as const, at: room.x + room.w, lo: room.z, hi: room.z + room.d, len: room.d, inward: -1 },
      ].filter((edge) => walls.some((wall) => {
        const vertical = Math.abs(wall.span.x1 - wall.span.x2) < EPS;
        if (edge.axis === 'x') {
          if (!vertical || Math.abs(wall.span.x1 - edge.at) > 0.26) return false;
          return Math.min(Math.max(wall.span.z1, wall.span.z2), edge.hi) - Math.max(Math.min(wall.span.z1, wall.span.z2), edge.lo) > 1;
        }
        if (vertical || Math.abs(wall.span.z1 - edge.at) > 0.26) return false;
        return Math.min(Math.max(wall.span.x1, wall.span.x2), edge.hi) - Math.max(Math.min(wall.span.x1, wall.span.x2), edge.lo) > 1;
      }));
      // ...and pick it by USABLE length, not raw length. A counter needs
      // standing headroom, and on an a-frame the longest wall is the one that
      // dives under the eave: the first version of this ran a 10 ft counter
      // from the ridge out to 4.17 ft of headroom. Measure the longest
      // contiguous stretch of each edge that clears the work height, and lay
      // the run inside it.
      const MIN_WORK_HEADROOM_FT = 6.67;
      // A run needs a wall AND headroom AT THE SAME POINT. Scoring headroom alone
      // found the roomy middle of a zone whose only wall was out under the eave
      // and laid the counter where nothing could support it -- on the 36 ft
      // a-frame every kitchen fixture came back with no anchor.
      const wallAt = (edge: typeof edges[number], t: number) => walls.some((wall) => {
        const vertical = Math.abs(wall.span.x1 - wall.span.x2) < EPS;
        if (edge.axis === 'x') {
          if (!vertical || Math.abs(wall.span.x1 - edge.at) > 0.26) return false;
          return t >= Math.min(wall.span.z1, wall.span.z2) - 0.01 && t <= Math.max(wall.span.z1, wall.span.z2) + 0.01;
        }
        if (vertical || Math.abs(wall.span.z1 - edge.at) > 0.26) return false;
        return t >= Math.min(wall.span.x1, wall.span.x2) - 0.01 && t <= Math.max(wall.span.x1, wall.span.x2) + 0.01;
      });
      const usable = (edge: typeof edges[number]) => {
        let best = { lo: edge.lo, hi: edge.lo };
        let runStart: number | null = null;
        for (let t = edge.lo; t <= edge.hi + 1e-6; t += 0.5) {
          const px = edge.axis === 'z' ? t : edge.at + edge.inward * 1;
          const pz = edge.axis === 'z' ? edge.at + edge.inward * 1 : t;
          const ok = wallAt(edge, t)
            && (!ceiling.length || envelopeCeilingHeightAt(ceiling, px, pz) >= MIN_WORK_HEADROOM_FT);
          if (ok && runStart === null) runStart = t;
          if ((!ok || t + 0.5 > edge.hi) && runStart !== null) {
            const end = ok ? t : t - 0.5;
            if (end - runStart > best.hi - best.lo) best = { lo: runStart, hi: end };
            runStart = null;
          }
        }
        return best;
      };
      const scored = edges
        .map((edge) => ({ edge, span: usable(edge) }))
        .sort((a, b) => (b.span.hi - b.span.lo) - (a.span.hi - a.span.lo));
      const edge = scored[0] && scored[0].span.hi - scored[0].span.lo >= 4 ? scored[0].edge : undefined;
      const span = scored[0]?.span;
      if (edge && span) {
        const DEPTH = 2;
        const runLen = Math.min(span.hi - span.lo - 0.4, 10);
        const start = span.lo + 0.2;
        // Along-run offsets: sink centred, range beyond it, fridge at the end.
        const at = (offset: number, size: number) => {
          const along = Math.min(start + offset, span.hi - 0.2 - size);
          const inset = edge.inward > 0 ? edge.at : edge.at - DEPTH;
          return edge.axis === 'z'
            ? { x: along, z: inset, w: size, d: DEPTH, wall: { x: along + size / 2, z: edge.at } }
            : { x: inset, z: along, w: DEPTH, d: size, wall: { x: edge.at, z: along + size / 2 } };
        };
        const run = at(0, runLen);
        add(`fx-${slug}-counter`, room.id, 'counter_run', run.x, run.z, run.w, run.d, 'work aisle clear', run.wall);
        const sink = at(runLen / 2 - 0.8, 1.6);
        add(`fx-${slug}-sink`, room.id, 'sink', sink.x, sink.z, sink.w, sink.d, 'under window where possible', sink.wall);
        const range = at(runLen / 2 + 1.2, 2.0);
        add(`fx-${slug}-range`, room.id, 'range', range.x, range.z, range.w, range.d, 'landing space beside', range.wall);
        const fridge = at(runLen - 2.8, 2.8);
        add(`fx-${slug}-fridge`, room.id, 'refrigerator', fridge.x, fridge.z, fridge.w, fridge.d, 'door swing clear', fridge.wall);
      }
    }
    // Dining is its own zone now, so it furnishes itself rather than being
    // squeezed into the living room's recipe.
    if (/dining/.test(text) && !/kitchen/.test(text)) {
      if (room.w >= 6 && room.d >= 6) {
        add(`fx-${slug}-dining`, room.id, 'round_table_six_chairs', room.x + room.w / 2 - 2, room.z + room.d / 2 - 2, 4, 4, 'chairs pull out');
      }
    }
    if (/living|great/.test(text)) {
      if (room.w >= 10 && room.d >= 9) {
        const sharesWithKitchen = /kitchen/.test(text);
        add(`fx-${slug}-sofa`, room.id, 'sofa_chairs_coffee_table', room.x + 1.5, room.z + 1.5, Math.min(8, room.w - 3), Math.min(6, room.d - 3), 'circulation around');
        // Only carry dining here when the living room IS the dining room; a
        // separate Dining zone furnishes its own table above.
        if (sharesWithKitchen || !intent.rooms.some((r) => /dining/.test(`${r.type} ${r.label}`.toLowerCase()))) {
          add(
            `fx-${slug}-dining`,
            room.id,
            'round_table_six_chairs',
            sharesWithKitchen ? room.x + room.w / 2 - 2 : room.x + room.w - 5,
            room.z + room.d / 2 - 2,
            4,
            4,
            'chairs pull out',
          );
        }
      }
    }
  }
  return fixtures;
}

export function compileIntent(intent: GenerationIntent, planId: string, brief: string): CompileResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const { widthFt, depthFt } = intent.footprint ?? { widthFt: 0, depthFt: 0 };
  if (!(widthFt > 0 && depthFt > 0)) errors.push('footprint must have positive widthFt/depthFt');
  const rooms = intent.rooms ?? [];
  if (rooms.length < 2) errors.push('at least two rooms required');
  const roomIds = new Set(rooms.map((room) => room.id));

  // A requested bedroom count beyond the deterministic template ceiling is a
  // program the generator cannot honestly build: refuse rather than silently
  // ship a 3-bedroom plan that misrepresents the brief (input honesty, P5).
  if (typeof intent.requestedBedrooms === 'number' && intent.requestedBedrooms > MAX_TEMPLATE_BEDROOMS) {
    errors.push(
      `requested ${intent.requestedBedrooms} bedrooms; the deterministic generator builds at most ${MAX_TEMPLATE_BEDROOMS} `
      + `— reduce the bedroom count or supply an OPENAI_API_KEY for full generation`,
    );
  }

  // A 4-bedroom plan packs four bedrooms across a 48 ft width; an a-frame's 1 ft
  // eave leaves the two width-edge bedrooms below R305 headroom, so refuse it
  // rather than ship a plan that fails its own ceiling check (input honesty, P5).
  // The eave-≥7 ft styles (gable/flat/shed/hip/gambrel/barn) host 4 beds fine.
  if (typeof intent.requestedBedrooms === 'number' && intent.requestedBedrooms >= 4 && intent.roof?.style === 'a-frame') {
    errors.push(
      `requested ${intent.requestedBedrooms} bedrooms with an a-frame roof; the a-frame's low eave cannot give the `
      + `width-edge bedrooms the required ceiling height — choose gable, hip, flat, shed, gambrel, or barn for 4 bedrooms`,
    );
  }

  // A recognized roof style the generator does not implement yet (hip/shed/
  // barn/gambrel) is a program it cannot honestly build: refuse rather than
  // silently substitute an a-frame whose 18 ft ridge misrepresents the brief
  // (input honesty, P5 — same class as the bedroom/sqft refusals above).
  if (intent.requestedRoofStyle
    && !(BUILDABLE_ROOF_STYLES as readonly string[]).includes(intent.requestedRoofStyle)) {
    const styles = BUILDABLE_ROOF_STYLES.length <= 2
      ? BUILDABLE_ROOF_STYLES.join(' and ')
      : `${BUILDABLE_ROOF_STYLES.slice(0, -1).join(', ')}, and ${BUILDABLE_ROOF_STYLES[BUILDABLE_ROOF_STYLES.length - 1]}`;
    errors.push(
      `requested a ${intent.requestedRoofStyle} roof; the deterministic generator builds only `
      + `${styles} roofs — choose one of those, or supply an OPENAI_API_KEY for full generation`,
    );
  }

  // A ≤ sqft cap no template can meet is an unbuildable program: refuse rather
  // than silently ship a footprint larger than the user allowed (same input-
  // honesty class — fits() prefers a footprint within the cap; this catches the
  // case where even the smallest exceeds it).
  if (typeof intent.requestedMaxSqft === 'number' && widthFt > 0 && depthFt > 0
    && widthFt * depthFt > intent.requestedMaxSqft + EPS) {
    errors.push(
      `footprint ${widthFt}x${depthFt} ft (${widthFt * depthFt} sq ft) exceeds the requested ≤${intent.requestedMaxSqft} sq ft cap `
      + `— the smallest template for this program is larger; raise the cap or reduce the program`,
    );
  }

  // A kit request is a REQUEST, and the kit is discrete. Building a hip roof for
  // someone who asked for a WikiHouse home and quietly shipping something no
  // block set can cut is the same silent-mismatch class as clamping a bedroom
  // count. The kit module decides — never a second copy of its rules here.
  if (intent.kitBuildable) {
    const pitchDeg = roofPitchDeg(intent.roof, { widthFt, depthFt });
    const kit = assessSkylarkKit({ roofStyle: intent.roof.style, roofPitchDeg: pitchDeg });
    if (kit.status !== 'buildable') {
      errors.push(
        `${/^[aeiou]/.test(intent.roof.style) ? 'an' : 'a'} ${intent.roof.style} roof cannot be built from the WikiHouse kit — ${kit.reasons.join(' ')} `
        + `The kit builds a flat roof or a ${KIT_PITCH_DEG}° gable; ask for one of those, or drop the kit requirement.`,
      );
    }
  }

  // A footprint that cannot sit inside the lot's buildable envelope is a hard
  // design failure, not an advisory: refuse to compile rather than emit a plan
  // the zoning report would immediately flag.
  const lot = intent.lot;
  if (lot && Number.isFinite(lot.widthFt) && Number.isFinite(lot.depthFt)) {
    const setbacks = lot.setbacksFt ?? {};
    const envelopeW = lot.widthFt - (setbacks.left ?? 0) - (setbacks.right ?? 0);
    const envelopeD = lot.depthFt - (setbacks.front ?? 0) - (setbacks.rear ?? 0);
    // Measure the SITE extent, not just the heated box. Rooms may legitimately
    // sit outside the conditioned footprint -- the entry deck does -- but a deck
    // is still a structure standing on the lot, so it consumes setback like any
    // other. Checking `footprint` alone would let a deck sprawl into a setback
    // completely unseen by the gate that exists to catch exactly that.
    const groundRooms = rooms;
    const siteW = Math.max(widthFt, ...groundRooms.map((r) => r.x + r.w))
      - Math.min(0, ...groundRooms.map((r) => r.x));
    const siteD = Math.max(depthFt, ...groundRooms.map((r) => r.z + r.d))
      - Math.min(0, ...groundRooms.map((r) => r.z));
    if (siteW > envelopeW + EPS || siteD > envelopeD + EPS) {
      const outside = siteW > widthFt + EPS || siteD > depthFt + EPS;
      errors.push(
        `built extent ${siteW}x${siteD} ft exceeds the buildable envelope ${envelopeW}x${envelopeD} ft `
        + `(lot ${lot.widthFt}x${lot.depthFt} ft minus setbacks)`
        + (outside ? ` — the ${widthFt}x${depthFt} ft footprint fits, but attached exterior structure pushes it past the setback` : ''),
      );
    }
    // Likewise refuse a footprint over the lot-coverage cap — the SAME threshold
    // (and tolerance) the ZON-COVERAGE report uses — so the generator never ships
    // a plan that fails its own coverage report. Smaller templates have already
    // been tried by mockIntentFromBrief; reaching here means none fit this lot.
    const maxRatio = lot.maxCoverageRatio ?? DEFAULT_MAX_COVERAGE_RATIO;
    // Whether an uncovered deck counts toward lot coverage is genuinely
    // jurisdiction-dependent -- ZON-COVERAGE is worded "building footprint", and
    // many ordinances exempt at-grade decks while counting elevated ones. We
    // COUNT it. Assuming the exemption would be choosing the reading that makes
    // our own plans pass, and would understate coverage on exactly the small
    // lots where the cap binds. Conservative here means a smaller deck, not a
    // surprise at the permit counter.
    const attachedArea = rooms
      .filter((room) => isUnconditioned(room))
      .reduce((sum, room) => sum + room.w * room.d, 0);
    const coverage = (widthFt * depthFt + attachedArea) / (lot.widthFt * lot.depthFt);
    if (coverage > maxRatio + 1e-6) {
      errors.push(
        `footprint ${widthFt}x${depthFt} ft`
        + (attachedArea > 0 ? ` plus ${attachedArea} sq ft of attached deck` : '')
        + ` covers ${(coverage * 100).toFixed(1)}% of the `
        + `${lot.widthFt}x${lot.depthFt} ft lot, over the ${(maxRatio * 100).toFixed(0)}% coverage cap `
        + `— enlarge the lot or lower the program`,
      );
    }
  }

  // Program reconciliation (no silent mismatch): a bath count the fitting
  // footprint couldn't host is a valid plan, but the dropped bath MUST be
  // surfaced — never silently delivered as if the brief were honored.
  if (typeof intent.requestedBaths === 'number') {
    const builtBaths = rooms.filter((room) => room.type === 'bathroom').length;
    const builtBedrooms = rooms.filter((room) => room.type === 'bedroom').length;
    if (builtBaths < intent.requestedBaths) {
      // Say WHY, and say the true reason: "enlarge the footprint" is useless
      // advice when the request is simply beyond what any template offers.
      const because = intent.requestedBaths > MAX_TEMPLATE_BATHS
        ? `the largest template provides ${MAX_TEMPLATE_BATHS} baths`
        : builtBedrooms === 1
          ? 'single-bedroom programs are single-bath'
          : 'only a single-bath footprint fits this size/lot — enlarge the footprint for a second bath';
      notes.push(`requested ${intent.requestedBaths} baths; built ${builtBaths} — ${because}.`);
    }
  }

  for (const room of rooms) {
    // Outdoor platforms are SUPPOSED to sit outside the heated box -- that is
    // what makes them outdoor. They are not unchecked, though: the envelope and
    // coverage tests above measure the built extent including them, so a deck
    // still has to fit the lot. What they must not do is overhang the facade
    // sideways, leaving a corner of decking cantilevered off nothing.
    if (isUnconditioned(room)) {
      if (room.x < -EPS || room.x + room.w > widthFt + EPS) {
        errors.push(`room ${room.id} overhangs the ${widthFt} ft facade (x ${room.x} to ${room.x + room.w})`);
      }
      continue;
    }
    if (room.x < -EPS || room.z < -EPS || room.x + room.w > widthFt + EPS || room.z + room.d > depthFt + EPS) {
      errors.push(`room ${room.id} extends outside the footprint`);
    }
    if (!(room.w > 0 && room.d > 0)) errors.push(`room ${room.id} has non-positive size`);
  }
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      if (rectsOverlap(rooms[i], rooms[j])) errors.push(`rooms ${rooms[i].id} and ${rooms[j].id} overlap`);
    }
  }
  const refOk = (id: string) => id === 'exterior' || roomIds.has(id);
  for (const door of intent.doors ?? []) {
    if (!refOk(door.fromRoomId) || !refOk(door.toRoomId)) errors.push(`door ${door.id} references unknown room`);
  }
  for (const window of intent.windows ?? []) {
    if (!roomIds.has(window.roomId)) errors.push(`window ${window.id} references unknown room`);
  }
  const sleeping = rooms.filter((room) => /bed|sleep|bunk/i.test(`${room.type} ${room.label}`) && !/bath/i.test(room.type));
  for (const bed of sleeping) {
    const hasEgress = (intent.windows ?? []).some((window) => window.roomId === bed.id)
      || (intent.doors ?? []).some((door) => door.openingType === 'exteriorDoor' && (door.fromRoomId === bed.id || door.toRoomId === bed.id));
    if (!hasEgress) errors.push(`sleeping room ${bed.id} has no egress window or exterior door`);
  }
  if (errors.length) return { ok: false, errors };

  const exteriorWalls: WallSegment[] = [
    { id: 'ext-n', kind: 'solidExterior', facing: 'N', span: { x1: 0, z1: 0, x2: widthFt, z2: 0 } },
    { id: 'ext-e', kind: 'solidExterior', facing: 'E', span: { x1: widthFt, z1: 0, x2: widthFt, z2: depthFt } },
    { id: 'ext-s', kind: 'solidExterior', facing: 'S', span: { x1: 0, z1: depthFt, x2: widthFt, z2: depthFt } },
    { id: 'ext-w', kind: 'solidExterior', facing: 'W', span: { x1: 0, z1: 0, x2: 0, z2: depthFt } },
  ];
  const interiorWalls = deriveInteriorWalls(rooms);
  const allWalls = [...exteriorWalls, ...interiorWalls];
  const wallFor = (span: IntentSpan): WallSegment | undefined => allWalls.find((wall) => spanOnWall(span, wall));

  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const wallShape = (wall: WallSegment) => {
    const t = 0.5;
    const vertical = Math.abs(wall.span.x1 - wall.span.x2) < EPS;
    return {
      ...wall,
      levelFrameId: 'floor-0',
      levelIndex: 0,
      wallKind: wall.kind,
      bounds: vertical
        ? { x: wall.span.x1 - t / 2, z: Math.min(wall.span.z1, wall.span.z2), w: t, d: Math.abs(wall.span.z2 - wall.span.z1) }
        : { x: Math.min(wall.span.x1, wall.span.x2), z: wall.span.z1 - t / 2, w: Math.abs(wall.span.x2 - wall.span.x1), d: t },
    };
  };

  const doors = (intent.doors ?? []).map((door) => {
    const wall = wallFor(door.span);
    const vertical = Math.abs(door.span.x1 - door.span.x2) < EPS;
    const into = roomById.get(door.toRoomId === 'exterior' ? door.fromRoomId : door.toRoomId);
    const intoCenter = into ? { x: into.x + into.w / 2, z: into.z + into.d / 2 } : { x: widthFt / 2, z: depthFt / 2 };
    const leafLen = Math.hypot(door.span.x2 - door.span.x1, door.span.z2 - door.span.z1);
    const dir = vertical
      ? { x: Math.sign(intoCenter.x - door.span.x1) || 1, z: 0 }
      : { x: 0, z: Math.sign(intoCenter.z - door.span.z1) || 1 };
    return {
      id: door.id,
      levelFrameId: 'floor-0',
      levelIndex: 0,
      wallId: wall?.id,
      doorKind: door.openingType === 'exteriorDoor' ? 'singleSwingExterior' : 'singleSwingInterior',
      openingType: door.openingType,
      facing: wall?.facing,
      fromRoomId: door.fromRoomId,
      toRoomId: door.toRoomId,
      opensIntoRoomId: door.toRoomId === 'exterior' ? door.fromRoomId : door.toRoomId,
      span: door.span,
      hingePoint: { x: door.span.x1, z: door.span.z1 },
      leafClosedEnd: { x: door.span.x2, z: door.span.z2 },
      leafOpenEnd: { x: door.span.x1 + dir.x * leafLen, z: door.span.z1 + dir.z * leafLen },
      swingDirection: 'in',
      swingArcDeg: 90,
    };
  });

  // A sleeping room's exterior window is its emergency escape opening (IRC
  // R310.1), so it must be operable; all other glazing is fixed. One rule, no
  // per-room special cases — and the engine fails any bedroom left with only a
  // fixed window, so this can't silently regress.
  const sleepingRoomIds = new Set(sleeping.map((room) => room.id));
  const windowKindFor = (roomId: string | undefined) =>
    roomId && sleepingRoomIds.has(roomId) ? 'egress' : 'fixed';
  const windows = (intent.windows ?? []).map((window) => ({
    id: window.id,
    levelFrameId: 'floor-0',
    levelIndex: 0,
    wallId: wallFor(window.span)?.id,
    windowKind: windowKindFor(window.roomId),
    facing: wallFor(window.span)?.facing,
    roomIds: [window.roomId, 'exterior'],
    span: window.span,
  }));

  const openings = (intent.openings ?? []).map((opening) => ({
    id: opening.id,
    levelFrameId: 'floor-0',
    levelIndex: 0,
    wallId: wallFor(opening.span)?.id,
    openingType: 'passthrough',
    kind: 'open',
    fromRoomId: opening.fromRoomId,
    toRoomId: opening.toRoomId,
    span: opening.span,
  }));

  const roof = intent.roof ?? { style: 'a-frame', ridgeAxis: 'z', ridgeHeightFt: 18, eaveHeightFt: 1 };
  const overhang = 1;
  const ridge = roof.ridgeHeightFt;
  const eave = roof.eaveHeightFt;
  const ridgeAlongZ = roof.ridgeAxis === 'z';
  const midX = widthFt / 2;
  const midZ = depthFt / 2;
  const isFlat = roof.style === 'flat';
  const isShed = roof.style === 'shed';
  const isHip = roof.style === 'hip';
  const isGambrel = roof.style === 'gambrel';
  const isBarn = roof.style === 'barn';
  // Hip: ridge line along the longer axis, inset from each end by half the
  // shorter dimension (45° hip in plan). On a square footprint the inset == the
  // half-span, so the ridge collapses to a point -> a pyramid. ONE formula.
  const hipInset = Math.min(widthFt, depthFt) / 2;
  // Gambrel: a two-pitch gable. The knuckle (slope break) sits a quarter of the
  // width in from each side, three-quarters of the way up from eave to ridge —
  // so the lower slope is steep and the upper slope shallow.
  const knuckleY = eave + (ridge - eave) * 0.75;
  const kxL = widthFt / 4;
  const kxR = (widthFt * 3) / 4;
  // Barn (gambrel hip) = two stacked hips. A uniformly-inset rectangle at each
  // level: eave (inset 0, +overhang) -> knuckle ring (inset barnKnuckleInset) ->
  // ridge (inset half the shorter dim -> a line on a rectangle, a point on a
  // square). hipBand() builds the 4 frustum planes between two such rectangles;
  // the inset math handles every aspect ratio with no orientation branch.
  const barnRidgeInset = Math.min(widthFt, depthFt) / 2;
  const barnKnuckleInset = barnRidgeInset * 0.4;
  const barnKnuckleY = eave + (ridge - eave) * 0.65;
  const insetRect = (ins: number) => ins <= 0
    ? { x0: -overhang, x1: widthFt + overhang, z0: -overhang, z1: depthFt + overhang }
    : { x0: ins, x1: widthFt - ins, z0: ins, z1: depthFt - ins };
  const hipBand = (idPrefix: string, bInset: number, yB: number, tInset: number, yT: number) => {
    const b = insetRect(bInset);
    const t = insetRect(tInset);
    return [
      { id: `${idPrefix}-n`, role: 'roof-plane', points: [{ x: b.x0, y: yB, z: b.z0 }, { x: b.x1, y: yB, z: b.z0 }, { x: t.x1, y: yT, z: t.z0 }, { x: t.x0, y: yT, z: t.z0 }] },
      { id: `${idPrefix}-s`, role: 'roof-plane', points: [{ x: b.x0, y: yB, z: b.z1 }, { x: b.x1, y: yB, z: b.z1 }, { x: t.x1, y: yT, z: t.z1 }, { x: t.x0, y: yT, z: t.z1 }] },
      { id: `${idPrefix}-w`, role: 'roof-plane', points: [{ x: b.x0, y: yB, z: b.z0 }, { x: b.x0, y: yB, z: b.z1 }, { x: t.x0, y: yT, z: t.z1 }, { x: t.x0, y: yT, z: t.z0 }] },
      { id: `${idPrefix}-e`, role: 'roof-plane', points: [{ x: b.x1, y: yB, z: b.z0 }, { x: b.x1, y: yB, z: b.z1 }, { x: t.x1, y: yT, z: t.z1 }, { x: t.x1, y: yT, z: t.z0 }] },
    ];
  };
  // A flat roof is one horizontal plane over the whole footprint (+overhang) at
  // a constant height; a shed roof is one plane sloping high edge (x=0, ridge)
  // -> low edge (x=widthFt, eave); a hip is four planes rising to the ridge.
  // All feed the same plane-fit / clip / ceiling-profile machinery the gable/
  // a-frame planes use. The slab thickness gives flat/shed outlines a real
  // (non-degenerate) profile.
  const slabTop = ridge + 0.35;
  const planes = isBarn
    ? [
      // Two stacked hips: steep lower band (eave -> knuckle ring) + shallow upper
      // band (knuckle ring -> ridge). Eight planes; the inset rectangles collapse
      // the ridge to a line (rectangle) or a point (square) automatically.
      ...hipBand('roof-plane-barn-lower', 0, eave, barnKnuckleInset, barnKnuckleY),
      ...hipBand('roof-plane-barn-upper', barnKnuckleInset, barnKnuckleY, barnRidgeInset, ridge),
    ]
    : isFlat
      ? [
        { id: 'roof-plane-flat', role: 'roof-plane', points: [{ x: -overhang, y: ridge, z: -overhang }, { x: widthFt + overhang, y: ridge, z: -overhang }, { x: widthFt + overhang, y: ridge, z: depthFt + overhang }, { x: -overhang, y: ridge, z: depthFt + overhang }] },
      ]
      : isShed
        ? [
          { id: 'roof-plane-shed', role: 'roof-plane', points: [{ x: -overhang, y: ridge, z: -overhang }, { x: widthFt + overhang, y: eave, z: -overhang }, { x: widthFt + overhang, y: eave, z: depthFt + overhang }, { x: -overhang, y: ridge, z: depthFt + overhang }] },
        ]
      : isHip
        ? (ridgeAlongZ
          // Ridge along z (depth is the longer axis): two long side planes (E/W)
          // + two triangular hip ends (N/S).
          ? [
            { id: 'roof-plane-west-hip', role: 'roof-plane', points: [{ x: -overhang, y: eave, z: -overhang }, { x: midX, y: ridge, z: hipInset }, { x: midX, y: ridge, z: depthFt - hipInset }, { x: -overhang, y: eave, z: depthFt + overhang }] },
            { id: 'roof-plane-east-hip', role: 'roof-plane', points: [{ x: widthFt + overhang, y: eave, z: -overhang }, { x: widthFt + overhang, y: eave, z: depthFt + overhang }, { x: midX, y: ridge, z: depthFt - hipInset }, { x: midX, y: ridge, z: hipInset }] },
            { id: 'roof-plane-north-hip', role: 'roof-plane', points: [{ x: -overhang, y: eave, z: -overhang }, { x: widthFt + overhang, y: eave, z: -overhang }, { x: midX, y: ridge, z: hipInset }] },
            { id: 'roof-plane-south-hip', role: 'roof-plane', points: [{ x: -overhang, y: eave, z: depthFt + overhang }, { x: widthFt + overhang, y: eave, z: depthFt + overhang }, { x: midX, y: ridge, z: depthFt - hipInset }] },
          ]
          // Ridge along x (width is the longer axis, the usual case): two long
          // side planes (N/S) + two triangular hip ends (E/W).
          : [
            { id: 'roof-plane-north-hip', role: 'roof-plane', points: [{ x: -overhang, y: eave, z: -overhang }, { x: widthFt + overhang, y: eave, z: -overhang }, { x: widthFt - hipInset, y: ridge, z: midZ }, { x: hipInset, y: ridge, z: midZ }] },
            { id: 'roof-plane-south-hip', role: 'roof-plane', points: [{ x: hipInset, y: ridge, z: midZ }, { x: widthFt - hipInset, y: ridge, z: midZ }, { x: widthFt + overhang, y: eave, z: depthFt + overhang }, { x: -overhang, y: eave, z: depthFt + overhang }] },
            { id: 'roof-plane-west-hip', role: 'roof-plane', points: [{ x: -overhang, y: eave, z: -overhang }, { x: hipInset, y: ridge, z: midZ }, { x: -overhang, y: eave, z: depthFt + overhang }] },
            { id: 'roof-plane-east-hip', role: 'roof-plane', points: [{ x: widthFt + overhang, y: eave, z: -overhang }, { x: widthFt + overhang, y: eave, z: depthFt + overhang }, { x: widthFt - hipInset, y: ridge, z: midZ }] },
          ])
        : isGambrel
          // Two-pitch gable: each side is a STEEP lower plane (eave -> knuckle)
          // and a SHALLOW upper plane (knuckle -> ridge), running the full depth.
          ? [
            { id: 'roof-plane-west-lower', role: 'roof-plane', points: [{ x: -overhang, y: eave, z: -overhang }, { x: kxL, y: knuckleY, z: -overhang }, { x: kxL, y: knuckleY, z: depthFt + overhang }, { x: -overhang, y: eave, z: depthFt + overhang }] },
            { id: 'roof-plane-west-upper', role: 'roof-plane', points: [{ x: kxL, y: knuckleY, z: -overhang }, { x: midX, y: ridge, z: -overhang }, { x: midX, y: ridge, z: depthFt + overhang }, { x: kxL, y: knuckleY, z: depthFt + overhang }] },
            { id: 'roof-plane-east-upper', role: 'roof-plane', points: [{ x: midX, y: ridge, z: -overhang }, { x: kxR, y: knuckleY, z: -overhang }, { x: kxR, y: knuckleY, z: depthFt + overhang }, { x: midX, y: ridge, z: depthFt + overhang }] },
            { id: 'roof-plane-east-lower', role: 'roof-plane', points: [{ x: kxR, y: knuckleY, z: -overhang }, { x: widthFt + overhang, y: eave, z: -overhang }, { x: widthFt + overhang, y: eave, z: depthFt + overhang }, { x: kxR, y: knuckleY, z: depthFt + overhang }] },
          ]
          : ridgeAlongZ
            ? [
          { id: 'roof-plane-west-slope', role: 'roof-plane', points: [{ x: -overhang, y: eave, z: -overhang }, { x: midX, y: ridge, z: -overhang }, { x: midX, y: ridge, z: depthFt + overhang }, { x: -overhang, y: eave, z: depthFt + overhang }] },
          { id: 'roof-plane-east-slope', role: 'roof-plane', points: [{ x: midX, y: ridge, z: -overhang }, { x: widthFt + overhang, y: eave, z: -overhang }, { x: widthFt + overhang, y: eave, z: depthFt + overhang }, { x: midX, y: ridge, z: depthFt + overhang }] },
        ]
        : [
          { id: 'roof-plane-north-slope', role: 'roof-plane', points: [{ x: -overhang, y: eave, z: -overhang }, { x: widthFt + overhang, y: eave, z: -overhang }, { x: widthFt + overhang, y: ridge, z: midZ }, { x: -overhang, y: ridge, z: midZ }] },
          { id: 'roof-plane-south-slope', role: 'roof-plane', points: [{ x: -overhang, y: ridge, z: midZ }, { x: widthFt + overhang, y: ridge, z: midZ }, { x: widthFt + overhang, y: eave, z: depthFt + overhang }, { x: -overhang, y: eave, z: depthFt + overhang }] },
        ];
  // --- Envelope-aware opening resolution ------------------------------------
  // The roof now exists, so every sleeping room's egress opening is checked
  // against the REAL ceiling planes (the same ones the 3D clip and elevations
  // use) and relocated to a wall that can actually host it. Authored spans are
  // preferences; the envelope is the authority. A room with no legal wall is
  // refused rather than shipped with an unbuildable escape opening.
  const ceilingPlanes = ceilingPlanesFromRoofPoints(planes);
  const roomRects = new Map(rooms.map((room) => [room.id, { id: room.id, x: room.x, z: room.z, w: room.w, d: room.d }]));
  for (const window of windows) {
    const roomId = window.roomIds?.[0];
    if (!roomId || !sleepingRoomIds.has(roomId)) continue;
    const room = rooms.find((candidate) => candidate.id === roomId);
    if (!room) continue;
    const resolved = resolveEgressWindow(
      { id: room.id, x: room.x, z: room.z, w: room.w, d: room.d },
      window.span,
      ceilingPlanes,
      { widthFt, depthFt },
    );
    if (!resolved.span) {
      errors.push(resolved.reason ?? `sleeping room ${roomId} has no viable egress wall`);
      continue;
    }
    if (resolved.relocated) {
      window.span = resolved.span;
      window.wallId = wallFor(resolved.span)?.id;
      window.facing = wallFor(resolved.span)?.facing;
      notes.push(
        `${window.id} moved to the ${window.facing ?? 'nearest viable'} wall of ${roomId}: the authored position `
        + `left too little wall under the ${roof.style} roof for an IRC R310.1 egress opening`,
      );
    }
  }
  if (errors.length) return { ok: false, errors };

  const flatOutline = (spanFt: number) => [
    { x: -overhang, y: ridge }, { x: spanFt + overhang, y: ridge }, { x: spanFt + overhang, y: slabTop }, { x: -overhang, y: slabTop },
  ];
  // Barn: both faces are a two-pitch HIPPED silhouette — eave -> (steep) knuckle
  // inset -> (shallow) ridge inset -> flat ridge -> mirror. The ridge segment
  // collapses to a peak on a square footprint.
  const barnOutline = (spanFt: number) => [
    { x: -overhang, y: eave }, { x: barnKnuckleInset, y: barnKnuckleY }, { x: barnRidgeInset, y: ridge },
    { x: spanFt - barnRidgeInset, y: ridge }, { x: spanFt - barnKnuckleInset, y: barnKnuckleY }, { x: spanFt + overhang, y: eave },
  ];
  const elevations = isBarn
    ? [
      { id: 'front-barn', view: 'front', outline: barnOutline(widthFt) },
      { id: 'side-barn', view: 'side', outline: barnOutline(depthFt) },
    ]
    : isFlat
      ? [
        { id: 'front-flat', view: 'front', outline: flatOutline(widthFt) },
        { id: 'side-flat', view: 'side', outline: flatOutline(depthFt) },
      ]
      : isShed
      ? [
        // Front looks across the slope: roofline drops high edge (ridge, x=0) ->
        // low edge (eave, x=widthFt). Side looks along the slope: the high wall,
        // a flat band at ridge height.
        { id: 'front-shed', view: 'front', outline: [{ x: -overhang, y: ridge }, { x: widthFt + overhang, y: eave }, { x: widthFt + overhang, y: eave - 0.35 }, { x: -overhang, y: ridge - 0.35 }] },
        { id: 'side-shed', view: 'side', outline: [{ x: -overhang, y: ridge }, { x: depthFt + overhang, y: ridge }, { x: depthFt + overhang, y: ridge - 0.35 }, { x: -overhang, y: ridge - 0.35 }] },
      ]
      : isHip
        ? (ridgeAlongZ
          // Ridge along z: the long side (front, span x) shows the hipped end
          // TRIANGLE (apex centered); the short side (side, span z) shows the
          // long-side TRAPEZOID (eave -> ridge inset -> flat -> eave).
          ? [
            { id: 'front-hip-end', view: 'front', outline: [{ x: -overhang, y: eave }, { x: midX, y: ridge }, { x: widthFt + overhang, y: eave }] },
            { id: 'side-hip-long', view: 'side', outline: [{ x: -overhang, y: eave }, { x: hipInset, y: ridge }, { x: depthFt - hipInset, y: ridge }, { x: depthFt + overhang, y: eave }] },
          ]
          // Ridge along x (usual): front (span x) is the long-side TRAPEZOID;
          // side (span z) is the hipped end TRIANGLE. The trapezoid collapses to
          // a triangle on a square footprint (hipInset == half-span -> pyramid).
          : [
            { id: 'front-hip-long', view: 'front', outline: [{ x: -overhang, y: eave }, { x: hipInset, y: ridge }, { x: widthFt - hipInset, y: ridge }, { x: widthFt + overhang, y: eave }] },
            { id: 'side-hip-end', view: 'side', outline: [{ x: -overhang, y: eave }, { x: midZ, y: ridge }, { x: depthFt + overhang, y: eave }] },
          ])
        : isGambrel
          // Gambrel end (front): 5-sided two-pitch silhouette eave -> knuckle ->
          // ridge -> knuckle -> eave. Long side: rectangle up to the ridge line.
          ? [
            { id: 'front-gambrel', view: 'front', outline: [{ x: -overhang, y: eave }, { x: kxL, y: knuckleY }, { x: midX, y: ridge }, { x: kxR, y: knuckleY }, { x: widthFt + overhang, y: eave }] },
            { id: 'side-longitudinal', view: 'side', outline: [{ x: -overhang, y: eave }, { x: -overhang, y: ridge }, { x: depthFt + overhang, y: ridge }, { x: depthFt + overhang, y: eave }] },
          ]
          : ridgeAlongZ
            ? [
              { id: 'front-gable', view: 'front', outline: [{ x: -overhang, y: eave }, { x: midX, y: ridge }, { x: widthFt + overhang, y: eave }] },
              { id: 'side-longitudinal', view: 'side', outline: [{ x: -overhang, y: eave }, { x: -overhang, y: ridge }, { x: depthFt + overhang, y: ridge }, { x: depthFt + overhang, y: eave }] },
            ]
            : [
              { id: 'front-longitudinal', view: 'front', outline: [{ x: -overhang, y: eave }, { x: -overhang, y: ridge }, { x: widthFt + overhang, y: ridge }, { x: widthFt + overhang, y: eave }] },
              { id: 'side-gable', view: 'side', outline: [{ x: -overhang, y: eave }, { x: midZ, y: ridge }, { x: depthFt + overhang, y: eave }] },
          ];

  // --- The drawing set derives from the openings, not a fixed pair ----------
  // Elevations used to be hardcoded to exactly [front, side]. Once openings are
  // resolved against the envelope they can legitimately land on the rear or right
  // facade (an a-frame's bedroom egress moves to the rear gable), and those walls
  // then appeared in NO elevation — a plan that is correct but undocumented.
  // A facade that carries an opening must be drawn.
  const EPSF = 0.35;
  const facadeCarriesOpening = (axis: 'x' | 'z', at: number) =>
    [...windows, ...doors].some((op) => {
      const span = op.span as { x1: number; z1: number; x2: number; z2: number } | undefined;
      if (!span) return false;
      return axis === 'x'
        ? Math.abs(span.x1 - at) < EPSF && Math.abs(span.x2 - at) < EPSF
        : Math.abs(span.z1 - at) < EPSF && Math.abs(span.z2 - at) < EPSF;
    });
  const frontElevation = elevations.find((e) => e.view === 'front');
  const sideElevation = elevations.find((e) => e.view === 'side');
  const derivedElevations = [...elevations];
  // Rear (z = depth) mirrors the front profile for every roof here: all styles
  // are symmetric across the ridge, and the shed slopes along x so both z-faces
  // are identical.
  if (facadeCarriesOpening('z', depthFt) && frontElevation) {
    derivedElevations.push({ id: `rear-${roof.style}`, view: 'rear', outline: frontElevation.outline });
  }
  // Right (x = width) mirrors the side profile EXCEPT on a shed, whose x-faces
  // differ by construction: x=0 stands at the ridge, x=width at the eave.
  if (facadeCarriesOpening('x', widthFt) && sideElevation) {
    const outline = isShed
      ? [
        { x: -overhang, y: eave }, { x: depthFt + overhang, y: eave },
        { x: depthFt + overhang, y: eave - 0.35 }, { x: -overhang, y: eave - 0.35 },
      ]
      : sideElevation.outline;
    derivedElevations.push({ id: `right-${roof.style}`, view: 'right', outline });
  }

  const artifact: Record<string, unknown> = {
    schemaVersion: 'paired_gpt_floorplan_v1',
    planId,
    proposalId: 'proposal-paired-v1',
    gridFt: 1,
    coordinateMode: 'feet',
    brief,
    generator: 'generate-plan-api-v1',
    footprint: {
      units: 'ft', x: 0, z: 0, w: widthFt, d: depthFt, levels: 1,
      roofStyle: roof.style, bounds: { x: 0, z: 0, w: widthFt, d: depthFt },
      widthFt, depthFt, polygon: poly(0, 0, widthFt, depthFt), width: widthFt, depth: depthFt,
    },
    lot: intent.lot ?? null,
    floorPanels: [{
      id: 'floor-0', floor: 0, label: 'MAIN LEVEL', levelIndex: 0,
      footprint: { units: 'ft', x: 0, z: 0, w: widthFt, d: depthFt, width: widthFt, depth: depthFt, widthFt, depthFt },
      span: { x1: 0, z1: 0, x2: widthFt, z2: depthFt },
    }],
    rooms: rooms.map((room, index) => ({
      id: room.id, levelFrameId: 'floor-0', levelIndex: 0, roomKind: room.type,
      type: room.type, label: room.label,
      // Zones are drawn and labelled like rooms but are not physical
      // boundaries: the grid gate and the wall derivation both skip them.
      ...(room.semanticZone ? { semanticZone: true, physicalBoundary: false } : {}),
      // Stable shared callout numbering: render legend and proposal image
      // must both use 1..N in intent order.
      calloutNumber: index + 1,
      bounds: { x: room.x, z: room.z, w: room.w, d: room.d },
      polygon: poly(room.x, room.z, room.w, room.d),
    })),
    exteriorWalls: exteriorWalls.map(wallShape),
    interiorWalls: interiorWalls.map(wallShape),
    doors,
    windows,
    openings,
    fixtures: (() => {
      // Fixtures resolve against the envelope for the same reason openings do:
      // a bed or a shower under a 2 ft eave is drawn-but-unusable space. They
      // resolve AS A SET, so a displaced fixture never lands on one already
      // placed (resolving each alone sends the whole room to one optimum).
      const authored = starterFixtures(intent, allWalls, ceilingPlanes);
      const resolutions = resolveFixtureSet(authored, roomRects, ceilingPlanes);
      return authored.map((fixture) => {
        const resolved = resolutions.get(fixture.id);
        if (!resolved) return fixture;
        if (resolved.unplaceable) { notes.push(resolved.unplaceable); return fixture; }
        if (!resolved.moved || !resolved.bounds) return fixture;
        notes.push(resolved.reason === 'clearance'
          ? `${fixture.id} moved within ${fixture.roomId} to keep it clear of the other fixtures`
          : `${fixture.id} moved within ${fixture.roomId} to keep the headroom its use requires under the ${roof.style} roof`);
        return { ...fixture, bounds: resolved.bounds };
      });
    })(),
    dimensionLines: [
      { id: 'dim-width', span: { x1: 0, z1: -2, x2: widthFt, z2: -2 }, label: `${widthFt}'-0"` },
      { id: 'dim-depth', span: { x1: -2, z1: 0, x2: -2, z2: depthFt }, label: `${depthFt}'-0"` },
    ],
    roof: { style: roof.style, ridgeAxis: roof.ridgeAxis, ridgeHeightFt: ridge, eaveHeightFt: eave, overhangFt: overhang, roofThicknessFt: 0.35, planes },
    elevations: derivedElevations,
  };

  // Loft level: appended after validation (it is derived from the roof, not an
  // authored room, so it never participates in the level-0 overlap/footprint
  // checks). Single-level plans are untouched — this block only runs when a
  // loft was requested AND the roof gives headroom.
  let loftBuilt = false;
  if (intent.hasLoft) {
    const loft = buildLoft(roof, widthFt, depthFt);
    if (loft) {
      loftBuilt = true;
      const { bounds } = loft;
      (artifact.footprint as Record<string, unknown>).levels = 2;
      (artifact.floorPanels as unknown[]).push({
        id: 'floor-1', floor: 1, label: 'LOFT LEVEL', levelIndex: 1,
        footprint: { units: 'ft', x: bounds.x, z: bounds.z, w: bounds.w, d: bounds.d, width: bounds.w, depth: bounds.d, widthFt: bounds.w, depthFt: bounds.d },
        span: { x1: bounds.x, z1: bounds.z, x2: bounds.x + bounds.w, z2: bounds.z + bounds.d },
        baseFt: loft.baseFt,
      });
      (artifact.rooms as unknown[]).push({
        id: 'room-loft', levelFrameId: 'floor-1', levelIndex: 1, floor: 1, roomKind: 'loft',
        type: 'loft', label: 'Loft', calloutNumber: rooms.length + 1,
        bounds: { x: bounds.x, z: bounds.z, w: bounds.w, d: bounds.d },
        polygon: poly(bounds.x, bounds.z, bounds.w, bounds.d),
      });
      // Loft gable-end wall (floor 1) at the front gable, so the loft window
      // has a same-floor source wall to align to and the renderer clips it to
      // the roof from the loft floor up. Coincident with the gable plane, so
      // it stays inside the envelope.
      const loftGableSpan = ridgeAlongZ
        ? { x1: bounds.x, z1: 0, x2: bounds.x + bounds.w, z2: 0 }
        : { x1: 0, z1: bounds.z, x2: 0, z2: bounds.z + bounds.d };
      const loftGableBounds = ridgeAlongZ
        ? { x: bounds.x, z: -0.25, w: bounds.w, d: 0.5 }
        : { x: -0.25, z: bounds.z, w: 0.5, d: bounds.d };
      (artifact.exteriorWalls as unknown[]).push({
        id: 'ext-l1-front', levelFrameId: 'floor-1', levelIndex: 1, floor: 1,
        kind: 'solidExterior', wallKind: 'solidExterior', facing: ridgeAlongZ ? 'N' : 'W',
        sourceAnchorId: 'ext-l1-front', span: loftGableSpan, bounds: loftGableBounds,
      });
      // Loft daylight window, hosted on the loft gable wall, drawn at loft sill
      // height (the elevation reads levelIndex/the win-l1 id -> loft base).
      const loftCtr = ridgeAlongZ ? bounds.x + bounds.w / 2 : bounds.z + bounds.d / 2;
      (artifact.windows as unknown[]).push({
        id: 'win-l1-loft', levelFrameId: 'floor-1', levelIndex: 1, floor: 1,
        wallId: 'ext-l1-front', windowKind: windowKindFor('room-loft'), facing: ridgeAlongZ ? 'N' : 'W',
        roomIds: ['room-loft', 'exterior'],
        span: ridgeAlongZ
          ? { x1: loftCtr - 2, z1: 0, x2: loftCtr + 2, z2: 0 }
          : { x1: 0, z1: loftCtr - 2, x2: 0, z2: loftCtr + 2 },
      });
      // Ladder up from the hall (present in every program) at the loft band edge.
      (artifact.fixtures as unknown[]).push({
        id: 'fx-loft-ladder', roomId: 'room-hall', type: 'loft_access_ladder', floor: 0,
        // Clamp into the hall's ACTUAL rect. It used to clamp to the footprint,
        // which was right only while the hall spanned the full width; with a
        // circulation pocket that put the ladder outside the room it belongs to.
        bounds: (() => {
          const hall = (intent.rooms ?? []).find((room) => room.id === 'room-hall');
          const lo = hall ? hall.x + 0.25 : 0;
          const hi = hall ? hall.x + hall.w - 3.25 : widthFt - 3;
          return { x: Math.max(lo, Math.min(bounds.x, hi)), z: 12.5, w: 3, d: 3 };
        })(),
        clearance: { frontFt: 3, doorSwingClear: true, note: 'ladder up to loft' },
        sourceAnchorId: 'fx-loft-ladder',
      });
      // The loft floor sits ~LOFT_BASE_FT ft above the level below and is open to
      // below along the two long edges of the headroom band (the gable ends are
      // closed by the roof). IRC R312.1 requires a 36 in guard there, so emit a
      // low guard rail on each open edge. wallKind 'lowGuardRail' matches the
      // form the traced lofts use and the drawing classifier tags as a wall, so
      // it renders and never silently leaves the loft unguarded.
      const guardHeightFt = 3; // 36 in minimum guard height
      const guardEdges = ridgeAlongZ
        ? [
          { id: 'iw-l1-loft-guard-w', facing: 'W', span: { x1: bounds.x, z1: bounds.z, x2: bounds.x, z2: bounds.z + bounds.d }, bounds: { x: bounds.x - 0.1, z: bounds.z, w: 0.2, d: bounds.d } },
          { id: 'iw-l1-loft-guard-e', facing: 'E', span: { x1: bounds.x + bounds.w, z1: bounds.z, x2: bounds.x + bounds.w, z2: bounds.z + bounds.d }, bounds: { x: bounds.x + bounds.w - 0.1, z: bounds.z, w: 0.2, d: bounds.d } },
        ]
        : [
          { id: 'iw-l1-loft-guard-n', facing: 'N', span: { x1: bounds.x, z1: bounds.z, x2: bounds.x + bounds.w, z2: bounds.z }, bounds: { x: bounds.x, z: bounds.z - 0.1, w: bounds.w, d: 0.2 } },
          { id: 'iw-l1-loft-guard-s', facing: 'S', span: { x1: bounds.x, z1: bounds.z + bounds.d, x2: bounds.x + bounds.w, z2: bounds.z + bounds.d }, bounds: { x: bounds.x, z: bounds.z + bounds.d - 0.1, w: bounds.w, d: 0.2 } },
        ];
      for (const edge of guardEdges) {
        (artifact.interiorWalls as unknown[]).push({
          id: edge.id, levelFrameId: 'floor-1', levelIndex: 1, floor: 1,
          kind: 'lowGuardRail', wallKind: 'lowGuardRail', guardHeightFt,
          facing: edge.facing, span: edge.span, bounds: edge.bounds,
          sourceAnchorId: edge.id,
        });
      }
      // Surface what's modeled vs what still needs detailing — the plan provides
      // the guard, but baluster spacing/attachment are shop-drawing scope (input
      // honesty, P5 — same channel as the bath-downgrade note).
      notes.push(
        `loft is open to below (~${LOFT_BASE_FT} ft above the level below); a ${Math.round(guardHeightFt * 12)} in guard rail is provided on its open sides per IRC R312.1 `
        + `— verify guard height, baluster spacing (≤ 4 in), and attachment in shop drawings`,
      );
    }
  }

  // --- Program reconciliation, after the loft is (or is not) built ----------
  // Both of these were PARSED and CONSUMED by the brief reader — so they never
  // reached the `unparsed` echo either — and then nothing honoured them and
  // nothing said so. A token the parser claims to understand and the compiler
  // ignores is worse than one it admits it cannot read.
  const builtLevels = loftBuilt ? 2 : 1;

  // A storey count is a different building, not a degraded one: refuse, the way
  // an over-cap bedroom count is refused, rather than shipping a bungalow.
  if (typeof intent.requestedLevels === 'number' && intent.requestedLevels > builtLevels) {
    return {
      ok: false,
      errors: [
        `requested ${intent.requestedLevels} storeys; this generator builds a single storey plus an optional loft `
        + `(ask for "with loft" on an a-frame, gable, gambrel or barn roof). It has no multi-storey template.`,
      ],
    };
  }

  // A loft the roof cannot host is a valid plan minus one feature — surface it.
  if (intent.hasLoft && builtLevels < 2) {
    notes.push(
      `requested a loft; built none — a ${roof.style} roof leaves no band with the headroom IRC R305 requires `
      + `for a habitable loft. An a-frame, gable, gambrel or barn roof can host one.`,
    );
  }

  return { ok: true, errors: [], notes: notes.length ? notes : undefined, artifact };
}

/**
 * Deterministic parametric template used when no OpenAI key is configured.
 * Band layout: front band (living/kitchen, plus bath for 3-bed), full-width
 * hall band, rear bedroom band. All coordinates on the 4 ft grid.
 *
 * Footprint width is chosen from per-program candidates: the largest that
 * fits the lot's buildable envelope (lot minus setbacks) and the brief's
 * max square footage. A-frames have a single width per program because the
 * steep profile (eave 1 ft, ridge 18 ft) leaves usable headroom only in the
 * central column — habitable rooms span toward the ridge and wet rooms
 * (bath/laundry, which R305 holds to 6'8" minimum everywhere) sit in the
 * center; only storage/closets occupy the low eave edges. Gables (eave 8 ft)
 * have headroom everywhere, so they offer narrower variants for small lots.
 * If even the smallest candidate cannot fit, the smallest is emitted and
 * compileIntent reports the honest envelope failure.
 */
/** The kit's pitched archetype, in degrees — measured, not chosen by us. */
const KIT_PITCH_DEG = SKYLARK_ROOF_PITCHES_DEG.filter((p) => p > 0).slice(-1)[0] ?? 0;

/**
 * Ridge height for the a-frame/gable family.
 *
 * A kit-buildable gable is not a style of its own — it is the same gable with
 * its ridge DERIVED from the kit's pitch instead of a house number, so the roof
 * lands exactly on a stock block. Everything downstream (elevations, 3D clip,
 * headroom) reads the resulting planes and needs no knowledge of the kit.
 */
/**
 * The lowest ridge at or above `baseRidgeFt` that yields a loft on the 4 ft grid.
 *
 * A loft used to be snapped to a 4 ft SIZE but placed at whatever offset the
 * headroom band began, so every loft plan shipped a WH-GRID-4FT failure. Holding
 * the roof fixed, that is unfixable: the a-frame's headroom envelope is exactly
 * as wide as its band (zero slack), so the only grid-aligned option is a 4 ft
 * loft, below MIN_LOFT_SPAN_FT.
 *
 * The roof is the variable nobody was varying. Raising the ridge widens the
 * envelope until a grid-aligned band fits — and the band that fits is WIDER than
 * the one it replaces (8 ft -> 12 ft), so grid compliance buys a bigger loft
 * rather than costing one.
 *
 * Searched against buildLoft itself rather than hardcoding the answer, so this
 * stays correct if spans, eaves or MIN_LOFT_SPAN_FT change.
 */
const LOFT_RIDGE_SEARCH_STEP_FT = 0.25;
const LOFT_RIDGE_SEARCH_LIMIT_FT = 12;

function ridgeForGridAlignedLoft(
  roof: { style: string; ridgeAxis: 'x' | 'z'; eaveHeightFt: number },
  baseRidgeFt: number,
  widthFt: number,
  depthFt: number,
): number {
  const onGrid = (value: number) => Math.abs(value / 4 - Math.round(value / 4)) < 1e-6;
  for (let ridge = baseRidgeFt; ridge <= baseRidgeFt + LOFT_RIDGE_SEARCH_LIMIT_FT; ridge += LOFT_RIDGE_SEARCH_STEP_FT) {
    const loft = buildLoft({ ridgeAxis: roof.ridgeAxis, ridgeHeightFt: ridge, eaveHeightFt: roof.eaveHeightFt }, widthFt, depthFt);
    if (!loft) continue;
    const { x, z, w, d } = loft.bounds;
    if (onGrid(x) && onGrid(z) && onGrid(w) && onGrid(d)) return ridge;
  }
  // No ridge within the search window aligns it; keep the design height rather
  // than inventing an arbitrary one.
  return baseRidgeFt;
}

function gableRidgeFt(
  style: string,
  widthFt: number,
  brief: { hasLoft?: boolean; kitBuildable?: boolean },
): number {
  if (style === 'a-frame') {
    return brief.hasLoft
      ? ridgeForGridAlignedLoft({ style, ridgeAxis: 'z', eaveHeightFt: 1 }, 18, widthFt, widthFt)
      : 18;
  }
  if (brief.kitBuildable && KIT_PITCH_DEG > 0) {
    return ridgeHeightForPitchFt(
      { style, ridgeAxis: 'z', ridgeHeightFt: 0, eaveHeightFt: 8 },
      { widthFt, depthFt: widthFt },
      KIT_PITCH_DEG,
    );
  }
  return brief.hasLoft
    ? ridgeForGridAlignedLoft({ style, ridgeAxis: 'z', eaveHeightFt: 8 }, 20, widthFt, widthFt)
    : 14;
}

export function mockIntentFromBrief(brief: { bedrooms?: number; baths?: number; roofStyle?: string; maxSqft?: number; hasLoft?: boolean; kitBuildable?: boolean; levels?: number; lot?: GenerationIntent['lot'] }): GenerationIntent {
  const bedrooms = Math.max(1, Math.min(4, brief.bedrooms ?? 2));
  const style: 'a-frame' | 'gable' | 'flat' | 'shed' | 'hip' | 'gambrel' | 'barn' = brief.roofStyle === 'gable' ? 'gable'
    : brief.roofStyle === 'flat' ? 'flat'
      : brief.roofStyle === 'shed' ? 'shed'
        : brief.roofStyle === 'hip' ? 'hip'
          : brief.roofStyle === 'gambrel' ? 'gambrel'
            : brief.roofStyle === 'barn' ? 'barn'
              : 'a-frame';
  // Second bath is supported on the primary footprints only (2-bed at 28 ft,
  // 3-bed at 36 ft); 1-bed programs stay single-bath.
  // A 3-bed defaults to TWO baths. One bath for three bedrooms is not a normal
  // house, and Den's own 3-bed (outpost-medium) has two; the default was 1 only
  // because the old rear band could not host a second. It can now.
  const bathsRequested = bedrooms === 1
    ? 1
    : Math.max(1, Math.min(MAX_TEMPLATE_BATHS, Math.round(brief.baths ?? (bedrooms >= 3 ? 2 : 1))));
  // Can the OUTER 8 ft bay host a bedroom? On a 36 ft a-frame it cannot: the
  // ceiling clears the 5 ft a bed needs across only 4.5 ft of x 28-36, so a
  // queen there is half under the eave. Every other style keeps 8.5 ft clear
  // (measured, not assumed). This decides the 3-bed layout, and with it whether
  // a second bath fits -- the wide Bedroom 3 the a-frame needs consumes the
  // column the second bath would have used. The a-frame is already the
  // low-eave exception elsewhere here (it is refused outright at 4 bedrooms).
  const outerBayHostsBedroom = () => style !== 'a-frame';
  const hostsTwoBaths = (w: number) => (bedrooms === 2 && w === 28) || (bedrooms === 3 && w === 36);

  // Candidate footprints, largest first. Gables offer narrow/shallow variants
  // for small lots; the constraint engine's default 35% coverage cap counts
  // as a fit criterion so generated plans never fail their own report.
  // Flat, shed, hip, and gambrel all keep full headroom across the floor (eave
  // ≥ 7 ft, or a slope that still clears it), so they reuse the gable footprint
  // set — the most permissive.
  const gableFps: Record<number, Array<[number, number]>> = {
    1: [[28, 28], [24, 28], [20, 28], [20, 24]],
    2: [[28, 28], [24, 28]],
    3: [[36, 28], [28, 28]],
    4: [[48, 28]],
  };
  const fp = (n: number): Record<'a-frame' | 'gable' | 'flat' | 'shed' | 'hip' | 'gambrel' | 'barn', Array<[number, number]>> => {
    // a-frame's low eave can't host 3-across (36) beyond 3 beds; for n=4 it is
    // refused at compile, so its footprint here is only a placeholder.
    const aframe: Array<[number, number]> = n >= 3 ? [[36, 28]] : [[28, 28]];
    return { 'a-frame': aframe, gable: gableFps[n], flat: gableFps[n], shed: gableFps[n], hip: gableFps[n], gambrel: gableFps[n], barn: gableFps[n] };
  };
  const CANDIDATE_FOOTPRINTS: Record<number, Record<'a-frame' | 'gable' | 'flat' | 'shed' | 'hip' | 'gambrel' | 'barn', Array<[number, number]>>> = {
    1: fp(1), 2: fp(2), 3: fp(3), 4: fp(4),
  };
  const candidates = CANDIDATE_FOOTPRINTS[bedrooms][style];
  const setbacks = brief.lot?.setbacksFt ?? {};
  const lotValid = brief.lot && Number.isFinite(brief.lot.widthFt) && Number.isFinite(brief.lot.depthFt);
  const envelope = lotValid
    ? {
      w: brief.lot!.widthFt - (setbacks.left ?? 0) - (setbacks.right ?? 0),
      d: brief.lot!.depthFt - (setbacks.front ?? 0) - (setbacks.rear ?? 0),
    }
    : null;
  const maxCoverageSqft = lotValid
    ? brief.lot!.widthFt * brief.lot!.depthFt * (brief.lot!.maxCoverageRatio ?? DEFAULT_MAX_COVERAGE_RATIO)
    : null;
  const fits = ([w, d]: [number, number]) =>
    (!envelope || (w <= envelope.w + EPS && d <= envelope.d + EPS))
    && (!brief.maxSqft || w * d <= brief.maxSqft + EPS)
    && (!maxCoverageSqft || w * d <= maxCoverageSqft + EPS);
  // Prefer a footprint that can host the requested bath count; if none fits
  // the lot/size limits, fall back to the best single-bath fit.
  const twoBathChoice = bathsRequested === 2 ? candidates.filter(([w]) => hostsTwoBaths(w)).find(fits) : undefined;
  const [widthFt, depthFt] = twoBathChoice ?? candidates.find(fits) ?? candidates[candidates.length - 1];
  const baths = bathsRequested === 2 && hostsTwoBaths(widthFt) ? 2 : 1;

  const rooms: IntentRoom[] = [];
  const doors: IntentDoor[] = [];
  const windows: IntentWindow[] = [];
  const openings: IntentOpening[] = [];

  // Front band (z 0-12) and full-width hall band (z 12-16). The living room
  // takes the west column; its width shrinks with the footprint.
  const livingW = (bedrooms === 3 ? widthFt === 36 : widthFt > 20) ? 16 : 12;
  {
    // THE 3-BED OPEN CORE IS NOT BLOCKED, and the claim here that it was should
    // be read as retracted. What failed then was one particular layout: a 12 ft
    // rear band with off-grid widths (12/6/9/9) and a bath pushed out to the
    // eave. Using the FULL 16 ft rear depth -- which only became available once
    // the corridor shrank -- the same 36 ft footprint takes an open core, three
    // bedrooms over 70 sq ft and two baths clear of the eave. Checked against
    // every roof style including the a-frame before this was written, rather
    // than reasoned about a second time.
    //
    // So the 3-bed now uses the same zoned core as every other program, and the
    // bath it used to wedge between living and kitchen moves to the rear band.
    // OPEN CORE, AS ZONES. Reading Den's own drawing corrected this: they do
    // NOT merge the core into one room labelled "Living / Dining / Kitchen".
    // a-frame-22 calls out Entry(1), Kitchen(2), Dining(3) and Living(4) as
    // four separately numbered regions of ONE wall-free volume. The openness is
    // the absence of partitions, not the absence of names -- and the names are
    // most of what makes their plans readable.
    //
    // So the core is one volume divided into labelled zones. No wall is derived
    // between two zones, and the panel-grid gate skips them because they are
    // not physical boundaries. Each still has to be a legal room in its own
    // right where the code cares: Living and Dining are habitable (70 sq ft,
    // 7 ft minimum dimension), Kitchen is exempt from both, and Entry is
    // non-habitable, so a shallow entry zone triggers nothing.
    const zone = (id: string, label: string, type: string, x: number, z: number, w: number, d: number): IntentRoom =>
      ({ id, label, type, x, z, w, d, semanticZone: true });
    // The 4 ft entry zone straddles the door. Dining needs 70 sq ft and a 7 ft
    // dimension, which a narrow plan cannot give it without starving the
    // kitchen -- so below 28 ft the dining zone folds back into Living rather
    // than shipping a 32 sq ft "Dining" that fails R304.1.
    // The zone split is deliberately NOT livingW. livingW sizes the old walled
    // living room; using it here left only 8 ft for the rest of the band, too
    // little for a dining zone, so Den's Dining callout never appeared. A 12 ft
    // living zone leaves 12 ft for Dining over Kitchen on a 28 ft plan, and
    // narrower plans simply fall through to Living + Entry + Kitchen.
    const entryX = 12;
    const restX = entryX + 4;
    rooms.push(zone('room-living', 'Living Room', 'living', 0, 0, entryX, 12));
    rooms.push(zone('room-entry', 'Entry', 'entry', entryX, 0, 4, 12));
    if (widthFt - restX >= 12) {
      rooms.push(zone('room-dining', 'Dining', 'dining', restX, 0, widthFt - restX, 8));
      rooms.push(zone('room-kitchen', 'Kitchen', 'kitchen', restX, 8, widthFt - restX, 4));
    } else {
      rooms.push(zone('room-kitchen', 'Kitchen', 'kitchen', restX, 0, widthFt - restX, 12));
    }
  }
  // The east window must be bound to the zone that actually CONTAINS it, not to
  // whatever the kitchen is called: with a dining zone present the kitchen sits
  // in the rear 4 ft of the band, so a window at z 4-8 stands in the dining
  // zone. A window attributed to a room it does not touch is a daylight credit
  // claimed for the wrong space.
  const eastZoneId = rooms.some((room) => room.id === 'room-dining') ? 'room-dining' : 'room-kitchen';
  windows.push({ id: 'win-kitchen-e', roomId: eastZoneId, span: { x1: widthFt, z1: 4, x2: widthFt, z2: 8 } });
  // CIRCULATION POCKET vs. full-width corridor.
  //
  // Den does not run a ribbon across the plan. a-frame-22 has no corridor at
  // all -- it has a 7x8 ft "Open Circulation" ZONE (19% of the span) that the
  // bedroom and bath open off, and outpost-medium's Hallway spans only 24 ft of
  // a 48 ft plan. Our 4 ft x full-width hall was the outlier at 100%.
  //
  // So on the plans that can take it, the hall becomes an 8x8 pocket: square,
  // reached straight off the Entry zone, with every rear room opening onto it.
  // It is a semanticZone for the same reason Den types theirs as
  // `open_circulation_zone` -- circulation and entry are one continuous space,
  // so no wall is derived between them.
  //
  // It keeps the id `room-hall`: the id is referenced in over twenty places
  // (every rear door, the loft ladder), and renaming it to match the new label
  // would be a large rename for no behavioural gain -- exactly the kind of
  // churn that hid a bug the last time a global room rename went through here.
  const usePocket = widthFt === 28 && (bedrooms === 1 || bedrooms === 2);
  // A 3-bed on 36 ft cannot use a pocket -- a square pocket has only three free
  // edges once one faces the core, and this program needs five rooms off the
  // circulation. Den hit the same wall and answered it the same way:
  // outpost-medium, their 3-bed, has a Hallway. It is a corridor only in shape,
  // not in proportion, spanning 24 ft of a 48 ft plan. Ours spans 16 of 36.
  // The 3-bed shortens its hall only where Bedroom 3 can take the outer bay.
  // On the a-frame it cannot, so Bedroom 3 widens to 12 ft, the hall has no
  // room to shorten, and it keeps the full-width form. That is a real limit of
  // a 36 ft plan under a 1 ft eave, recorded rather than designed around: the
  // a-frame 3-bed still gains the open core, it just keeps its corridor.
  // THE 3-BED KEEPS ITS FULL-WIDTH HALL, and the reason is structural rather
  // than stylistic. A floor needs an interior wall line covering 70% of the
  // width or the joists span the whole 28 ft depth, and every door pierces that
  // line: at z=16 the 3-bed spends four 2.5 ft doorways, so the run has to start
  // at the full 36 ft to clear 25.2 ft after them. A hall stopping short of
  // either wall caps the run at 28 ft, which cannot survive even one door.
  // So no-corridor stays UNMET for this program. Shortening the hall here would
  // mean either a plan the buildability gate refuses or a bedroom reached
  // through another room, and neither is worth a fidelity point.
  const useShortHall = false;
  const hallRect = usePocket
    ? { x: 12, z: 12, w: 8, d: 8 }
    : { x: 0, z: 12, w: widthFt, d: 4 };
  rooms.push(usePocket || useShortHall
    ? { id: 'room-hall', label: 'Circulation', type: 'hall', ...hallRect, semanticZone: true }
    : { id: 'room-hall', label: 'Hall', type: 'hall', ...hallRect });
  // Entry sits on the inner (ridge-side) half of the living facade so the
  // door clears A-frame headroom; the living window takes the outer half.
  //
  // With zones the door belongs to the Entry zone, so it must be CENTRED ON
  // THAT ZONE and not derived from livingW. `livingW + 2` was 18 while the
  // Entry zone runs x 12-16, so the front door was drawn standing in the dining
  // zone while claiming to open into the Entry. Read the zone's real centre.
  const entryRoom = rooms.find((room) => room.id === 'room-entry');
  const entryMid = entryRoom ? entryRoom.x + entryRoom.w / 2 : livingW * 0.75;
  doors.push({ id: 'door-entry', fromRoomId: 'exterior', toRoomId: entryRoom ? 'room-entry' : 'room-living', openingType: 'exteriorDoor', span: { x1: entryMid - 1.5, z1: 0, x2: entryMid + 1.5, z2: 0 } });
  windows.push({ id: 'win-living-n', roomId: 'room-living', span: livingW === 16 ? { x1: 4, z1: 0, x2: 8, z2: 0 } : { x1: 3, z1: 0, x2: 6, z2: 0 } });
  // With a pocket there is no living/hall opening to punch. The living zone
  // meets the pocket at a corner, not an edge; and the pocket's open edge to the
  // Entry and Kitchen zones carries no WALL, so there is no aperture there to
  // model -- an opening is a hole in a wall, and two zones of one continuous
  // volume have neither. Emitting one anyway failed the standing rule that every
  // opening sits on a wall, which was right to stop it.
  if (!usePocket && !useShortHall) {
    // Keep the opening inside the living zone it is attributed to; livingW
    // describes the walled 3-bed living room and overruns the 12 ft zone.
    const livingRoom = rooms.find((r) => r.id === 'room-living');
    const span = snapOpeningToModule(4, (livingRoom ? livingRoom.x + livingRoom.w : livingW) - 2);
    openings.push({ id: 'open-living-hall', fromRoomId: 'room-living', toRoomId: 'room-hall', span: { x1: span.lo, z1: 12, x2: span.hi, z2: 12 } });
  }

  // Rear band (z 16 to depth; 12 ft deep on the standard 28 ft plans, 8 ft on
  // the compact 20x24 variant).
  const rearD = depthFt - 16;
  if (bedrooms === 1 && usePocket) {
    // Rear band wraps the pocket on three sides. Every room opens directly onto
    // it -- no room is reached through another habitable room.
    // WET ROOMS STAY IN THE CENTRAL COLUMN. R305.1 gives bathrooms and laundry a
    // hard 6 ft 8 in minimum measured at their LOWEST point -- unlike a bedroom,
    // which may sit partly under a slope and is judged on the area clearing 5 ft.
    // An 8x8 laundry out at x20-28 measured 2.4 ft at the eave and failed. Only
    // storage and closets, which carry no ceiling rule at all, can take the
    // eave edge.
    rooms.push(
      { id: 'room-bed1', label: 'Bedroom 1', type: 'bedroom', x: 0, z: 12, w: 12, d: 16 },
      { id: 'room-closet', label: 'Closet', type: 'storage', x: 20, z: 12, w: 8, d: 8 },
      { id: 'room-bath', label: 'Bath', type: 'bathroom', x: 12, z: 20, w: 8, d: 4 },
      { id: 'room-laundry', label: 'Laundry', type: 'laundry', x: 12, z: 24, w: 8, d: 4 },
      { id: 'room-storage', label: 'Storage', type: 'storage', x: 20, z: 20, w: 8, d: 8 },
    );
    doors.push(
      { id: 'door-bed1', fromRoomId: 'room-hall', toRoomId: 'room-bed1', openingType: 'interiorDoor', span: { x1: 12, z1: 14, x2: 12, z2: 16.5 } },
      { id: 'door-closet', fromRoomId: 'room-hall', toRoomId: 'room-closet', openingType: 'interiorDoor', span: { x1: 20, z1: 14, x2: 20, z2: 16.5 } },
      { id: 'door-bath', fromRoomId: 'room-hall', toRoomId: 'room-bath', openingType: 'interiorDoor', span: { x1: 14.75, z1: 20, x2: 17.25, z2: 20 } },
      { id: 'door-laundry', fromRoomId: 'room-bath', toRoomId: 'room-laundry', openingType: 'interiorDoor', span: { x1: 14.75, z1: 24, x2: 17.25, z2: 24 } },
      { id: 'door-storage', fromRoomId: 'room-closet', toRoomId: 'room-storage', openingType: 'interiorDoor', span: { x1: 22, z1: 20, x2: 24.5, z2: 20 } },
    );
    windows.push({ id: 'win-bed1-w', roomId: 'room-bed1', span: { x1: 0, z1: 18, x2: 0, z2: 22 } });
  } else if (bedrooms === 1) {
    rooms.push(
      { id: 'room-bed1', label: 'Bedroom 1', type: 'bedroom', x: 0, z: 16, w: 12, d: rearD },
      { id: 'room-bath', label: 'Bath', type: 'bathroom', x: 12, z: 16, w: 8, d: 4 },
    );
    doors.push(
      { id: 'door-bed1', fromRoomId: 'room-hall', toRoomId: 'room-bed1', openingType: 'interiorDoor', span: { x1: 4, z1: 16, x2: 6.5, z2: 16 } },
      { id: 'door-bath', fromRoomId: 'room-hall', toRoomId: 'room-bath', openingType: 'interiorDoor', span: { x1: 14, z1: 16, x2: 16.5, z2: 16 } },
    );
    windows.push({ id: 'win-bed1-w', roomId: 'room-bed1', span: { x1: 0, z1: 16 + rearD / 2 - 2, x2: 0, z2: 16 + rearD / 2 + 2 } });
    if (widthFt === 20) {
      rooms.push({ id: 'room-storage', label: 'Storage', type: 'storage', x: 12, z: 20, w: 8, d: depthFt - 20 });
      doors.push({ id: 'door-storage', fromRoomId: 'room-bath', toRoomId: 'room-storage', openingType: 'interiorDoor', span: { x1: 14, z1: 20, x2: 16.5, z2: 20 } });
    } else {
      rooms.push(
        { id: 'room-laundry', label: 'Laundry', type: 'laundry', x: 12, z: 20, w: 8, d: 4 },
        { id: 'room-storage', label: 'Storage', type: 'storage', x: 12, z: 24, w: 8, d: 4 },
        { id: 'room-closet', label: 'Closet', type: 'storage', x: 20, z: 16, w: widthFt - 20, d: 12 },
      );
      doors.push(
        { id: 'door-laundry', fromRoomId: 'room-bath', toRoomId: 'room-laundry', openingType: 'interiorDoor', span: { x1: 14, z1: 20, x2: 16.5, z2: 20 } },
        { id: 'door-storage', fromRoomId: 'room-laundry', toRoomId: 'room-storage', openingType: 'interiorDoor', span: { x1: 14, z1: 24, x2: 16.5, z2: 24 } },
        { id: 'door-closet', fromRoomId: 'room-hall', toRoomId: 'room-closet', openingType: 'interiorDoor', span: { x1: (20 + widthFt) / 2 - 1.25, z1: 16, x2: (20 + widthFt) / 2 + 1.25, z2: 16 } },
      );
    }
  } else if (bedrooms === 2) {
    if (usePocket) {
      // Bedrooms flank the pocket and run the full 16 ft depth of the rear
      // band; the wet column sits behind it. Bedroom 2 is 8 ft rather than the
      // old 12 because the pocket takes the middle -- 128 sq ft with 96 of it
      // above the 5 ft cutoff even on the a-frame, checked before the change.
      rooms.push(
        { id: 'room-bed1', label: 'Bedroom 1', type: 'bedroom', x: 0, z: 12, w: 12, d: 16 },
        { id: 'room-bed2', label: 'Bedroom 2', type: 'bedroom', x: 20, z: 12, w: 8, d: 16 },
        { id: 'room-bath', label: 'Bath', type: 'bathroom', x: 12, z: 20, w: 8, d: 4 },
        baths === 2
          ? { id: 'room-bath2', label: 'Bath 2', type: 'bathroom', x: 12, z: 24, w: 8, d: 4 }
          : { id: 'room-storage', label: 'Storage', type: 'storage', x: 12, z: 24, w: 8, d: 4 },
      );
      doors.push(
        { id: 'door-bed1', fromRoomId: 'room-hall', toRoomId: 'room-bed1', openingType: 'interiorDoor', span: { x1: 12, z1: 14, x2: 12, z2: 16.5 } },
        { id: 'door-bed2', fromRoomId: 'room-hall', toRoomId: 'room-bed2', openingType: 'interiorDoor', span: { x1: 20, z1: 14, x2: 20, z2: 16.5 } },
        { id: 'door-bath', fromRoomId: 'room-hall', toRoomId: 'room-bath', openingType: 'interiorDoor', span: { x1: 14.75, z1: 20, x2: 17.25, z2: 20 } },
        baths === 2
          // Ensuite: Bath 2 opens from Bedroom 2 through the shared wall.
          ? { id: 'door-bath2', fromRoomId: 'room-bed2', toRoomId: 'room-bath2', openingType: 'interiorDoor', span: { x1: 20, z1: 25.25, x2: 20, z2: 27.75 } }
          : { id: 'door-storage', fromRoomId: 'room-bath', toRoomId: 'room-storage', openingType: 'interiorDoor', span: { x1: 14.75, z1: 24, x2: 17.25, z2: 24 } },
      );
    } else if (widthFt === 28) {
      rooms.push(
        { id: 'room-bed1', label: 'Bedroom 1', type: 'bedroom', x: 0, z: 16, w: 12, d: 12 },
        { id: 'room-bath', label: 'Bath', type: 'bathroom', x: 12, z: 16, w: 4, d: 8 },
        baths === 2
          ? { id: 'room-bath2', label: 'Bath 2', type: 'bathroom', x: 12, z: 24, w: 4, d: 4 }
          : { id: 'room-storage', label: 'Storage', type: 'storage', x: 12, z: 24, w: 4, d: 4 },
        { id: 'room-bed2', label: 'Bedroom 2', type: 'bedroom', x: 16, z: 16, w: 12, d: 12 },
      );
      doors.push(
        { id: 'door-bed1', fromRoomId: 'room-hall', toRoomId: 'room-bed1', openingType: 'interiorDoor', span: { x1: 4, z1: 16, x2: 6.5, z2: 16 } },
        { id: 'door-bath', fromRoomId: 'room-hall', toRoomId: 'room-bath', openingType: 'interiorDoor', span: { x1: 12.75, z1: 16, x2: 15.25, z2: 16 } },
        { id: 'door-bed2', fromRoomId: 'room-hall', toRoomId: 'room-bed2', openingType: 'interiorDoor', span: { x1: 18.5, z1: 16, x2: 21, z2: 16 } },
        baths === 2
          // Ensuite: Bath 2 opens from Bedroom 2 through the shared wall.
          ? { id: 'door-bath2', fromRoomId: 'room-bed2', toRoomId: 'room-bath2', openingType: 'interiorDoor', span: { x1: 16, z1: 24.75, x2: 16, z2: 27.25 } }
          : { id: 'door-storage', fromRoomId: 'room-bath', toRoomId: 'room-storage', openingType: 'interiorDoor', span: { x1: 13, z1: 24, x2: 15.5, z2: 24 } },
      );
    } else {
      // 24 ft gable: bedrooms 8 ft wide (96 sq ft) with the wet column centered.
      rooms.push(
        { id: 'room-bed1', label: 'Bedroom 1', type: 'bedroom', x: 0, z: 16, w: 8, d: 12 },
        { id: 'room-bath', label: 'Bath', type: 'bathroom', x: 8, z: 16, w: 8, d: 4 },
        { id: 'room-storage', label: 'Storage', type: 'storage', x: 8, z: 20, w: 8, d: 8 },
        { id: 'room-bed2', label: 'Bedroom 2', type: 'bedroom', x: 16, z: 16, w: 8, d: 12 },
      );
      doors.push(
        { id: 'door-bed1', fromRoomId: 'room-hall', toRoomId: 'room-bed1', openingType: 'interiorDoor', span: { x1: 3, z1: 16, x2: 5.5, z2: 16 } },
        { id: 'door-bath', fromRoomId: 'room-hall', toRoomId: 'room-bath', openingType: 'interiorDoor', span: { x1: 10.5, z1: 16, x2: 13, z2: 16 } },
        { id: 'door-bed2', fromRoomId: 'room-hall', toRoomId: 'room-bed2', openingType: 'interiorDoor', span: { x1: 18.5, z1: 16, x2: 21, z2: 16 } },
        { id: 'door-storage', fromRoomId: 'room-bath', toRoomId: 'room-storage', openingType: 'interiorDoor', span: { x1: 10, z1: 20, x2: 12.5, z2: 20 } },
      );
    }
    windows.push(
      { id: 'win-bed1-w', roomId: 'room-bed1', span: { x1: 0, z1: 20, x2: 0, z2: 24 } },
      { id: 'win-bed2-e', roomId: 'room-bed2', span: { x1: widthFt, z1: 20, x2: widthFt, z2: 24 } },
    );
  } else if (bedrooms === 3 && widthFt === 36) {
    // THE BEARING LINE IS THE CONSTRAINT HERE, not the room sizes. A floor needs
    // an interior wall line covering 70% of the width or the joists span the
    // whole 28 ft depth. My first version ran Bedrooms 1 and 3 the full depth
    // and left the walls at z=12 and z=16 broken into fragments -- 56% and 44%
    // -- so the plan had no continuous line and was correctly refused as
    // unbuildable. Holding every rear room to z 16-28 puts a real wall across
    // z=16 instead.
    // Bedroom 3 is 12 ft wide on EVERY roof, not just the a-frame. The narrow
    // outer bay only works where the roof allows it, and the door budget on the
    // bearing line does not allow a fifth doorway anyway -- so the wide bedroom
    // and the stacked ensuite are the layout everywhere, and one shape serves
    // all seven roof styles.
    const bed3X = 24;
    const twoBaths = baths === 2;
    // Two baths side by side where the wet column is 8 ft, stacked where the
    // wider Bedroom 3 narrows it to 4 -- the second then being an ensuite off
    // Bedroom 3, the only room it touches.
    const stacked = twoBaths;
    rooms.push(
      { id: 'room-bed1', label: 'Bedroom 1', type: 'bedroom', x: 0, z: 16, w: 12, d: 12 },
      { id: 'room-bed2', label: 'Bedroom 2', type: 'bedroom', x: 12, z: 16, w: 8, d: 12 },
      { id: 'room-bath', label: 'Bath', type: 'bathroom', x: 20, z: 16, w: 4, d: stacked ? 8 : 12 },
      // Where the hall is short it stops at Bedroom 3's edge, so Bedroom 3
      // reaches UP to z 12 and opens off the hall's east end. Where the hall
      // runs full width, Bedroom 3 opens off its south side like the others.
      { id: 'room-bed3', label: 'Bedroom 3', type: 'bedroom', x: bed3X, z: 16, w: widthFt - bed3X, d: 12 },
    );
    const bathMid = 22;
    doors.push(
      { id: 'door-bed1', fromRoomId: 'room-hall', toRoomId: 'room-bed1', openingType: 'interiorDoor', span: { x1: 8.75, z1: 16, x2: 11.25, z2: 16 } },
      { id: 'door-bed2', fromRoomId: 'room-hall', toRoomId: 'room-bed2', openingType: 'interiorDoor', span: { x1: 14.75, z1: 16, x2: 17.25, z2: 16 } },
      { id: 'door-bath', fromRoomId: 'room-hall', toRoomId: 'room-bath', openingType: 'interiorDoor', span: { x1: bathMid - 1.25, z1: 16, x2: bathMid + 1.25, z2: 16 } },
      { id: 'door-bed3', fromRoomId: 'room-hall', toRoomId: 'room-bed3', openingType: 'interiorDoor', span: { x1: bed3X + 1.5, z1: 16, x2: bed3X + 4, z2: 16 } },
    );
    if (stacked) {
      rooms.push({ id: 'room-bath2', label: 'Bath 2', type: 'bathroom', x: 20, z: 24, w: 4, d: 4 });
      doors.push({ id: 'door-bath2', fromRoomId: 'room-bed3', toRoomId: 'room-bath2', openingType: 'interiorDoor', span: { x1: 24, z1: 25, x2: 24, z2: 27.5 } });
    }
    windows.push(
      { id: 'win-bed1-w', roomId: 'room-bed1', span: { x1: 0, z1: 20, x2: 0, z2: 24 } },
      { id: 'win-bed2-s', roomId: 'room-bed2', span: { x1: 14, z1: depthFt, x2: 18, z2: depthFt } },
      { id: 'win-bed3-e', roomId: 'room-bed3', span: { x1: widthFt, z1: 20, x2: widthFt, z2: 24 } },
    );
  } else if (bedrooms === 3) {
    // With a second bath (36 ft only), Bedroom 2 narrows to 8 ft and the
    // freed 4 ft column hosts Bath 2 (toward the ridge) plus a walk-in
    // closet for Bedroom 3.
    // Single-bath 3-bed: the bath sits INBOARD in the rear band so the front
    // band can be one open core. Widths keep every bedroom past the 7 ft
    // minimum dimension (12, 9, 9 on a 36 ft plan) and past 70 sq ft.
    const bed2W = widthFt === 36 ? (baths === 2 ? 8 : 12) : 8;
    const bed3X = baths === 2 ? 24 : 12 + bed2W;
    rooms.push(
      { id: 'room-bed1', label: 'Bedroom 1', type: 'bedroom', x: 0, z: 16, w: 12, d: 12 },
      { id: 'room-bed2', label: 'Bedroom 2', type: 'bedroom', x: 12, z: 16, w: bed2W, d: 12 },
      { id: 'room-bed3', label: 'Bedroom 3', type: 'bedroom', x: bed3X, z: 16, w: widthFt - bed3X, d: 12 },
    );
    const bed2Mid = 12 + bed2W / 2;
    const bed3Mid = (bed3X + widthFt) / 2;
    doors.push(
      { id: 'door-bed1', fromRoomId: 'room-hall', toRoomId: 'room-bed1', openingType: 'interiorDoor', span: { x1: 4, z1: 16, x2: 6.5, z2: 16 } },
      { id: 'door-bed2', fromRoomId: 'room-hall', toRoomId: 'room-bed2', openingType: 'interiorDoor', span: { x1: bed2Mid - 1.25, z1: 16, x2: bed2Mid + 1.25, z2: 16 } },
      { id: 'door-bed3', fromRoomId: 'room-hall', toRoomId: 'room-bed3', openingType: 'interiorDoor', span: { x1: bed3Mid - 1.25, z1: 16, x2: bed3Mid + 1.25, z2: 16 } },
    );
    if (baths === 2) {
      rooms.push(
        { id: 'room-bath2', label: 'Bath 2', type: 'bathroom', x: 20, z: 16, w: 4, d: 4 },
        { id: 'room-closet', label: 'Closet', type: 'storage', x: 20, z: 20, w: 4, d: 8 },
      );
      doors.push(
        { id: 'door-bath2', fromRoomId: 'room-hall', toRoomId: 'room-bath2', openingType: 'interiorDoor', span: { x1: 20.75, z1: 16, x2: 23.25, z2: 16 } },
        { id: 'door-closet', fromRoomId: 'room-bed3', toRoomId: 'room-closet', openingType: 'interiorDoor', span: { x1: 24, z1: 22.75, x2: 24, z2: 25.25 } },
      );
    }
    windows.push(
      { id: 'win-bed1-w', roomId: 'room-bed1', span: { x1: 0, z1: 20, x2: 0, z2: 24 } },
      { id: 'win-bed2-s', roomId: 'room-bed2', span: { x1: bed2Mid - 2, z1: depthFt, x2: bed2Mid + 2, z2: depthFt } },
      { id: 'win-bed3-e', roomId: 'room-bed3', span: { x1: widthFt, z1: 20, x2: widthFt, z2: 24 } },
    );
  } else {
    // 4 bedrooms: a 48 ft rear band holds four bedrooms with a central full bath,
    // tiling z16-28 with no gap. All boundaries (0/12/24/32/40/48) sit on the 4 ft
    // structural grid. Bed1/Bed4 take the side walls for egress; Bed2/Bed3 take
    // the rear (south) wall. Walls + fixtures + R305/egress checks all generalize
    // from these rectangles (no per-room special casing).
    rooms.push(
      { id: 'room-bed1', label: 'Bedroom 1', type: 'bedroom', x: 0, z: 16, w: 12, d: 12 },
      { id: 'room-bed2', label: 'Bedroom 2', type: 'bedroom', x: 12, z: 16, w: 12, d: 12 },
      { id: 'room-bath', label: 'Bath', type: 'bathroom', x: 24, z: 16, w: 8, d: 12 },
      { id: 'room-bed3', label: 'Bedroom 3', type: 'bedroom', x: 32, z: 16, w: 8, d: 12 },
      { id: 'room-bed4', label: 'Bedroom 4', type: 'bedroom', x: 40, z: 16, w: 8, d: 12 },
    );
    doors.push(
      { id: 'door-bed1', fromRoomId: 'room-hall', toRoomId: 'room-bed1', openingType: 'interiorDoor', span: { x1: 4.75, z1: 16, x2: 7.25, z2: 16 } },
      { id: 'door-bed2', fromRoomId: 'room-hall', toRoomId: 'room-bed2', openingType: 'interiorDoor', span: { x1: 16.75, z1: 16, x2: 19.25, z2: 16 } },
      { id: 'door-bath', fromRoomId: 'room-hall', toRoomId: 'room-bath', openingType: 'interiorDoor', span: { x1: 26.75, z1: 16, x2: 29.25, z2: 16 } },
      { id: 'door-bed3', fromRoomId: 'room-hall', toRoomId: 'room-bed3', openingType: 'interiorDoor', span: { x1: 34.75, z1: 16, x2: 37.25, z2: 16 } },
      { id: 'door-bed4', fromRoomId: 'room-hall', toRoomId: 'room-bed4', openingType: 'interiorDoor', span: { x1: 42.75, z1: 16, x2: 45.25, z2: 16 } },
    );
    windows.push(
      { id: 'win-bed1-w', roomId: 'room-bed1', span: { x1: 0, z1: 20, x2: 0, z2: 24 } },
      { id: 'win-bed2-s', roomId: 'room-bed2', span: { x1: 16, z1: depthFt, x2: 20, z2: depthFt } },
      { id: 'win-bed3-s', roomId: 'room-bed3', span: { x1: 34, z1: depthFt, x2: 38, z2: depthFt } },
      { id: 'win-bed4-e', roomId: 'room-bed4', span: { x1: widthFt, z1: 20, x2: widthFt, z2: 24 } },
    );
  }

  // ENTRY DECK. Every Den cabin opens onto one, and it is the cheapest piece of
  // their character to earn: it sits OUTSIDE the conditioned footprint (Den's
  // a-frame-22 runs its decks from x -6.7..0 and 36..38), so it cannot disturb
  // the interior grid or any habitable-room rule.
  //
  // It is not free, though. A deck is a structure standing on the lot, so it
  // has to fit the buildable envelope AND the coverage cap -- compileIntent now
  // measures both against the built extent rather than the heated box. We take
  // the largest grid-aligned deck that fits and no more. On a tight lot that is
  // a modest entry porch; where nothing fits there is simply no deck, because
  // shrinking the house to make room for one would be a bad trade.
  {
    const sb = brief.lot?.setbacksFt ?? {};
    const envelopeD = brief.lot ? brief.lot.depthFt - (sb.front ?? 0) - (sb.rear ?? 0) : Infinity;
    const lotArea = brief.lot ? brief.lot.widthFt * brief.lot.depthFt : Infinity;
    const maxRatio = brief.lot?.maxCoverageRatio ?? DEFAULT_MAX_COVERAGE_RATIO;
    const areaBudget = brief.lot ? maxRatio * lotArea - widthFt * depthFt : Infinity;
    const depthRoom = envelopeD - depthFt;
    const entryMid = livingW * 0.75;

    let deck: { x: number; w: number; d: number } | null = null;
    outer: for (const deckD of [8, 4]) {
      if (deckD > depthRoom + EPS) continue;
      for (const deckW of [widthFt, 16, 12, 8].filter((w) => w <= widthFt)) {
        if (deckW * deckD > areaBudget + EPS) continue;
        // Centre on the entry door, snapped to the 4 ft panel grid and clamped
        // inside the facade so the deck never overhangs a corner.
        const x = Math.max(0, Math.min(widthFt - deckW, Math.round((entryMid - deckW / 2) / 4) * 4));
        deck = { x, w: deckW, d: deckD };
        break outer;
      }
    }
    if (deck) {
      rooms.push({
        id: 'room-deck',
        label: deck.w >= widthFt ? 'Deck' : 'Entry Deck',
        type: 'deck',
        x: deck.x,
        z: -deck.d,
        w: deck.w,
        d: deck.d,
      });
    }
  }

  return {
    name: `mock-${bedrooms}br-${style}`,
    footprint: { widthFt, depthFt },
    // A gable earns a loft only when it is steep enough to clear loft headroom;
    // a loft request raises the gable ridge so the central band qualifies.
    // Flat: ridge == eave (level). Shed: a single slope, high edge -> low edge.
    // Hip: ridge along the LONGER axis (a pyramid when square), eave around the
    // whole perimeter. A-frame/gable keep their sloped ridge/eave (a loft request
    // raises the gable ridge).
    roof: style === 'flat'
      ? { style, ridgeAxis: 'z' as const, ridgeHeightFt: FLAT_ROOF_HEIGHT_FT, eaveHeightFt: FLAT_ROOF_HEIGHT_FT }
      : style === 'shed'
        ? { style, ridgeAxis: 'z' as const, ridgeHeightFt: SHED_RIDGE_FT, eaveHeightFt: SHED_EAVE_FT }
        : style === 'hip'
          ? { style, ridgeAxis: (widthFt >= depthFt ? 'x' : 'z') as 'x' | 'z', ridgeHeightFt: HIP_RIDGE_FT, eaveHeightFt: HIP_EAVE_FT }
          : style === 'gambrel'
            ? {
              style,
              ridgeAxis: 'z' as const,
              // Gambrel had no loft awareness at all -- a fixed ridge whatever
              // the brief asked for. It needs the least of any style to clear
              // the grid, so it was failing WH-GRID-4FT for want of inches.
              ridgeHeightFt: brief.hasLoft
                ? ridgeForGridAlignedLoft({ style, ridgeAxis: 'z', eaveHeightFt: GAMBREL_EAVE_FT }, GAMBREL_RIDGE_FT, widthFt, widthFt)
                : GAMBREL_RIDGE_FT,
              eaveHeightFt: GAMBREL_EAVE_FT,
            }
            : style === 'barn'
              ? { style, ridgeAxis: (widthFt >= depthFt ? 'x' : 'z') as 'x' | 'z', ridgeHeightFt: BARN_RIDGE_FT, eaveHeightFt: BARN_EAVE_FT }
              : { style, ridgeAxis: 'z' as const, ridgeHeightFt: gableRidgeFt(style, widthFt, brief), eaveHeightFt: style === 'a-frame' ? 1 : 8 },
    lot: brief.lot ?? null,
    hasLoft: brief.hasLoft,
    // Carry the RAW request (unclamped) so compile can refuse an unbuildable
    // bedroom count instead of silently shipping the clamped 3-bed layout.
    requestedBedrooms: brief.bedrooms,
    // Carry the intended bath count so compile can SURFACE a downgrade (e.g. a
    // 2nd bath that the size/lot-constrained footprint couldn't host).
    // RAW, unclamped — `bathsRequested` above is already capped at
    // MAX_TEMPLATE_BATHS and forced to 1 for single-bedroom programs, so passing
    // it here made the honesty check compare 2 against 2 and stay silent while
    // "3 bath" quietly shipped 2. Same shape as the bedroom clamp fixed earlier.
    requestedBaths: typeof brief.baths === 'number' ? Math.round(brief.baths) : undefined,
    // Carry the ≤ sqft cap so compile can refuse a cap no template can meet,
    // instead of silently shipping a footprint larger than the user allowed.
    requestedMaxSqft: brief.maxSqft,
    kitBuildable: brief.kitBuildable,
    requestedLevels: brief.levels,
    // Carry the RAW requested roof style so compile can refuse an unimplemented
    // style instead of silently substituting the a-frame flattened above.
    requestedRoofStyle: brief.roofStyle,
    rooms,
    doors,
    windows,
    openings,
  };
}
