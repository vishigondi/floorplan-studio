/**
 * LOT POSITIONING — where the unit sits on its stand, and why the door side is
 * not a preference.
 *
 * Site composition (site-composition.ts) decides how units relate to each other.
 * This decides how ONE unit sits on ONE serviced lot, and it is governed by a
 * different authority: the electrical code fixes where the pedestal goes, and it
 * fixes it to a SIDE.
 *
 * NEC 551.77, back-in sites: the site supply equipment goes on the LEFT (road)
 * side of the parked vehicle, on a line 5 to 7 ft from the left edge of the
 * stand, at any point from the REAR of the stand to 15 ft forward of the rear.
 *
 * Three facts collide on every lot:
 *
 *   1. The pedestal is on the unit's LEFT. Not negotiable, not a preference.
 *   2. The deck goes where the DOOR and the GLASS are.
 *   3. The unit tows out hitch-first, so the hitch faces the lane and the glass
 *      end is the deep end — which is what NEC calls the rear of the stand.
 *
 * If the door is on the unit's left, the deck and the pedestal want the same
 * ground. PUT THE DOOR ON THE RIGHT. That is the whole rule, and it is decided
 * at the order, not on site.
 */

/** Which long wall the door is in, viewed from behind the parked unit. */
export type DoorSide = 'left' | 'right';

export const NEC_551_77 = {
  rule: 'NEC 551.77 (adopted through the NC Electrical Code)',
  side: 'left' as const,
  sideNote: 'the left (road) side of the parked vehicle — the driver\'s side',
  offsetFromLeftEdgeFt: [5, 7] as const,
  /** Measured FORWARD of the rear of the stand, toward the lane. */
  windowFromRearOfStandFt: [0, 15] as const,
  /**
   * ⚠️ The archive's design-standards row reads "~16 ft forward of the rear".
   * The code says 4.5 m — 15 ft. Small, but it is the dimension a PE will set
   * conduit to.
   */
  archiveSaysFt: 16,
  actualFt: 15,
} as const;

/**
 * Where the unit's own services emerge — set by the INTERNAL PLAN, not by any
 * standard. Water and sewer drop under the wet core; the electrical inlet sits
 * at one end. So on an A-frame with the bath at the hitch end, the water and
 * sewer risers want the LANE end while the pedestal window sits in the DEEP
 * half. They are at opposite ends of the same lot, and the trench has to know.
 */
export const UNIT_SERVICE_POINTS = {
  water: 'under the wet core (kitchen or bathroom) — 3/4 in PEX, female garden-hose fitting',
  sewer: 'under the wet core — 3 in PVC outlet',
  electrical: 'at one END of the unit, opposite the porch and/or the bathroom end',
  ampacity: '50 or 100 amp service depending on model',
  consequence:
    'On every A-frame surveyed the bath is at the hitch end, so water and sewer land at the LANE end '
    + 'while the NEC pedestal window sits in the DEEP half of the stand. Opposite ends of the same lot. '
    + 'Set the risers to the wet core and the pedestal to the code window; do not assume one trench.',
  source: 'zookcabins.com/blog/15-steps-to-setting-up-your-park-model; Lancaster Log Cabins set-up',
} as const;

/**
 * Blocking and tie-downs, from the maker's own set-up guidance. Worth holding
 * beside the NC memo, because the two nearly agree and the gap is the point.
 */
export const SETUP_STANDARD = {
  blocking: 'Wood or masonry block stacks along the length, at most 8 ft apart.',
  tieDowns: 'Tie-down anchors every 8 ft against sliding and overturning.',
  neverOnGround: 'Do not set the unit directly on the ground.',
  /**
   * ⚠️ Zook's own guidance offers to "remove the trailer tongue and stow it
   * underneath the park model". NC's OSFM memo requires that "the wheels and
   * axles must remain on the unit at all times" — it does not name the tongue,
   * and stowing it under the unit keeps it WITH the unit, so this likely
   * survives where ÖÖD's "wheels and the tow bar ... can be hidden or removed"
   * does not. Likely is not certainly: get it in writing per unit class before
   * anyone with a grinder is on the property.
   */
  tongueRemoval:
    'Maker offers tongue removal with the tongue stowed under the unit. NC requires wheels and axles to '
    + 'remain at all times and is silent on the tongue. Stowing keeps it with the unit; removing it from '
    + 'site does not. Confirm in writing.',
} as const;

export interface Pt { x: number; y: number }

/**
 * A lot, in feet. The lane runs along the +y end; the unit backs in so its
 * hitch faces the lane and its glass gable ends up deep, at -y. Local +x is the
 * unit's RIGHT as parked, so -x is the NEC pedestal side.
 */
export interface Lot {
  id: string;
  unitWidthFt: number;
  unitLengthFt: number;
  /**
   * The pad runs past the unit by this much on every side — Zook's own site-prep
   * spec. The STAND IS DERIVED FROM IT rather than being a free number, because
   * a stand set to lot width instead of pad width pushes the pedestal band so
   * far outboard that nothing can ever foul it, and the check silently passes.
   * That happened on the first run of this module.
   */
  padMarginFt: number;
  /** Which long wall the door is in. The one thing this module is about. */
  doorSide: DoorSide;
  /** Deck depth off the door wall. */
  sideDeckDepthFt: number;
  /** View deck projecting past the glass gable, at the deep end. */
  viewDeckDepthFt: number;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] =>
  [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/** The unit footprint, centred on the stand, hitch toward +y. */
export function unitFootprint(lot: Lot): Pt[] {
  const hw = lot.unitWidthFt / 2, hl = lot.unitLengthFt / 2;
  return rect(-hw, -hl, hw, hl);
}

/** Zook site prep: at least 1 ft of pad past the unit on every side. */
export const PAD_MARGIN_DEFAULT_FT = 1;

export function standWidthFt(lot: Lot): number {
  return lot.unitWidthFt + 2 * lot.padMarginFt;
}

export function standLengthFt(lot: Lot): number {
  return lot.unitLengthFt + 2 * lot.padMarginFt;
}

export function standFootprint(lot: Lot): Pt[] {
  const hw = standWidthFt(lot) / 2, hl = standLengthFt(lot) / 2;
  return rect(-hw, -hl, hw, hl);
}

/** Deep end of the stand — what NEC calls the rear. */
export function rearOfStandY(lot: Lot): number {
  return -standLengthFt(lot) / 2;
}

/**
 * The band NEC 551.77 permits the pedestal to sit in: 5–7 ft outboard of the
 * stand's LEFT edge, from the rear of the stand to 15 ft forward of it.
 */
export function pedestalZone(lot: Lot): Pt[] {
  const leftEdge = -standWidthFt(lot) / 2;
  const [near, far] = NEC_551_77.offsetFromLeftEdgeFt;
  const rear = rearOfStandY(lot);
  const [w0, w1] = NEC_551_77.windowFromRearOfStandFt;
  return rect(leftEdge - far, rear + w0, leftEdge - near, rear + w1);
}

/** The strip of deck serving the door, on whichever wall the door is in. */
export function sideDeck(lot: Lot): Pt[] {
  const hw = lot.unitWidthFt / 2, hl = lot.unitLengthFt / 2;
  return lot.doorSide === 'right'
    ? rect(hw, -hl, hw + lot.sideDeckDepthFt, hl)
    : rect(-hw - lot.sideDeckDepthFt, -hl, -hw, hl);
}

/** The view deck off the glass gable, projecting deeper than the unit. */
export function viewDeck(lot: Lot): Pt[] {
  const hw = lot.unitWidthFt / 2, hl = lot.unitLengthFt / 2;
  return rect(-hw, -hl - lot.viewDeckDepthFt, hw, -hl);
}

/** Separating-axis overlap for convex polygons. Touching is not overlapping. */
export function polysOverlap(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      const ax = -(p2.y - p1.y), ay = p2.x - p1.x;
      const len = Math.hypot(ax, ay);
      if (len === 0) continue;
      const nx = ax / len, ny = ay / len;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const p of a) { const d = p.x * nx + p.y * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
      for (const p of b) { const d = p.x * nx + p.y * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
      if (aMax <= bMin + 1e-9 || bMax <= aMin + 1e-9) return false;
    }
  }
  return true;
}

export interface LotVerdict {
  lotId: string;
  doorSide: DoorSide;
  /** The side deck sitting in the band the code reserves for the pedestal. */
  deckFoulsPedestal: boolean;
  /** The view deck is deeper than the rear of the stand — outside the band in y. */
  viewDeckFoulsPedestal: boolean;
  ok: boolean;
  note: string;
}

export function assessLot(lot: Lot): LotVerdict {
  const zone = pedestalZone(lot);
  const deckFoulsPedestal = polysOverlap(sideDeck(lot), zone);
  const viewDeckFoulsPedestal = polysOverlap(viewDeck(lot), zone);
  const ok = !deckFoulsPedestal && !viewDeckFoulsPedestal;
  return {
    lotId: lot.id,
    doorSide: lot.doorSide,
    deckFoulsPedestal,
    viewDeckFoulsPedestal,
    ok,
    note: ok
      ? 'Door on the right, so the deck runs right and the pedestal keeps its code band on the left. '
        + 'The view deck projects past the rear of the stand and clears the band in the other axis.'
      : 'The deck is sitting where the code puts the pedestal. Hand the unit so the door is on the '
        + 'RIGHT, or the pedestal ends up inside the deck — which is a rework, not a detail.',
  };
}

/**
 * THE PROCUREMENT CONSEQUENCE, WHICH IS THE REAL POINT.
 *
 * "Left" is the left of the PARKED unit. On a lane with lots down both sides,
 * units face opposite ways, so the door lands on opposite hands relative to the
 * lane. Keeping the deck clear of the pedestal on BOTH sides of that lane means
 * one side takes a reversed plan.
 *
 * Which is where the manufacturer comes back in: Zook will not hand a plan below
 * ten units, so under ten you do not get to choose — you take the stock hand and
 * orient the entire park around it, which means single-loaded lanes or accepting
 * the pedestal inside the deck on half the lots. At ten or more, both hands are
 * available and lanes can be double-loaded.
 *
 * That is the same ten that appears in the wastewater local-review cap. Two
 * unrelated authorities, one number, and it keeps deciding the plan.
 */
export const HANDING_AND_LANES = {
  singleLoadedUnderTenUnits:
    'Below the maker\'s custom threshold every unit arrives the same hand. A double-loaded lane then '
    + 'puts the door on the wrong side for one row. Either single-load the lanes, or alternate the '
    + 'direction units back in and accept that half the glass faces the lane instead of the view.',
  doubleLoadedNeedsBothHands:
    'A double-loaded lane needs reversed plans for one row. That is a purchase-order decision made '
    + 'before the site plan is drawn, not a field adjustment.',
  theRecurringTen:
    'Ten units unlocks handing at the maker AND is the park-model ceiling for local-only wastewater '
    + 'review. Different authorities, same number, and both point the same way.',
} as const;

/** Every lot in a park should read the same way, or the dock detail is not one detail. */
export function handingIsConsistent(lots: readonly Lot[]): boolean {
  if (lots.length === 0) return true;
  return lots.every((l) => l.doorSide === lots[0].doorSide);
}
