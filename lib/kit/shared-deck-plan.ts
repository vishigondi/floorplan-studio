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

/**
 * THE GLASS FACES THE VIEW. That is fixed, because the glazing is the product —
 * it is not traded against anything, including convenience. Everything else on
 * the lot arranges itself around that one decision.
 *
 * Which means the door is wherever the maker put it, and on most units that is
 * a long way up the flank. So the walk is not a defect to design away: it is
 * DECK THAT HAS NOT BEEN DRAWN YET.
 *
 * And drawn properly it fixes something the render is missing. Two units
 * sharing one deck gives neither guest any private outdoor space — you step out
 * of your door into someone else's evening. Run the flank as a full-width
 * private deck rather than a walkway and the problem inverts:
 *
 *   SHARED DECK at the glass ends — the view, the fire, the social room
 *   FLANK DECK  per unit, at your own door — private, yours, out of the way
 *
 * The constraint pays for the amenity. Below this threshold the door is close
 * enough that the shared deck already serves it and no flank deck is drawn.
 */
export const FLANK_WALK_THRESHOLD_FT = 12;

/** A walkway is circulation; this is a room. Wide enough for two chairs and a table. */
export const FLANK_DECK_WIDTH_FT = 8;

/**
 * THE FLANK DECKS GO ON THE OUTER WALLS, AND DRAWING IT IS WHAT SETTLED IT.
 *
 * Drawn on the inner walls, facing the central path, two 8 ft decks need 16 ft
 * of a 15 ft gap. They collide, and there is no path left. Widening the gap to
 * fit them only buys a worse result: two private decks staring at each other
 * across a few feet, which is the least private arrangement available.
 *
 * Outboard they work. Each deck faces away into the trees, the central gap stays
 * narrow — which keeps the pair reading as a pair — and the arrival sequence
 * improves: you cross the shared deck first, then turn up your own side. Public
 * to private, in that order, which is how good hospitality plans are ordered.
 *
 * The doors therefore sit on the OUTER walls, and the pair is still handed —
 * one left-hand plan, one right-hand.
 */
export const FLANK_SIDE = 'outer' as const;

/** Does the inner-flank version physically fit? It is recorded because it does not. */
export function innerFlanksFit(gapFt: number, pathFt = 4): boolean {
  return 2 * FLANK_DECK_WIDTH_FT + pathFt <= gapFt;
}

/** Private deck area created by running the flank as a room instead of a path. */
export function flankDeckAreaSqFt(u: ObservedUnit): number {
  const f = assessFit(u);
  if (!f.needsFlankWalk) return 0;
  return Math.round(FLANK_DECK_WIDTH_FT * f.walkToDoorFt);
}

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
    verdict = `✅ Glass on the view. Door ${walkToDoorFt} ft up the flank, so run that flank as a `
      + `${FLANK_DECK_WIDTH_FT} ft PRIVATE DECK — ${Math.round(FLANK_DECK_WIDTH_FT * walkToDoorFt)} sq ft `
      + 'of outdoor room at your own door, which the shared deck cannot give you. The door faces the '
      + `${FLANK_SIDE} wall, facing away into the trees, so the pair is handed.`;
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

// ---------------------------------------------------------------------------
// MIXING MODELS — three different questions wearing one coat
// ---------------------------------------------------------------------------

/**
 * "Can we mix and match" is really three questions, and they have different
 * answers:
 *
 *   ON ONE DECK      Two units sharing a deck must agree on glazing wall,
 *                    roughly agree on width, and agree on whether they need a
 *                    flank walk. Otherwise the deck's back edge goes ragged and
 *                    the path detail becomes two details.
 *
 *   ACROSS THE PARK  Freely, IF the lots are datumed properly and the road is
 *                    built for the widest unit you will ever bring. The dock
 *                    standard already wants this.
 *
 *   ACROSS MAKERS    The expensive one. Volume is what buys handed plans, and
 *                    splitting it between two makers can lose the threshold at
 *                    both.
 */

/** Beyond this the two gable widths read as a mistake rather than a pair. */
export const PAIR_WIDTH_TOLERANCE_FT = 2;

export interface PairCompatibility {
  a: string;
  b: string;
  compatible: boolean;
  reasons: string[];
}

export function pairOnOneDeck(a: ObservedUnit, b: ObservedUnit): PairCompatibility {
  const reasons: string[] = [];
  if (a.glassWall !== b.glassWall) {
    reasons.push(`Glazing walls differ (${a.glassWall} vs ${b.glassWall}), so one would stand gable-on `
      + 'and the other broadside. They cannot share a back edge.');
  }
  const dw = Math.round(Math.abs(a.widthFt - b.widthFt) * 100) / 100;
  if (dw > PAIR_WIDTH_TOLERANCE_FT) {
    reasons.push(`Gable widths differ by ${dw} ft against a ${PAIR_WIDTH_TOLERANCE_FT} ft tolerance — `
      + 'the deck edge reads ragged rather than paired.');
  }
  const fa = assessFit(a), fb = assessFit(b);
  if (fa.needsFlankWalk !== fb.needsFlankWalk) {
    reasons.push('One needs a flank walkway and the other does not, so the path serves one door and '
      + 'not the other. Two details where the render has one.');
  }
  if (a.glassWall === 'side' && b.glassWall === 'side' && !broadsidePairFits(a)) {
    reasons.push('Both are side-glazed, and a broadside pair does not fit this deck.');
  }
  return { a: a.model, b: b.model, compatible: reasons.length === 0, reasons };
}

/**
 * THE DATUM RULE, and it is what makes mixing across the park work at all.
 *
 * NEC measures the pedestal window from the REAR OF THE STAND, and the stand is
 * sized to the unit. Centre two different-length units on their pads and the
 * rear line moves, so the pedestal moves, so no two lots are the same lot.
 *
 * Set every unit to a COMMON REAR DATUM instead — the glass end, on the deck
 * edge. Then the glass line runs unbroken across the park, the pedestal window
 * lands in the same place on every lot, and only the uphill end varies with
 * length. Which is the ragged end nobody photographs, behind the units, facing
 * the lane.
 *
 * The render already does this: both gable ends sit on one line.
 */
export const COMMON_REAR_DATUM = {
  rule: 'Datum every unit to its GLASS end on the deck edge, never to the centre of its pad.',
  buys: [
    'One pedestal detail for every lot, because the rear of the stand never moves.',
    'An unbroken glass line across the frontage, whatever mix of lengths sits behind it.',
    'Length variation pushed to the uphill end, which faces the lane and is never photographed.',
  ],
  costs: 'Stands differ in length, so the pads are not interchangeable — set out from the deck edge.',
} as const;

/** Road geometry is set by the WIDEST unit that will ever arrive, not the average. */
export function parkRoadWidthGovernedBy(units: readonly ObservedUnit[]): { model: string; widthFt: number } {
  const widest = [...units].sort((x, y) => y.widthFt - x.widthFt)[0];
  return { model: widest.model, widthFt: widest.widthFt };
}

/**
 * ⚠️ THE EXPENSIVE ONE. Handed plans are bought with volume, and volume does not
 * pool across makers. Ten Zook units unlock a reversed plan at Zook; five Zook
 * and five Irontown unlock nothing anywhere, and the render's symmetry needs a
 * reversed plan.
 */
export const MIXING_ACROSS_MAKERS = {
  theTrap:
    'Handing is bought with volume and volume does not pool. Ten units at one maker unlocks a reversed '
    + 'plan there; five and five unlocks nothing at either — and the paired composition needs one.',
  alsoCosts: [
    'Certification has to be chased per maker — dual labelling, RVIA membership, delivery to NC.',
    'The road is built for the widest unit in the mix, so one wide model taxes every corner.',
    'Set-up guidance differs per maker, and at least two of them disagree with the state on the tow bar.',
  ],
  whereItIsCheap:
    'Mixing WITHIN a maker costs almost nothing — same certification, same delivery, same set-up, one '
    + 'volume count. Irontown\'s Cabana and Mysa share a footprint class and a language; so do Zook\'s '
    + 'three A-frames.',
} as const;

/**
 * WHAT THE COMPATIBILITY MATRIX ACTUALLY SAYS.
 *
 * Six of twenty-eight cross-model pairs can share a deck, and all six are pairs
 * of units that BOTH need a flank walkway. They are consistent with each other
 * in the way two limps are consistent. Meanwhile the one unit whose door lands
 * near the deck — the Cabana — is compatible with NOTHING, because everything
 * else drags a 22 to 27 ft walk behind it.
 *
 * So cross-model pairing is not the opportunity it looks like. The answer is
 * duller and better: PAIR A UNIT WITH ITSELF, AND VARY BETWEEN DECKS. Identical
 * pairs are always compatible by construction, they are where the render's
 * symmetry comes from, and they collapse the entry to a single detail per deck.
 * The variety the park needs comes from putting a different model on the NEXT
 * deck, not a different model on the same one.
 */
export const PAIRING_VERDICT = {
  rule: 'Pair a unit with itself. Vary the model between decks, never within one.',
  why: [
    'Identical pairs are compatible by construction — same glazing wall, no width step, one entry detail.',
    'It is where the render\'s symmetry comes from; a mismatched pair reads as a mistake, not a pair.',
    'Variety across 38 short-stay lots comes from the next deck along, which nobody photographs together.',
  ],
  theTrapItAvoids:
    'Of twenty-eight cross-model pairs only six work, and all six are two units that BOTH need a flank '
    + 'walkway. The one unit that does not need one is compatible with nothing.',
} as const;

export function identicalPairWorks(u: ObservedUnit): boolean {
  return pairOnOneDeck(u, u).compatible;
}

/**
 * Units that make a good identical pair on this deck, shortest walk first.
 *
 * A flank deck is no longer a disqualifier — it is an amenity with an area and
 * a cost. What still disqualifies is a pair that physically will not fit.
 */
export function rankedForPairing(units: readonly ObservedUnit[]): ObservedUnit[] {
  return units
    .filter(identicalPairWorks)
    .sort((a, b) => assessFit(a).walkToDoorFt - assessFit(b).walkToDoorFt);
}

/** Total deck for a paired lot: one shared deck plus two private flanks. */
export function pairedDeckAreaSqFt(u: ObservedUnit): {
  sharedSqFt: number; flankSqFt: number; totalSqFt: number; privateShare: number;
} {
  const shared = SHARED_DECK.deckWidthFt * SHARED_DECK.deckDepthFt;
  const flank = 2 * flankDeckAreaSqFt(u);
  const total = shared + flank;
  return {
    sharedSqFt: shared, flankSqFt: flank, totalSqFt: total,
    privateShare: Math.round((flank / total) * 100) / 100,
  };
}
