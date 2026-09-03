/**
 * SITE COMPOSITION — arranging one, two or three park units around open decks.
 *
 * EVERY UNIT SITS SQUARE. Rotations are multiples of 90 degrees and nothing is
 * splayed: an angled unit needs an angled pad, angled deck framing and a bevel
 * on every board that meets it, which is site labour spent on geometry rather
 * than on the building. Orthogonal shapes — the L, the U, the parallel pair —
 * do the same work with square cuts. ORTHOGONAL_ONLY is enforced by the gate.
 *
 * Two facts from the catalogues drive everything here, and neither is obvious
 * until you go looking for a floor plan:
 *
 *   1. ENTRY IS EITHER ON THE LONG WALL OR ON THE GABLE END, and which one you
 *      bought decides which arrangements are even available. A shared deck that
 *      several gable ends face — the fan, the splayed V — needs END-ENTRY units.
 *      Side-entry units cannot make that shape: their doors would face away.
 *
 *   2. THE DOOR AND THE GLASS ARE OFTEN ON DIFFERENT WALLS. Zook's A-Frame
 *      Classic enters on the long side and puts its big tempered-glass gable on
 *      the end. Its deck therefore wants to be in two places at once, which is
 *      why the single-unit answer is an L that wraps from the door round to the
 *      view.
 *
 * And one constraint this project had not written down: A UNIT THAT CANNOT BE
 * TOWED OUT IS NOT A VEHICLE. If lifting one unit off the site means dismantling
 * a deck or moving another unit first, the composition argument survives on
 * paper and dies in the yard. Every layout here is checked for a clear sweep,
 * and the rule that falls out of it is short: SET THE UNIT DOWN WITH THE HITCH
 * POINTING AT ITS EXIT.
 */

export type EntryPattern = 'side' | 'end';

/** Where the tongue sits relative to the entry. Decides which way the unit leaves. */
export type HitchEnd = 'entry-end' | 'far-end';

export interface ObservedUnit {
  maker: string;
  model: string;
  widthFt: number;
  lengthFt: number;
  interiorSqFt: number;
  entry: EntryPattern;
  /** Verbatim-sourced notes. Kept because the entry pattern is not published in catalogues. */
  entryNote: string;
  factoryPorch: string | null;
  /** True when the big glazing is NOT on the same wall as the door. */
  glassSplitFromDoor: boolean;
  /** Tows inside the 8.5 ft limit with no permit, escort or route approval. */
  towsPermitFree: boolean;
  source: string;
}

/**
 * Observed models, with entry read off published floor plans and descriptions.
 * Every catalogue index omits door position; these came from model pages.
 */
export const OBSERVED_UNITS: readonly ObservedUnit[] = [
  {
    maker: 'Zook', model: 'Denali', widthFt: 12, lengthFt: 42, interiorSqFt: 384,
    entry: 'side',
    entryNote: 'Full-lite side entry door on the long wall, plus a 72 in full-lite sliding patio door onto the deck.',
    factoryPorch: '8 x 12 covered deck on a long side, aluminium rail on three sides',
    glassSplitFromDoor: false,
    towsPermitFree: false,
    source: 'zookcabins.com/cabin/denali',
  },
  {
    maker: 'Zook', model: 'A-Frame Classic', widthFt: 13.83, lengthFt: 29.17, interiorSqFt: 400,
    entry: 'side',
    entryNote: 'Front door set along the SIDE with an inset for weather protection; the tempered-glass A-frame window spans the GABLE.',
    factoryPorch: null,
    glassSplitFromDoor: true,
    towsPermitFree: false,
    source: 'zookcabins.com/cabin/a-frame-park-model-home',
  },
  {
    maker: 'Zook', model: 'Nook Family', widthFt: 8.5, lengthFt: 30, interiorSqFt: 255,
    entry: 'end',
    entryNote: 'Entry door on the short END wall under a wood awning; floor plan is an end-porch configuration.',
    factoryPorch: 'covered end porch',
    glassSplitFromDoor: false,
    towsPermitFree: true,
    source: 'zookcabins.com/cabin/nook-family',
  },
];

/** The road limit. At or under this a unit moves with no permit, escort or route approval. */
export const PERMIT_FREE_WIDTH_FT = 8.5;

export function unitsBy(entry: EntryPattern): ObservedUnit[] {
  return OBSERVED_UNITS.filter((u) => u.entry === entry);
}

/**
 * The A-Frame Classic's delivery scope reads "Final Leveling, Adjustments and
 * Skirting to be done by Customer". That is the manufacturer handing the single
 * most identity-destroying decision on the whole unit to whoever is cheapest on
 * site. deck-pergola.ts refuses to specify skirting; this is the evidence for
 * why that refusal has to be loud rather than quiet.
 */
export const SKIRTING_IS_DELEGATED = {
  observedAt: 'Zook A-Frame Classic',
  deliveryScope: 'Final Leveling, Adjustments and Skirting to be done by Customer',
  risk:
    'Left unspecified, a landscape contractor defaults to masonry, because masonry is what "finished" '
    + 'looks like to a landscaper. A masonry skirt and a cut hitch are the two cheapest ways to make a '
    + 'park model permanently stop being one. This must be specified in the site scope, not inherited.',
  instruction: 'Removable panels only. Never masonry. Never cut the hitch.',
} as const;

/**
 * WHAT THE MANUFACTURER ACTUALLY REQUIRES — Zook site-prep and delivery pages.
 *
 * The site-prep page settles a question this kit had been arguing on tax grounds
 * alone. Zook states plainly that the unit "must remain attached to its wheels",
 * recommends blocking it up so it is not RESTING on them, and then forbids the
 * exact thing the treehouse photographs show:
 *
 *     "You should not install foundations such as pier and beam, crawl space,
 *      or pit foundations"
 *
 * So lifting a park model onto a timber post frame is not merely a tax risk. It
 * is outside the manufacturer's own site-prep instructions, which is a warranty
 * and a listing problem before anyone reaches the depreciation question. The
 * accent budget's answer — cut the pad, do not lift the box — is now sourced,
 * not merely argued.
 */
export const PAD_SPEC = {
  stoneDepthIn: [4, 5] as const,
  concreteDepthIn: [4, 6] as const,
  /** The pad runs past the unit on every side. */
  marginPastUnitFt: 1,
  requirements: [
    'As level a location as possible — the more sloped, the harder a lasting foundation becomes.',
    'Ground as firm as possible; if recently excavated, wait or choose another location.',
    'Grade for drainage — bad drainage causes settling, water damage and uneven moisture.',
  ],
  blocking: 'Block up on wooden or masonry blocks so the unit is not RESTING on its wheels.',
  wheelsStayOn: 'The park model must remain ATTACHED to its wheels.',
  source: 'zookcabins.com/planning/park-model/site-prep',
} as const;

/** Foundations the manufacturer explicitly rules out. Note what is on this list. */
export const PROHIBITED_FOUNDATIONS = ['pier and beam', 'crawl space', 'pit'] as const;

export function foundationAllowed(kind: string): boolean {
  return !PROHIBITED_FOUNDATIONS.some((f) => kind.toLowerCase().includes(f));
}

/**
 * DELIVERY ACCESS. The corner figure is the one that matters on a switchback
 * road, because it is not a constant — it grows with the unit.
 */
export const DELIVERY_ACCESS = {
  straightWidthFt: 18,
  straightClearanceFt: 16,
  verticalClearanceFt: 16,
  /** Corners need this PLUS the unit's own width. */
  cornerBaseFt: 16,
  notes: [
    'All corners must be accessible for a semi truck; branches trimmed and low wires tied up.',
    'Curbside is the delivery policy — placement on the pad happens only on request.',
    'If the pad is unreachable, a skid steer is rented on the day and charged to the customer.',
    'The customer carries liability for wires, cables, septic tanks and pipes broken during delivery.',
    'Zook does not do site preparation; the pad is entirely the customer\'s scope.',
  ],
  source: 'zookcabins.com/planning/park-model/delivery-details',
} as const;

/** Clearance a corner must hold for a unit of this width. Grows with the unit. */
export function cornerClearanceFt(unitWidthFt: number): number {
  return DELIVERY_ACCESS.cornerBaseFt + unitWidthFt;
}

/** Corner width saved per switchback by choosing the narrower unit. */
export function cornerSavingFt(wideFt: number, narrowFt: number): number {
  return Math.round((cornerClearanceFt(wideFt) - cornerClearanceFt(narrowFt)) * 100) / 100;
}

/**
 * CUSTOMISATION IS A VOLUME UNLOCK, NOT A LINE ITEM.
 *
 *   "Our Zook Cabin Park Model Homes are not customizable when ordered as a
 *    single unit."
 *   "If you want to purchase 10 or more park-model homes, we would be willing
 *    to create a custom floor plan."
 *
 * Every layout below that needs a reversed plan is therefore unavailable at
 * small volume from this maker. Door position is a CONSTRAINT under ten units
 * and a VARIABLE at ten or more, which makes the tenth unit worth more than the
 * ninth for reasons that have nothing to do with price.
 */
export const CUSTOMISATION = {
  singleUnit: 'Not customizable when ordered as a single unit.',
  unlockAtUnits: 10,
  unlocked: 'At ten or more units the maker will create a custom floor plan.',
  whatMirroringBuys:
    'A reversed plan moves the door to the other long wall while the hitch stays at the same end. '
    + 'Rotating the unit 180 degrees also moves the door, but it reverses the exit direction with it. '
    + 'Mirroring buys door position without spending tow direction.',
  source: 'zookcabins.com/planning/park-model/construction-details',
} as const;

export function customisationAvailableAt(unitsOrdered: number): boolean {
  return unitsOrdered >= CUSTOMISATION.unlockAtUnits;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface Pt { x: number; y: number }

export interface PlacedUnit {
  id: string;
  model: string;
  widthFt: number;
  lengthFt: number;
  /** Centre in site feet. +y is uphill/back, +x is right. */
  at: Pt;
  /** Counter-clockwise degrees. At 0 the length runs along +y and the entry end faces -y. */
  rotDeg: number;
  entry: EntryPattern;
  hitch: HitchEnd;
  /**
   * A reversed (handed) plan. Mirroring flips LEFT/RIGHT only: the door moves
   * to the opposite long wall while the hitch stays at the same physical end.
   * That is the whole reason it matters — rotating a unit 180 degrees also moves
   * the door, but it reverses the exit direction with it. Mirroring buys door
   * position without spending tow direction.
   */
  mirrored?: boolean;
}

export interface DeckPlane {
  id: string;
  /** Site-foot polygon, wound consistently. One plane, open to the sky. */
  outline: Pt[];
  /** Feet the deck runs past its last beam, at the downhill edge. */
  cantileverFt: number;
}

export interface SiteLayout {
  id: string;
  title: string;
  unitCount: 1 | 2 | 3;
  /** The entry pattern this shape REQUIRES. The central finding. */
  requiresEntry: EntryPattern;
  units: PlacedUnit[];
  decks: DeckPlane[];
  why: string;
  /** Set when the layout is recorded as a shape to avoid. */
  rejected?: string;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Corners of a placed unit, counter-clockwise in site feet. */
export function unitCorners(u: PlacedUnit): Pt[] {
  const c = Math.cos(rad(u.rotDeg)), s = Math.sin(rad(u.rotDeg));
  const hw = u.widthFt / 2, hl = u.lengthFt / 2;
  return ([[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]] as const).map(([x, y]) => ({
    x: u.at.x + x * c - y * s,
    y: u.at.y + x * s + y * c,
  }));
}

/**
 * Outward normal of the wall the door is in. For end entry the door is always in
 * the entry gable, so mirroring cannot move it; for side entry it is in one long
 * wall, and mirroring is the only thing that moves it to the other.
 */
export function doorFacing(u: PlacedUnit): Pt {
  const c = Math.cos(rad(u.rotDeg)), s2 = Math.sin(rad(u.rotDeg));
  if (u.entry === 'end') { const a = lengthAxis(u); return { x: -a.x, y: -a.y }; }
  return u.mirrored ? { x: -c, y: -s2 } : { x: c, y: s2 };
}

/** Mid-point of the door wall, on the face of the unit. */
export function doorPoint(u: PlacedUnit): Pt {
  const f = doorFacing(u);
  const reach = u.entry === 'end' ? u.lengthFt / 2 : u.widthFt / 2;
  return { x: u.at.x + f.x * reach, y: u.at.y + f.y * reach };
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y)
      && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** How far off the door wall we sample to ask "is there deck here". */
export const DOOR_LANDING_FT = 1.5;

/**
 * A door that does not open onto a deck opens onto a drop. This is the check the
 * first draft of these layouts did not have, and half of them failed it.
 */
export function doorOpensOntoDeck(u: PlacedUnit, layout: SiteLayout): boolean {
  const f = doorFacing(u), d = doorPoint(u);
  const probe = { x: d.x + f.x * DOOR_LANDING_FT, y: d.y + f.y * DOOR_LANDING_FT };
  return layout.decks.some((deck) => pointInPolygon(probe, deck.outline));
}

export function everyDoorLands(layout: SiteLayout): boolean {
  return layout.units.every((u) => doorOpensOntoDeck(u, layout));
}

/** Units in this layout that must be ordered as reversed plans. */
export function mirroredUnits(layout: SiteLayout): string[] {
  return layout.units.filter((u) => u.mirrored).map((u) => u.id);
}

export function requiresMirroring(layout: SiteLayout): boolean {
  return mirroredUnits(layout).length > 0;
}

/** Unit vector along the unit's length, pointing away from the entry end. */
export function lengthAxis(u: PlacedUnit): Pt {
  return { x: -Math.sin(rad(u.rotDeg)), y: Math.cos(rad(u.rotDeg)) };
}

/** Separating-axis test for two convex polygons. Touching is not overlapping. */
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

/** Clear width each side of a unit as it is drawn out. */
export const TOW_SIDE_CLEARANCE_FT = 2;
/** Run beyond the unit's own length so the tractor is clear too. */
export const TOW_EXIT_RUN_FT = 25;

/**
 * The corridor a unit sweeps as it leaves, EXCLUDING the ground it already
 * stands on. It leaves hitch-first, so the direction depends on which end the
 * tongue is at — which is a placement decision, not a fact about the model.
 */
export function towSweep(u: PlacedUnit): Pt[] {
  const axis = lengthAxis(u);
  const dir = u.hitch === 'far-end' ? 1 : -1;
  const dx = axis.x * dir, dy = axis.y * dir;
  const px = -dy, py = dx;
  const halfW = u.widthFt / 2 + TOW_SIDE_CLEARANCE_FT;
  const start = u.lengthFt / 2;
  const end = u.lengthFt / 2 + u.lengthFt + TOW_EXIT_RUN_FT;
  const along = (t: number, side: number): Pt => ({
    x: u.at.x + dx * t + px * halfW * side,
    y: u.at.y + dy * t + py * halfW * side,
  });
  return [along(start, -1), along(end, -1), along(end, 1), along(start, 1)];
}

export interface TowVerdict {
  unitId: string;
  clear: boolean;
  blockedBy: string[];
}

/** Every unit must be able to leave without anything else being taken apart. */
export function checkTowEgress(layout: SiteLayout): TowVerdict[] {
  return layout.units.map((u) => {
    const sweep = towSweep(u);
    const blockedBy: string[] = [];
    for (const other of layout.units) {
      if (other.id === u.id) continue;
      if (polysOverlap(sweep, unitCorners(other))) blockedBy.push(other.id);
    }
    for (const d of layout.decks) {
      if (polysOverlap(sweep, d.outline)) blockedBy.push(d.id);
    }
    return { unitId: u.id, clear: blockedBy.length === 0, blockedBy };
  });
}

export function layoutTowsClear(layout: SiteLayout): boolean {
  return checkTowEgress(layout).every((v) => v.clear);
}

/** Narrowest gap between any two units — the walkable break that keeps them separate. */
export function minGapFt(layout: SiteLayout): number {
  if (layout.units.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < layout.units.length; i += 1) {
    for (let j = i + 1; j < layout.units.length; j += 1) {
      const a = unitCorners(layout.units[i]), b = unitCorners(layout.units[j]);
      for (const p of a) for (const q of b) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    }
  }
  return Math.round(best * 10) / 10;
}

/** Below this two units stop reading as two objects and start reading as one. */
export const MIN_SEPARATION_FT = 8;

/**
 * Units sit square. An angled unit costs an angled pad, angled framing and a
 * bevel on every board that lands on it — site labour spent on geometry rather
 * than on the building, and this programme is trying to move labour the other
 * way. The L and the U reach the same shapes with square cuts.
 */
export const ORTHOGONAL_ONLY = true;

export function isOrthogonal(layout: SiteLayout): boolean {
  return layout.units.every((u) => ((u.rotDeg % 90) + 90) % 90 === 0);
}

// ---------------------------------------------------------------------------
// The layouts
// ---------------------------------------------------------------------------

const nook = { widthFt: 8.5, lengthFt: 30, entry: 'end' as EntryPattern };
const denali = { widthFt: 12, lengthFt: 42, entry: 'side' as EntryPattern };
const aframe = { widthFt: 13.83, lengthFt: 29.17, entry: 'side' as EntryPattern };

export const LAYOUTS: readonly SiteLayout[] = [
  {
    id: 'single-l-wrap',
    title: 'One unit — L-wrap from the door to the view',
    unitCount: 1,
    requiresEntry: 'side',
    units: [{ id: 'A', model: 'A-Frame Classic', ...aframe, at: { x: 0, y: 0 }, rotDeg: 0, hitch: 'far-end' }],
    decks: [{
      id: 'deck', cantileverFt: 2,
      outline: [
        { x: 6.915, y: -14.585 }, { x: 18.915, y: -14.585 }, { x: 18.915, y: 14.585 }, { x: 6.915, y: 14.585 },
      ],
    }, {
      id: 'deck-gable', cantileverFt: 2,
      outline: [
        { x: -6.915, y: -28.585 }, { x: 18.915, y: -28.585 }, { x: 18.915, y: -14.585 }, { x: -6.915, y: -14.585 },
      ],
    }],
    why:
      'The door is on the long side and the glass is on the gable, so the deck has to be in two places. '
      + 'An L solves it: a walking strip at the door, opening into the sitting area under the glass, with '
      + 'the cantilever at the far gable corner where the ground falls away.',
  },
  {
    id: 'single-end-deck',
    title: 'One unit — compact end deck',
    unitCount: 1,
    requiresEntry: 'end',
    units: [{ id: 'A', model: 'Nook Family', ...nook, at: { x: 0, y: 0 }, rotDeg: 0, hitch: 'far-end' }],
    decks: [{
      id: 'deck', cantileverFt: 2,
      outline: [{ x: -9, y: -31 }, { x: 9, y: -31 }, { x: 9, y: -15 }, { x: -9, y: -15 }],
    }],
    why:
      'Entry on the gable end, so everything happens at one end and the deck is small, square and cheap. '
      + 'The unit tows straight out the back. This is the least deck per unit of anything here.',
  },
  {
    id: 'l-pair',
    title: 'Two units — right-angle L on a corner deck',
    unitCount: 2,
    requiresEntry: 'end',
    units: [
      { id: 'A', model: 'Nook Family', ...nook, at: { x: 0, y: 26 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'B', model: 'Nook Family', ...nook, at: { x: 26, y: 0 }, rotDeg: -90, hitch: 'far-end' },
    ],
    decks: [{
      id: 'deck', cantileverFt: 2,
      outline: [{ x: -10, y: -10 }, { x: 11, y: -10 }, { x: 11, y: 11 }, { x: -10, y: 11 }],
    }],
    why:
      'Two units set square to each other, both gable doors opening onto one deck in the crook of the L. '
      + 'Neither looks into the other because they face ninety degrees apart, and the open corner points '
      + 'downhill at the view, which is where the cantilever goes. Every cut on the deck is a square cut. '
      + 'They tow in opposite directions, so neither waits on the other.',
  },
  {
    id: 'parallel-open',
    title: 'Two units — parallel, deck in the gap',
    unitCount: 2,
    requiresEntry: 'side',
    units: [
      { id: 'A', model: 'Denali', ...denali, at: { x: -16, y: 0 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'B', model: 'Denali', ...denali, at: { x: 16, y: 0 }, rotDeg: 0, hitch: 'far-end', mirrored: true },
    ],
    decks: [{
      id: 'deck', cantileverFt: 2,
      outline: [{ x: -10, y: -32 }, { x: 10, y: -32 }, { x: 10, y: 14 }, { x: -10, y: 14 }],
    }],
    why:
      'Side doors face each other across one open deck, which runs past the downhill ends to make a view '
      + 'terrace rather than a corridor between two walls. It is the most efficient shape per foot of deck '
      + 'and the tow lanes run parallel and clear. It is also the shape that most tempts someone to roof '
      + 'the gap — which is the one move that would make the pair a single dwelling.',
  },
  {
    id: 'trident-three',
    title: 'Three units — three doors onto one deck',
    unitCount: 3,
    requiresEntry: 'end',
    units: [
      { id: 'A', model: 'Nook Family', ...nook, at: { x: -26, y: 4 }, rotDeg: 90, hitch: 'far-end' },
      { id: 'B', model: 'Nook Family', ...nook, at: { x: 0, y: 34 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'C', model: 'Nook Family', ...nook, at: { x: 26, y: 4 }, rotDeg: -90, hitch: 'far-end' },
    ],
    decks: [{
      id: 'deck', cantileverFt: 2,
      outline: [{ x: -11, y: -6 }, { x: 11, y: -6 }, { x: 11, y: 19 }, { x: -11, y: 19 }],
    }],
    why:
      'End entry puts the door on the SHORT wall, so three of these cannot line the sides of a court — '
      + 'they point into it like spokes, and that is the honest name for this shape. It works well: three '
      + 'doors onto one deck, the fourth side open downhill for the view and the cantilever, and every '
      + 'hitch pointing outward so each unit draws straight out without the others moving. The gaps '
      + 'between the arms stay walkable, which is what keeps three vehicles reading as three.',
  },
  {
    id: 'u-court',
    title: 'Three units — true U, doors lining three sides',
    unitCount: 3,
    requiresEntry: 'side',
    units: [
      { id: 'A', model: 'Denali', ...denali, at: { x: -30, y: 5 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'B', model: 'Denali', ...denali, at: { x: 0, y: 42 }, rotDeg: 90, hitch: 'far-end', mirrored: true },
      { id: 'C', model: 'Denali', ...denali, at: { x: 30, y: 5 }, rotDeg: 0, hitch: 'far-end', mirrored: true },
    ],
    decks: [
      { id: 'deck-court', cantileverFt: 2, outline: [{ x: -24, y: -16 }, { x: 24, y: -16 }, { x: 24, y: 25 }, { x: -24, y: 25 }] },
      { id: 'deck-back', cantileverFt: 0, outline: [{ x: -21, y: 25 }, { x: 21, y: 25 }, { x: 21, y: 36 }, { x: -21, y: 36 }] },
    ],
    why:
      'This is the U proper, and it needs SIDE entry to exist: the door on the long wall is what lets a '
      + 'unit lie along an edge of the court and still open onto it. Two units down the sides, one across '
      + 'the head, the fourth side left open downhill for the view and the cantilever. The deck is drawn '
      + 'as two planes for a reason — the upper one narrows to stay out of the side units\' tow lanes, '
      + 'which is what lets every unit leave from a shape that looks enclosed. '
      + '⚠️ It is also the shape closest to the line: three units around a court can start reading as one '
      + 'compound rather than three vehicles parked near each other. Keep the fourth side genuinely open, '
      + 'never roof any part of it, and put the question to the tax workstream before building.',
  },
  {
    id: 'contour-line-three',
    title: 'Three units — staggered along the contour',
    unitCount: 3,
    requiresEntry: 'side',
    units: [
      { id: 'A', model: 'Denali', ...denali, at: { x: -50, y: -20 }, rotDeg: 90, hitch: 'far-end', mirrored: true },
      { id: 'B', model: 'Denali', ...denali, at: { x: 0, y: 0 }, rotDeg: 90, hitch: 'far-end', mirrored: true },
      { id: 'C', model: 'Denali', ...denali, at: { x: 50, y: 20 }, rotDeg: 90, hitch: 'far-end', mirrored: true },
    ],
    decks: [
      { id: 'deck-A', cantileverFt: 2, outline: [{ x: -65, y: -38 }, { x: -29, y: -38 }, { x: -29, y: -26 }, { x: -65, y: -26 }] },
      { id: 'deck-B', cantileverFt: 2, outline: [{ x: -15, y: -18 }, { x: 21, y: -18 }, { x: 21, y: -6 }, { x: -15, y: -6 }] },
      { id: 'deck-C', cantileverFt: 2, outline: [{ x: 35, y: 2 }, { x: 71, y: 2 }, { x: 71, y: 14 }, { x: 35, y: 14 }] },
    ],
    why:
      'Long units lying ALONG the contour, each with its own side deck at its own door and no shared '
      + 'plane at all. Lying along the slope keeps every pad a shallow, even cut; turned the other way '
      + 'each unit needs a deep cut at one end. The stagger is then structural rather than stylistic: '
      + 'units in a straight row tow into one another, so each steps far enough uphill to pull out past '
      + 'its neighbour. Every deck also stops short of the lane behind it.',
  },
  {
    id: 'trident-hitched-in',
    title: 'Three units — the same trident, one hitch turned the wrong way',
    unitCount: 3,
    requiresEntry: 'end',
    units: [
      { id: 'A', model: 'Nook Family', ...nook, at: { x: -26, y: 4 }, rotDeg: 90, hitch: 'far-end' },
      { id: 'B', model: 'Nook Family', ...nook, at: { x: 0, y: 34 }, rotDeg: 0, hitch: 'entry-end' },
      { id: 'C', model: 'Nook Family', ...nook, at: { x: 26, y: 4 }, rotDeg: -90, hitch: 'far-end' },
    ],
    decks: [{
      id: 'deck', cantileverFt: 2,
      outline: [{ x: -11, y: -6 }, { x: 11, y: -6 }, { x: 11, y: 19 }, { x: -11, y: 19 }],
    }],
    why:
      'Exactly the trident above, to the inch, with one difference: the back unit was set down with its tongue '
      + 'pointing into the court instead of uphill. Nothing about the drawing looks wrong. The unit is '
      + 'now permanently parked, because the only way out is across its own deck. This is why hitch '
      + 'orientation belongs on the delivery drawing and not in someone\'s head on the day.',
    rejected: 'The back unit\'s tow lane runs across the shared deck. Same geometry as the working '
      + 'trident — one placement decision, made once, at delivery.',
  },
];

export function layoutById(id: string): SiteLayout | undefined {
  return LAYOUTS.find((l) => l.id === id);
}

/** Layouts a given catalogue unit can actually be arranged in. */
export function layoutsFor(unit: ObservedUnit): SiteLayout[] {
  return LAYOUTS.filter((l) => !l.rejected && l.requiresEntry === unit.entry);
}
