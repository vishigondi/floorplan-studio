/**
 * THE PLAN OF RECORD — two units, one shared deck, a path between them.
 *
 * Taken from the owner's render and worked up. The render's composition is a
 * pair of units standing GABLE-ON to a single large rectangular deck, with a
 * stone path running uphill between them and a completely open deck edge.
 *
 * Two details carry the whole image, and both are checkable:
 *
 *   THE OPEN EDGE. No guard appears anywhere in the render, and the deck is the
 *   better for it. IRC R312 requires a 36 in guard the moment the walking
 *   surface is more than 30 in above what is below. So the unguarded edge is
 *   not a styling choice — it is a GRADING instruction. Hold the deck at or
 *   under 30 in above finished grade at every point and the render is legal as
 *   drawn. Let it drift to 32 and you are building a railing.
 *
 *   THE ENTRY. The render shows the glass facing the deck, which is right. But
 *   on most of these units the DOOR is not on the glass wall — it is on a long
 *   side, up to 85% of the way toward the far end. The path between the units
 *   is therefore not decoration: it is the access corridor, and the doors want
 *   to face INTO it.
 */

import type { ObservedUnit } from './site-composition';

export const SHARED_DECK = {
  /** Read off the render and rounded to buildable numbers. */
  deckWidthFt: 48,
  deckDepthFt: 24,
  /** The walkable gap between the two units — the path, and the fire lane between them. */
  unitGapFt: 15,
  /** Boards run across the long axis, as drawn: it makes the deck read wider. */
  boardDirection: 'parallel to the front edge (across the long axis)',
  fireBowlCentred: true,
} as const;

/**
 * IRC R312. The number the entire look depends on.
 */
export const GUARD_TRIGGER_IN = 30;
export const GUARD_HEIGHT_IN = 36;

export function guardRequired(deckHeightAboveGradeIn: number): boolean {
  return deckHeightAboveGradeIn > GUARD_TRIGGER_IN;
}

/**
 * The render shows an open edge, so the design intent is "no guard". This says
 * what that costs: the finished grade has to come UP to meet the deck, which is
 * what the wide cobble apron in the render is really doing.
 */
export const OPEN_EDGE_STRATEGY = {
  maxHeightIn: GUARD_TRIGGER_IN,
  whatItBuys: 'No guard anywhere. The deck reads as a plane laid on the ground rather than a platform.',
  whatItCosts:
    'The finished grade must be built UP to within 30 in of the deck at every point along every open '
    + 'edge — which is what the wide stone apron in the render is doing, whether or not it was drawn '
    + 'that way on purpose. On falling ground that is fill, compaction and a retaining edge.',
  theTrap:
    'Grade is measured to the ground BELOW, not to the average. One low corner on a slope puts a '
    + 'railing along the whole edge, because nobody builds 30 ft of guard and stops.',
  ifItCannotBeHeld:
    'Where the fall is too great, do not railing the whole perimeter. Step the deck down in platforms, '
    + 'each under 30 in above its own apron — the drop becomes two or three planes instead of one edge, '
    + 'and every plane stays open.',
} as const;

/** Fire on a timber deck. The render puts the bowl on the boards. */
export const FIRE_ON_DECK = {
  requiresNoncombustibleBase: true,
  detail:
    'A raised bowl on a non-combustible hearth — steel pan on stone, set flush with the boards so it '
    + 'reads as part of the deck rather than as an object placed on it.',
  caution:
    'Clearances are the manufacturer\'s, not the code\'s, and they differ by appliance. Fix the bowl '
    + 'before the deck framing is set so the hearth lands between joists, not across one.',
} as const;

// ---------------------------------------------------------------------------
// How each unit actually fits
// ---------------------------------------------------------------------------

/**
 * Two ways a unit can meet a shared deck, and a unit is only good at one.
 *
 *   GABLE-ON   the unit stands perpendicular to the deck edge and presents its
 *              END to it. Works only where the glazing is on the GABLE.
 *   BROADSIDE  the unit lies parallel to the deck edge and presents its LONG
 *              wall. The only arrangement that suits SIDE glazing — and it puts
 *              far more glass on the deck.
 */
export type DeckStance = 'gable-on' | 'broadside';

export interface FitAssessment {
  model: string;
  stance: DeckStance;
  /** Does the glass face the deck in this stance? */
  glassFacesDeck: boolean;
  /** Feet from the deck edge to the door, along the unit. */
  walkToDoorFt: number;
  /** A walkway down the flank is needed to reach the door from the deck. */
  needsFlankWalk: boolean;
  /** Door on the wall facing the central path, so the path serves it. */
  doorServedByPath: boolean;
  verdict: string;
}

/** Below this the door is close enough to the deck that no flank walk is needed. */
export const FLANK_WALK_THRESHOLD_FT = 12;

/**
 * A PAIR OF BROADSIDE UNITS WILL NOT FIT THIS DECK, and that is arithmetic
 * rather than taste: laid along the back edge they need their own two lengths
 * plus a walkable gap. Only drawing it made it obvious.
 *
 * So the render's SYMMETRY is available only to gable-glass units. Side-glass
 * units get the same deck with ONE unit on it, or a different composition — the
 * right-angle pair, where the two long glazed walls look down different
 * sightlines instead of at each other.
 */
export function broadsidePairFitsFt(u: { lengthFt: number }, gapFt = 8): number {
  return Math.round((2 * u.lengthFt + gapFt) * 10) / 10;
}

export function broadsidePairFits(u: { lengthFt: number }, deckWidthFt = SHARED_DECK.deckWidthFt): boolean {
  return broadsidePairFitsFt(u) <= deckWidthFt;
}

export function preferredStance(u: ObservedUnit): DeckStance {
  return u.glassWall === 'gable' ? 'gable-on' : 'broadside';
}

export function assessFit(u: ObservedUnit, stance: DeckStance = preferredStance(u)): FitAssessment {
  const glassFacesDeck = (stance === 'gable-on') === (u.glassWall === 'gable');
  // Gable-on: the door sits along the flank, its distance from the deck set by
  // how far along the unit it is. Broadside: the door is in the wall facing the
  // deck, so the walk is the depth of the unit only.
  const walkToDoorFt = stance === 'gable-on'
    ? Math.round(u.lengthFt * u.doorAtFractionFromGlass * 10) / 10
    : Math.round((u.widthFt / 2) * 10) / 10;
  const needsFlankWalk = stance === 'gable-on' && walkToDoorFt > FLANK_WALK_THRESHOLD_FT;
  const doorServedByPath = stance === 'gable-on' && u.entry === 'side';
  let verdict: string;
  if (!glassFacesDeck) {
    verdict = `🔴 Wrong stance. ${u.glassWall === 'side' ? 'Side' : 'Gable'} glazing pointed the other `
      + 'way — the deck gets a blank wall and the view goes to the trees.';
  } else if (needsFlankWalk) {
    verdict = `⚠️ Works, but the door is ${walkToDoorFt} ft up the flank. The path between the units has `
      + 'to serve it, and the door must be on the wall FACING that path — which means the pair is handed.';
  } else if (stance === 'broadside') {
    const needed = broadsidePairFitsFt(u);
    verdict = `✅ Door within ${walkToDoorFt} ft of the deck — the glazed wall IS the deck wall, so no `
      + 'flank walkway and no handing problem. '
      + (broadsidePairFits(u)
        ? 'A pair fits this deck.'
        : `⚠️ But a PAIR needs ${needed} ft of back edge against this deck's `
          + `${SHARED_DECK.deckWidthFt} ft — so one unit here, or take the right-angle pair instead.`);
  } else {
    verdict = `✅ Door within ${walkToDoorFt} ft of the deck. No flank walkway, no handing problem.`;
  }
  return { model: u.model, stance, glassFacesDeck, walkToDoorFt, needsFlankWalk, doorServedByPath, verdict };
}

/**
 * ⚠️ A SYMMETRICAL PAIR FLANKING A CENTRAL PATH NEEDS A HANDED PAIR.
 *
 * If both doors are to face the path, one unit's door is on its left and the
 * other's is on its right. They are mirror images. That is a reversed plan — the
 * thing Zook will not supply below ten units — and it is forced here by the
 * render's own symmetry rather than by any preference.
 *
 * It also collides with NEC 551.77, which puts the pedestal on the unit's LEFT.
 * On one of the two units the door and the pedestal end up on the same side.
 */
export const SYMMETRY_NEEDS_HANDING = {
  why: 'Both doors facing the central path means one is a left-hand plan and the other a right-hand plan.',
  supplyConsequence: 'A reversed plan. Zook do not hand a plan below ten units.',
  pedestalCollision:
    'NEC 551.77 fixes the pedestal to the unit\'s left. With the doors facing each other across the '
    + 'path, one unit necessarily has its door and its pedestal on the same side — put that unit\'s '
    + 'pedestal at the far end of its code window, and keep the flank walk on the opposite side of it.',
  ifUnhanded:
    'With two identical units the pair is not symmetrical: both doors land on the same side, so one '
    + 'opens onto the path and the other opens away from it, onto its outer flank. That is buildable '
    + 'and it is not what the render shows — the second unit needs its own outer walkway.',
} as const;
