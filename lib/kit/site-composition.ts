/**
 * SITE COMPOSITION — arranging one, two or three park units around open decks.
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
    id: 'splayed-v',
    title: 'Two units — splayed V on one open deck',
    unitCount: 2,
    requiresEntry: 'end',
    units: [
      { id: 'A', model: 'Nook Family', ...nook, at: { x: -14.6, y: 29.6 }, rotDeg: 14, hitch: 'far-end' },
      { id: 'B', model: 'Nook Family', ...nook, at: { x: 14.6, y: 29.6 }, rotDeg: -14, hitch: 'far-end' },
    ],
    decks: [{
      id: 'deck', cantileverFt: 2,
      outline: [{ x: -24, y: 0 }, { x: 24, y: 0 }, { x: 20, y: 15 }, { x: -20, y: 15 }],
    }],
    why:
      'Both gable ends face one open deck and the units fan apart behind it, so neither looks into the '
      + 'other and each gets its own slice of view. The gap between them stays walkable and becomes the '
      + 'path up the hill. Because they diverge, their tow lanes diverge too — each leaves without the '
      + 'other moving. This is the arrangement the reference render shows.',
  },
  {
    id: 'parallel-open',
    title: 'Two units — parallel, deck in the gap',
    unitCount: 2,
    requiresEntry: 'side',
    units: [
      { id: 'A', model: 'Denali', ...denali, at: { x: -16, y: 0 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'B', model: 'Denali', ...denali, at: { x: 16, y: 0 }, rotDeg: 0, hitch: 'far-end' },
    ],
    decks: [{
      id: 'deck', cantileverFt: 2,
      outline: [{ x: -10, y: -32 }, { x: 10, y: -32 }, { x: 10, y: 14 }, { x: -10, y: 14 }],
    }],
    why:
      'Side doors face each other across one open deck, which runs past the downhill ends to make a '
      + 'view terrace rather than a corridor between two walls. It is the most efficient shape per foot of deck '
      + 'and the tow lanes run parallel and clear. It is also the shape that most tempts someone to roof '
      + 'the gap — which is the one move that would make the pair a single dwelling.',
  },
  {
    id: 'fan-of-three',
    title: 'Three units — fan onto a shared deck',
    unitCount: 3,
    requiresEntry: 'end',
    units: [
      { id: 'A', model: 'Nook Family', ...nook, at: { x: -25.5, y: 30 }, rotDeg: 24, hitch: 'far-end' },
      { id: 'B', model: 'Nook Family', ...nook, at: { x: 0, y: 31 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'C', model: 'Nook Family', ...nook, at: { x: 25.5, y: 30 }, rotDeg: -24, hitch: 'far-end' },
    ],
    decks: [{
      id: 'deck', cantileverFt: 2,
      outline: [{ x: -34, y: 0 }, { x: 34, y: 0 }, { x: 30, y: 17 }, { x: -30, y: 17 }],
    }],
    why:
      'The splayed V extended. Three gable ends onto one deck with the fire at the centroid, each unit '
      + 'turned far enough that no two look into each other. The fan is what keeps the tow lanes apart: '
      + 'they radiate, so the middle unit is never trapped behind its neighbours.',
  },
  {
    id: 'contour-line-three',
    title: 'Three units — staggered along the contour',
    unitCount: 3,
    requiresEntry: 'side',
    units: [
      { id: 'A', model: 'Denali', ...denali, at: { x: -50, y: -20 }, rotDeg: 90, hitch: 'far-end' },
      { id: 'B', model: 'Denali', ...denali, at: { x: 0, y: 0 }, rotDeg: 90, hitch: 'far-end' },
      { id: 'C', model: 'Denali', ...denali, at: { x: 50, y: 20 }, rotDeg: 90, hitch: 'far-end' },
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
    id: 'courtyard-three',
    title: 'Three units — courtyard (do not build)',
    unitCount: 3,
    requiresEntry: 'end',
    units: [
      { id: 'A', model: 'Nook Family', ...nook, at: { x: -22, y: 20 }, rotDeg: 90, hitch: 'far-end' },
      { id: 'B', model: 'Nook Family', ...nook, at: { x: 0, y: 38 }, rotDeg: 180, hitch: 'far-end' },
      { id: 'C', model: 'Nook Family', ...nook, at: { x: 22, y: 20 }, rotDeg: -90, hitch: 'far-end' },
    ],
    decks: [{
      id: 'deck', cantileverFt: 0,
      outline: [{ x: -14, y: 4 }, { x: 14, y: 4 }, { x: 14, y: 26 }, { x: -14, y: 26 }],
    }],
    why:
      'Three units enclosing a deck on three sides. It photographs well and it is the shape to refuse: '
      + 'the units face inward, so the back unit tows straight across the deck and cannot leave at all. '
      + 'The flanking units happen to have clear lanes outward, which is exactly what makes this shape '
      + 'seductive on paper — two thirds of it works. The gap between units also closes to a few feet, '
      + 'at which point three vehicles parked near each other start reading as one compound: the whole '
      + 'argument traded away for an enclosed yard.',
    rejected: 'The back unit\'s tow lane crosses the shared deck, and the units close to under the '
      + 'minimum separation. One unit cannot leave without the site coming apart.',
  },
];

export function layoutById(id: string): SiteLayout | undefined {
  return LAYOUTS.find((l) => l.id === id);
}

/** Layouts a given catalogue unit can actually be arranged in. */
export function layoutsFor(unit: ObservedUnit): SiteLayout[] {
  return LAYOUTS.filter((l) => !l.rejected && l.requiresEntry === unit.entry);
}
