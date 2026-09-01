/**
 * The kit unit: one core, two side zones, one wet wall.
 *
 * Everything else in lib/kit takes geometry as given and asks whether it can be
 * bought, lifted or stood up. This module is the other direction — it is the
 * product itself, expressed as the few decisions that actually change what gets
 * built, with the consequences derived rather than chosen.
 *
 * THE ONE IDEA WORTH KNOWING. The extra sleeping space goes UP or OUT, and the
 * roof decides which — you do not get to pick both, and you do not get to pick
 * either independently of the roof:
 *
 *   tall ridge (a-frame, saltbox)   the section's outer corner is 1 ft high, so
 *                                   the side strip is 3% usable at 7 ft. It is a
 *                                   DECK. The volume is overhead, so the extra
 *                                   room is a LOFT.
 *   low ridge (gable, hip, shed)    the wall is full height to the edge, so
 *                                   there is no side strip at all and a SIDE
 *                                   BEDROOM works anywhere. There is no usable
 *                                   volume overhead, so there is no loft.
 *
 * Same core, same wet wall, same foundation. The roof moves the bedroom.
 */

import { BEARING_COVERAGE_RATIO } from '../build-validator.ts';
import { roofHeightAtFt, roofProfileAreaSqFt, round2 } from './panel-spec.ts';
import type { WallRunSpec, RoofPlaneSpec } from './panel-spec.ts';

/** IRC Appendix Q applies at or below this, lofts excluded from the count. */
export const APPENDIX_Q_MAX_SQFT = 400;

/** Heights that decide what a space may be called. */
export const HEIGHT = {
  /** R305.1 habitable. */ habitableFt: 7,
  /** R305.1.1 — no part of the required area may be under this. */ slopedFloorFt: 5,
  /** R305.1 exc. — bathroom at the fixture front clearance. */ bathFt: 6 + 8 / 12,
  /** AQ103.1.3 — bathroom or kitchen in a tiny house. */ bathAppendixQFt: 6 + 4 / 12,
  /** A 6'8" door plus its header and plate. */ doorFaceFt: 7.17,
};

/** R304.1 habitable room; AQ103.1.1 loft in a tiny house. */
export const MIN_AREA = { habitableSqFt: 70, loftAppendixQSqFt: 35 };

export type SideZoneUse = 'bedroom' | 'deck';

export interface RoofProfile {
  style: string;
  eaveFt: number;
  ridgeFt: number;
}

export interface UnitConfig {
  planId: string;
  /** Overall width across the roof span, ft. */
  widthFt: number;
  depthFt: number;
  roof: RoofProfile;
  /** Two doors, one per side, and a lockable divider — two suites or one house. */
  lockOff: boolean;
  /** Height of the loft floor above the main floor, when a loft is possible. */
  loftFloorFt?: number;
}

export interface SideZone {
  use: SideZoneUse;
  /** Depth of the strip outboard of the core, ft. 0 when the wall is full height. */
  depthFt: number;
  /** Fraction of the strip with habitable headroom. */
  usableFraction: number;
  reason: string;
}

export interface EntryNotch {
  /** How far in from the wall line a door face has to sit. 0 = none needed. */
  insetFt: number;
  widthFt: number;
  areaSqFt: number;
  reason: string;
}

export interface LoftVerdict {
  possible: boolean;
  /** Width of the band meeting the governing headroom, ft. */
  bandFt: number;
  /** Depth the loft needs to reach its minimum area. */
  depthFt: number;
  codePath: 'appendix-q' | 'full-irc';
  reason: string;
}

export interface UnitPlan {
  planId: string;
  config: UnitConfig;
  /** Enclosed area excluding lofts — what Appendix Q measures. */
  enclosedSqFt: number;
  /**
   * What the FOUNDATION spans, which is not the enclosed area.
   *
   * The roof bears on the outer wall line and a covered deck stands on piles
   * like anything else, so the pile grid follows the full roof span even where
   * the thermal envelope steps in. Founding only the heated core would leave the
   * decks — and the roof edge above them — on nothing, while every gate still
   * passed, because each one would be measuring a self-consistent smaller
   * building.
   */
  foundationFootprint: { widthFt: number; depthFt: number };
  codePath: 'appendix-q' | 'full-irc';
  coreWidthFt: number;
  sides: { west: SideZone; east: SideZone };
  notch: EntryNotch;
  loft: LoftVerdict;
  wallRuns: WallRunSpec[];
  roofPlanes: RoofPlaneSpec[];
  /** Interior walls for the foundation's bearing-line rule. */
  interiorWalls: Array<{ id: string; span: { x1: number; z1: number; x2: number; z2: number } }>;
  notes: string[];
}

/** Distance from the ridge at which the plane still clears `need`. */
function reachFor(roof: RoofProfile, widthFt: number, need: number): number {
  const slope = (roof.ridgeFt - roof.eaveFt) / (widthFt / 2);
  if (slope <= 0) return roof.ridgeFt >= need ? widthFt / 2 : 0;
  return Math.max(0, Math.min(widthFt / 2, (roof.ridgeFt - need) / slope));
}

/**
 * How far in from the wall line a door has to sit, and what that costs.
 *
 * A door needs a vertical face. On a roof that reaches the ground there is none
 * at the wall line, so the face moves inboard. The cheap answer is a local
 * NOTCH rather than insetting the whole wall — it keeps the floor plate and,
 * more importantly, cuts no hole in the roof plane, which is the detail that
 * flashes badly and leaks.
 */
export function entryNotch(roof: RoofProfile, widthFt: number, doorWidthFt = 4): EntryNotch {
  if (roof.eaveFt >= HEIGHT.doorFaceFt) {
    return {
      insetFt: 0,
      widthFt: doorWidthFt,
      areaSqFt: 0,
      reason: `The ${roof.eaveFt} ft wall already clears a door face, so a side door needs no inset.`,
    };
  }
  const insetFt = round2(widthFt / 2 - reachFor(roof, widthFt, HEIGHT.doorFaceFt));
  return {
    insetFt,
    widthFt: doorWidthFt,
    areaSqFt: round2(insetFt * doorWidthFt),
    reason: `The ${roof.eaveFt} ft eave gives no door face at the wall line, so each side door sits `
      + `${insetFt} ft inboard in a notch. That costs ${round2(insetFt * doorWidthFt)} sq ft per door `
      + 'and cuts NO hole in the roof plane — a dormer would keep the floor area and add the '
      + 'flashing detail instead.',
  };
}

/**
 * Bedroom or deck, and it is not a free choice — the section decides it.
 */
export function sideZone(roof: RoofProfile, widthFt: number): SideZone {
  if (roof.eaveFt >= HEIGHT.doorFaceFt) {
    return {
      use: 'bedroom',
      depthFt: 0,
      usableFraction: 1,
      reason: `The ${roof.eaveFt} ft wall runs full height to the edge, so there is no low strip: `
        + 'a side bedroom works anywhere on the plate.',
    };
  }
  const coreEdge = reachFor(roof, widthFt, HEIGHT.doorFaceFt);
  const depthFt = round2(widthFt / 2 - coreEdge);
  const habitableEdge = reachFor(roof, widthFt, HEIGHT.habitableFt);
  const usable = depthFt > 0 ? Math.max(0, habitableEdge - coreEdge) / depthFt : 0;
  return {
    use: usable > 0.5 ? 'bedroom' : 'deck',
    depthFt,
    usableFraction: round2(usable),
    reason: `The ${roof.eaveFt} ft eave puts the outer ${depthFt} ft of the section under the falling `
      + `plane — only ${Math.round(usable * 100)}% of it clears ${HEIGHT.habitableFt} ft. `
      + 'That is a covered deck, not a room. The volume this roof buys is overhead, not outboard.',
  };
}

/**
 * Can this unit carry a loft, and under which code?
 *
 * Appendix Q is the permissive path and it is the SMALL unit that gets it: at or
 * under 400 sq ft a loft needs 35 sq ft, 5 ft in any dimension, and no headroom
 * rule at all. Above that the full IRC sloped-ceiling rule applies and bites
 * hard — half the required area at 7 ft, none of it under 5.
 */
export function loftVerdict(
  roof: RoofProfile,
  widthFt: number,
  depthFt: number,
  enclosedSqFt: number,
  loftFloorFt: number,
): LoftVerdict {
  const codePath = enclosedSqFt <= APPENDIX_Q_MAX_SQFT ? 'appendix-q' as const : 'full-irc' as const;
  const bandAt = (need: number) => round2(2 * Math.max(0,
    reachFor({ ...roof }, widthFt, need + loftFloorFt) ));

  if (codePath === 'appendix-q') {
    // No headroom rule; the loft just has to exist and be 5 ft in any dimension.
    const band = round2(2 * reachFor(roof, widthFt, loftFloorFt));
    const need = band > 0 ? round2(MIN_AREA.loftAppendixQSqFt / band) : Infinity;
    const possible = band >= 5 && need <= depthFt;
    return {
      possible,
      bandFt: band,
      depthFt: possible ? need : 0,
      codePath,
      reason: possible
        ? `Appendix Q applies at ${enclosedSqFt} sq ft: the loft needs ${MIN_AREA.loftAppendixQSqFt} `
          + `sq ft and 5 ft in any dimension, with NO headroom rule. A ${band} ft band gives that in `
          + `${need} ft of depth.`
        : `Appendix Q applies, but this roof leaves only a ${band} ft band above the loft floor — `
          + 'under the 5 ft minimum horizontal dimension.',
    };
  }
  // Full IRC: half the required 70 sq ft at 7 ft, none under 5 ft.
  const band7 = bandAt(HEIGHT.habitableFt);
  const band5 = bandAt(HEIGHT.slopedFloorFt);
  const depthFor70 = band5 > 0 ? MIN_AREA.habitableSqFt / band5 : Infinity;
  const depthFor35at7 = band7 > 0 ? (MIN_AREA.habitableSqFt / 2) / band7 : Infinity;
  const need = round2(Math.max(depthFor70, depthFor35at7));
  const possible = Number.isFinite(need) && need <= depthFt && band5 > 0;
  return {
    possible,
    bandFt: band5,
    depthFt: possible ? need : 0,
    codePath,
    reason: possible
      ? `Full IRC at ${enclosedSqFt} sq ft: R305.1.1 wants half of ${MIN_AREA.habitableSqFt} sq ft at `
        + `${HEIGHT.habitableFt} ft and none under ${HEIGHT.slopedFloorFt} ft. Bands are ${band7} ft `
        + `and ${band5} ft, so the loft needs ${need} ft of depth.`
      : `Full IRC at ${enclosedSqFt} sq ft and this roof cannot carry a loft: the ${HEIGHT.habitableFt} ft `
        + `band is ${band7} ft and the ${HEIGHT.slopedFloorFt} ft band is ${band5} ft. Dropping under `
        + `${APPENDIX_Q_MAX_SQFT} sq ft would move it to Appendix Q, where no headroom rule applies.`,
  };
}

/**
 * THE WET WALL IS NOT A PANEL.
 *
 * A SIP has no cavity and you do not cut one for a stack, so the single wall
 * carrying the kitchen below and the bath above has to be conventionally framed.
 * It is emitted as a wall run like any other so the drawings and the foundation
 * see it, and flagged so the panel tender EXCLUDES it — otherwise a manufacturer
 * quotes a panel you cannot run a pipe through, and nobody notices until the
 * plumber is on site.
 */
export const WET_WALL_ID = 'iw-wet-wall';

export function isPanelised(runId: string): boolean {
  return runId !== WET_WALL_ID;
}

export function buildUnitPlan(config: UnitConfig): UnitPlan {
  const { widthFt, depthFt, roof } = config;
  const notes: string[] = [];
  const side = sideZone(roof, widthFt);
  const notch = entryNotch(roof, widthFt);

  // Deck side zones are outside the thermal envelope, so they do not count as
  // enclosed area — which is what decides the code path.
  const deckDepth = side.use === 'deck' ? side.depthFt : 0;
  const coreWidthFt = round2(widthFt - 2 * deckDepth);
  const enclosedSqFt = round2(coreWidthFt * depthFt - (notch.areaSqFt * 2));

  const loftFloorFt = config.loftFloorFt ?? 8.42;
  const loft = loftVerdict(roof, widthFt, depthFt, enclosedSqFt, loftFloorFt);

  // Exterior runs. The ridge runs the long axis, so the gable ends are the
  // width-wise walls and the side walls are the depth-wise ones.
  const wallRuns: WallRunSpec[] = [];
  const eaveFt = roof.eaveFt;
  const gable = roof.ridgeFt > eaveFt + 0.01;
  const coreHalf = coreWidthFt / 2;
  // Every wall's area comes from WHERE IT STANDS under the roof, through the one
  // shared function — never from the eave. The first version of this helper
  // used the eave for every wall: the a-frame's 7.17 ft side walls quoted at
  // 22 sq ft (22 x 1), the lock-off divider came out 1 ft tall, and its inset
  // gable ends were 114 sq ft where the trapezoid is 152. Every gate passed.
  const openingArea = (openings: WallRunSpec['openings']) =>
    round2(openings.reduce((t, o) => t + o.widthFt * Math.max(0, o.headFt - o.sillFt), 0));
  /** A wall parallel to the ridge, standing at offset u: a rectangle at that height. */
  const pushParallel = (id: string, kind: WallRunSpec['kind'], lengthFt: number, uFromRidge: number,
    openings: WallRunSpec['openings'] = []) => {
    const h = roofHeightAtFt(roof, widthFt, uFromRidge);
    wallRuns.push({
      id, kind, profile: 'plate', lengthFt: round2(lengthFt), heightFt: round2(h),
      grossAreaSqFt: round2(lengthFt * h), openingAreaSqFt: openingArea(openings), openings,
    });
  };
  /** A wall ACROSS the ridge between two offsets: the roof's own profile. */
  const pushAcross = (id: string, kind: WallRunSpec['kind'], uStart: number, uEnd: number) => {
    wallRuns.push({
      id, kind, profile: gable ? 'gable-end' : 'plate',
      lengthFt: round2(Math.abs(uEnd - uStart)),
      heightFt: round2(roofHeightAtFt(roof, widthFt, uStart * uEnd < 0 ? 0 : Math.min(Math.abs(uStart), Math.abs(uEnd)))),
      grossAreaSqFt: round2(roofProfileAreaSqFt(roof, widthFt, uStart, uEnd)),
      openingAreaSqFt: 0, openings: [],
    });
  };

  // Two doors, one per side, at the notch if the roof demands one.
  const doorAt = (id: string, offsetFt: number): WallRunSpec['openings'] => ([{
    id, type: 'door' as const, offsetFt: round2(offsetFt), widthFt: notch.widthFt,
    sillFt: 0, headFt: 6 + 8 / 12,
  }]);

  // Gable ends span the CORE, which on a decked variant is narrower than the
  // roof — so they are trapezoids from the core line to the ridge, not
  // triangles from the eave.
  pushAcross('ext-n', 'exterior', -coreHalf, coreHalf);
  pushAcross('ext-s', 'exterior', -coreHalf, coreHalf);
  // The side walls stand at the core line and carry the doors. On a decked
  // variant that line is inboard, where the roof clears a door face; on a box
  // it is the eave.
  pushParallel('ext-w', 'exterior', depthFt, -coreHalf, doorAt('door-w', depthFt / 2 - notch.widthFt / 2));
  pushParallel('ext-e', 'exterior', depthFt, coreHalf, doorAt('door-e', depthFt / 2 - notch.widthFt / 2));

  // The wet wall, down the ridge, full length and full height — it carries the
  // stack up through the loft to the half bath. Also a bearing line.
  pushParallel(WET_WALL_ID, 'interior', depthFt, 0);

  // The lock-off divider, across the middle, so each end is a suite.
  // COORDINATES ARE FULL-WIDTH, MEASURED FROM THE ROOF EDGE — not from the core.
  // The foundation spans the roof, so a wall given in core-local coordinates
  // lands short by the deck depth and its piles end up under nothing. That is
  // exactly what happened here, and no numeric gate saw it: the battery asserted
  // the wet wall was IN the bearing-line list, never WHERE.
  const interiorWalls: Array<{ id: string; span: { x1: number; z1: number; x2: number; z2: number } }> = [
    { id: WET_WALL_ID, span: { x1: round2(widthFt / 2), z1: 0, x2: round2(widthFt / 2), z2: depthFt } },
  ];
  if (config.lockOff) {
    // A cross wall through the core: it rises to the roof, so under a pitched
    // roof it is the same trapezoid as the gable ends.
    pushAcross('iw-lockoff', 'interior', -coreHalf, coreHalf);
    interiorWalls.push({
      id: 'iw-lockoff',
      span: { x1: round2(deckDepth), z1: depthFt / 2, x2: round2(widthFt - deckDepth), z2: depthFt / 2 },
    });
    notes.push('LOCK-OFF: a door in each side wall and a lockable divider across the middle. '
      + 'Rented as one house or as two bedroom-with-bath suites, with both baths and the kitchen '
      + `on the single wet wall. ⚠️ Two entrances and two suites may read to an inspector as two `
      + 'dwelling units, which is a different code path — ask before building, not after.');
  }

  const roofPlanes: RoofPlaneSpec[] = gable
    ? [
      { id: 'roof-w', areaSqFt: round2(depthFt * Math.hypot(widthFt / 2, roof.ridgeFt - eaveFt)), pitchDeg: round2(Math.atan2(roof.ridgeFt - eaveFt, widthFt / 2) * 180 / Math.PI) },
      { id: 'roof-e', areaSqFt: round2(depthFt * Math.hypot(widthFt / 2, roof.ridgeFt - eaveFt)), pitchDeg: round2(Math.atan2(roof.ridgeFt - eaveFt, widthFt / 2) * 180 / Math.PI) },
    ]
    : [{ id: 'roof-flat', areaSqFt: round2(widthFt * depthFt), pitchDeg: 0 }];

  notes.push(side.reason);
  if (notch.insetFt > 0) notes.push(notch.reason);
  notes.push(loft.reason);
  notes.push(`THE WET WALL (${WET_WALL_ID}) IS NOT PANELISED. A SIP has no cavity and is not cut for `
    + 'a stack, so it is conventionally framed and excluded from the panel package. It is still a '
    + 'bearing line and still carries piles.');
  if (side.use === 'deck') {
    notes.push(`The piles span the full ${round2(widthFt)} ft roof width, NOT the `
      + `${coreWidthFt} ft heated core — the roof bears on the outer line and the decks stand on `
      + 'piles too. That is also what keeps the foundation identical across every roof variant.');
    notes.push(`The two ${side.depthFt} ft side strips are COVERED DECK, outside the thermal `
      + `envelope, so the enclosed area is ${enclosedSqFt} sq ft rather than ${round2(widthFt * depthFt)}. `
      + 'That is what keeps this unit on the Appendix Q side of 400 sq ft.');
  }

  return {
    planId: config.planId, config, enclosedSqFt,
    foundationFootprint: { widthFt: round2(widthFt), depthFt: round2(depthFt) },
    codePath: enclosedSqFt <= APPENDIX_Q_MAX_SQFT ? 'appendix-q' : 'full-irc',
    coreWidthFt, sides: { west: side, east: side }, notch, loft,
    wallRuns, roofPlanes, interiorWalls, notes,
  };
}

/** The bearing-line rule this plan is built to satisfy, restated for the reader. */
export const BEARING_RULE_NOTE =
  `The wet wall spans the full depth, so it covers 100% of the span and clears the `
  + `${Math.round(BEARING_COVERAGE_RATIO * 100)}% bearing-line threshold by construction. The `
  + 'foundation therefore sees the same three lines on every roof variant.';
