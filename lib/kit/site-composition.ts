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
  /**
   * Which wall carries the full-height glazing. Across every model surveyed the
   * answer is the same — 'gable'. That is not a style preference: the long wall
   * is the towing face and is width-limited, while the gable is where a tall
   * window can go without touching the road envelope.
   */
  glassWall: 'gable' | 'side';
  /** True when the big glazing is NOT on the same wall as the door. */
  glassSplitFromDoor: boolean;
  /**
   * Where the door sits along the length, as a fraction from the glass end
   * (0 = at the glass, 1 = at the hitch end). Zook's A-frames put it at the far
   * end, beside the bathroom bump-out — so one deck cannot serve both without
   * running the whole flank.
   */
  doorAtFractionFromGlass: number;
  /** Reversed plans: what it takes to get one from this maker. */
  mirroring: 'standard' | 'volume-only' | 'unknown';
  /**
   * The maker's OWN words evidencing a full-height glass wall. Marketing that
   * merely promises "large windows", or a choice of "window designs", is not
   * evidence — a window is not a wall, and reading one as the other is how a
   * unit gets onto this list that does not belong on it.
   */
  glassEvidence: string;
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
    maker: 'Zook', model: 'A-Frame Studio', widthFt: 13.5, lengthFt: 32, interiorSqFt: 400,
    entry: 'side', glassWall: 'gable', glassSplitFromDoor: true, doorAtFractionFromGlass: 0.85,
    entryNote: 'Full-lite entry door on the LONG SIDE at the hitch end, beside the bathroom bump-out; '
      + 'custom full-glass A-frame window with black aluminium frame fills the front gable.',
    factoryPorch: null, towsPermitFree: false, mirroring: 'volume-only',
    glassEvidence: "\"Custom Full glass Aframe window in livingroom with tempered glass and black aluminum frame\"; the spec sheet also lists a 1 ft overhang around the 'Aframe glass wall'.",
    source: 'zookcabins.com/cabin/a-frame-studio',
  },
  {
    maker: 'Zook', model: 'A-Frame Bunkhouse', widthFt: 13.67, lengthFt: 31, interiorSqFt: 400,
    entry: 'side', glassWall: 'gable', glassSplitFromDoor: true, doorAtFractionFromGlass: 0.8,
    entryNote: 'Recessed entry niche with full-lite door on the LONG SIDE; custom tempered A-frame '
      + 'window with black aluminium frame on the front gable.',
    factoryPorch: null, towsPermitFree: false, mirroring: 'volume-only',
    glassEvidence: "\"breathtaking views through the beautiful A-frame glass on the front end of the building\"; \"a custom tempered A-frame window with black aluminum frame\".",
    source: 'zookcabins.com/cabin/a-frame-bunkhouse',
  },
  {
    maker: 'Zook', model: 'A-Frame Classic', widthFt: 13.83, lengthFt: 29.17, interiorSqFt: 400,
    entry: 'side', glassWall: 'gable', glassSplitFromDoor: true, doorAtFractionFromGlass: 0.75,
    entryNote: 'Front door set along the SIDE with an inset for weather protection; custom tempered '
      + 'glass with aluminium frame fills the living-room A-frame gable.',
    factoryPorch: null, towsPermitFree: false, mirroring: 'volume-only',
    glassEvidence: "\"the huge window spanning the entire front of the house\"; \"Custom tempered glass with an aluminum frame in the living room A-frame\".",
    source: 'zookcabins.com/cabin/a-frame-park-model-home',
  },
  {
    maker: 'Zook', model: 'Luna', widthFt: 11, lengthFt: 36, interiorSqFt: 400,
    entry: 'side', glassWall: 'gable', glassSplitFromDoor: true, doorAtFractionFromGlass: 0.75,
    entryNote: 'Fiberglass full-lite entry door; dramatic window wall on the GABLE end, black stained '
      + 'cedar surround with LED valance lighting. ⚠️ Door wall not published — confirm before siting.',
    factoryPorch: null, towsPermitFree: false, mirroring: 'volume-only',
    glassEvidence: "\"anchored by a dramatic window wall that frames the outdoors\"; black stained cedar surround to a 'large gable window' with LED valance lighting.",
    source: 'zookcabins.com/cabin/luna',
  },
  {
    maker: 'ÖÖD', model: 'Extended Park Model RV', widthFt: 11.16, lengthFt: 26.08, interiorSqFt: 291,
    entry: 'side', glassWall: 'side', glassSplitFromDoor: false, doorAtFractionFromGlass: 0.5,
    entryNote: 'THE EXCEPTION. A full mirror-glass facade on the LONG SIDE, extended by one panel over '
      + 'the standard model — so glass and entry share a wall and one deck serves both. Steel frame. '
      + '⚠️ Door position within the facade not published; confirm. ⚠️ Reflective glazing carries a real '
      + 'bird-strike duty and will mirror whatever stands in front of it, including the next unit.',
    factoryPorch: null, towsPermitFree: false, mirroring: 'unknown',
    glassEvidence: "\"stretches the Signature glass facade by one full panel\" — a full mirror-glass facade forming the entire long elevation.",
    source: 'oodhouse.com/en-us/products/rvs/extended-park-model-rv',
  },
];

/**
 * ONLY UNITS WITH A FULL-HEIGHT GABLE GLASS WALL ARE USED. The glazing is the
 * whole product — it is what a guest pays for and what the listing sells on —
 * so a model without one is not a cheaper option, it is a different business.
 * Every model above was checked individually; a catalogue index never says.
 *
 * THE CONSEQUENCE IS GEOMETRIC AND IT IS NOT SMALL. The glass is on the gable
 * and the door is on the long wall near the OTHER end, so the deck has to reach
 * both ends of the unit. One compact deck at the gable cannot do it — unless
 * the door is specified near the glass end, which is exactly what a reversed or
 * end-flipped plan buys.
 */
export function glassUnits(): ObservedUnit[] {
  return [...OBSERVED_UNITS];
}

/**
 * Units whose glass and door share a wall. One deck serves both, so the flank
 * strip disappears entirely — the single biggest deck saving available, and the
 * reason ÖÖD's side-glass geometry is worth more than its floor area suggests.
 */
export function oneDeckServesBoth(u: ObservedUnit): boolean {
  return !u.glassSplitFromDoor;
}

/**
 * Elevation publish this as a standard choice: plans can be "flipped end-to-end
 * or rolled side-to-side". Rolled side-to-side is the reversed plan Zook gates
 * behind a ten-unit order. It is the strongest procurement argument in this file.
 */
/**
 * ⚠️ ÖÖD'S OWN GUIDANCE CONTRADICTS THE POSITION THE REST OF THIS KIT PROTECTS.
 *
 * Their US launch page says the unit is "designed to meet Park Model RV
 * standards" — designed to meet, not certified to — and then, in the same
 * breath about building a terrace around it:
 *
 *     "The wheels and the tow bar of the chassis can be hidden or removed for
 *      a nice terrace to be built around the house."
 *
 * Removing the tow bar is the most identity-destroying act available on a park
 * model, and it is being suggested in exactly the situation this project is in.
 * Zook's site-prep page says the opposite in plain words: the unit "must remain
 * ATTACHED to its wheels". Both cannot be right.
 *
 * This does not disqualify the unit — it is still the most deck-efficient thing
 * in the catalogue. It means the terrace detail and the certification get
 * settled in writing BEFORE an order, not after one.
 */
export const OOD_CLASSIFICATION_CONFLICT = {
  maker: 'ÖÖD',
  theirWording: 'designed to meet Park Model RV standards',
  theRisk: 'The wheels and the tow bar of the chassis can be hidden or removed for a nice terrace '
    + 'to be built around the house.',
  conflictsWith: 'Zook site prep: the park model must remain ATTACHED to its wheels.',
  resolveBefore: 'order' as const,
  actions: [
    'Get the RVIA / ANSI A119.5 certification in writing, not "designed to meet".',
    'Write into the purchase order that the tow bar and wheels stay attached and reachable.',
    'Detail the terrace to conceal nothing structurally — removable panels only, as everywhere else here.',
  ],
} as const;

/**
 * Makers looked at and NOT used, each with the reason. Recorded so that nobody
 * repeats this search and reaches a different answer from the same evidence.
 */
export const NEAR_MISSES = [
  {
    maker: 'Elevation', model: '7-Series',
    why: 'A choice of "five front-end window designs" is a window configuration, not a glass wall. '
      + 'This was read as a glass wall on a first pass. It is not one.',
  },
  {
    maker: 'Hilltop Structures', model: 'Smoky Mountain Park Model RV',
    why: '"2 reverse gables with glass" is ambiguous, and the same spec lists ordinary double-pane '
      + 'clay vinyl windows. Worth one phone call; not worth an assumption.',
  },
  {
    maker: 'ESCAPE Traveler', model: 'Vista',
    why: 'Four large Low-E windows is four windows, not a wall, and at 25 x 8.5 ft it is a 212 sq ft '
      + 'travel trailer rather than a park model. Worth remembering for one reason only: at 8.5 ft '
      + 'wide it is the only unit encountered that tows with no permit, escort or route approval.',
  },
  {
    maker: 'Wheelhaus', model: 'Wedge',
    why: 'A "sliding glass entryway" is a slider. It does ship a fully covered front deck, which is '
      + 'the one idea worth taking from it.',
  },
  {
    maker: 'Deep Blue', model: 'Mirror Cabin',
    why: 'A real mirrored-facade prefab at roughly 270 sq ft, but a Chinese modular product with no '
      + 'RVIA or ANSI A119.5 evidence. Without park-model status the tax position goes with it.',
  },
] as const;

/**
 * NOT REJECTED, NOT ACCEPTED — the maker simply does not publish enough to tell.
 *
 * This is a separate box from NEAR_MISSES on purpose. A near-miss was looked at
 * and ruled out on evidence; these were looked at and could not be ruled either
 * way, because the page says nothing about glazing at all. Guessing from a
 * rendering is exactly the mistake that put Elevation on the list, so these wait
 * for a floor plan instead.
 */
export const UNVERIFIED = [
  {
    maker: 'Irontown Modular', model: 'Cabana 400', widthFt: 14, lengthFt: 32, interiorSqFt: 397,
    priceUsd: 118700,
    missing: 'No window placement, glazing layout or elevation published; renderings only.',
    alsoMissing: 'No RVIA or ANSI A119.5 claim anywhere on the page. "At 399 sq ft this unit will meet '
      + 'the Park Model code" is a size statement, not a certification — the same designed-to-meet '
      + 'wording that needs pinning down at ÖÖD.',
    ask: 'Request the floor plan PDF and a glazed elevation. Two questions settle it: is any wall '
      + 'full-height glass, and is it the gable or the long side?',
  },
  {
    maker: 'Irontown Modular', model: 'Mysa 400', widthFt: 14, lengthFt: 32, interiorSqFt: 397,
    priceUsd: 120100,
    missing: 'Same footprint as the Cabana 400 and the same silence on glazing.',
    alsoMissing: 'No RVIA or ANSI A119.5 claim published.',
    ask: 'Ask what actually differs from the Cabana 400 besides finishes, and get both elevations.',
  },
] as const;

/**
 * The market for a park model with a genuine full-height glass wall is THIN.
 * Five models from two makers survived; five more were looked at and rejected.
 * That is the finding, not a gap in the search — and it is why the door and
 * glazing positions above are constraints to design around rather than
 * preferences to state.
 */
export const SURVEY = {
  qualified: 5,
  rejected: 5,
  awaitingEvidence: 2,
  makersQualified: ['Zook', 'ÖÖD'],
  bar: 'The maker\'s own words must describe a glass WALL or facade. "Large windows", "window '
    + 'designs" and "sliding glass entryway" are not evidence, and neither is a rendering.',
} as const;

export const MIRRORING_BY_MAKER = {
  Zook: {
    availability: 'volume-only' as const,
    quote: 'not customizable when ordered as a single unit',
    note: 'Custom plans only at ten or more units.',
    source: 'zookcabins.com/planning/park-model/construction-details',
  },
  'ÖÖD': {
    availability: 'unknown' as const,
    quote: 'not published',
    note: 'Handing is not addressed either way. Ask — the facade IS the long elevation, so which way '
      + 'it faces is the entire siting decision.',
    source: 'oodhouse.com/en-us/products/rvs/extended-park-model-rv',
  },
} as const;

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
  /** Fraction along the length from the glass gable to the hitch end. */
  doorAtFractionFromGlass: number;
  /** Which wall the glazing is in. Gable is the norm; ÖÖD puts it on the long side. */
  glassWall: 'gable' | 'side';
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

/**
 * The door itself, on the face of the unit — NOT the middle of the wall. On
 * every A-frame surveyed the door sits near the hitch end beside the bathroom
 * bump-out, which is most of the way from the glass. Assuming it is centred
 * would put a deck landing where there is no door.
 */
export function doorPoint(u: PlacedUnit): Pt {
  const f = doorFacing(u);
  if (u.entry === 'end') {
    return { x: u.at.x + f.x * (u.lengthFt / 2), y: u.at.y + f.y * (u.lengthFt / 2) };
  }
  const a = lengthAxis(u);
  const along = u.lengthFt * (u.doorAtFractionFromGlass - 0.5);
  return {
    x: u.at.x + f.x * (u.widthFt / 2) + a.x * along,
    y: u.at.y + f.y * (u.widthFt / 2) + a.y * along,
  };
}

/**
 * The glass gable faces the way the length axis came FROM. The hitch is at the
 * other end, which is the quiet gift in all of this: these units tow away from
 * their own glass, so a deck at the view end can never block the exit.
 */
export function glassFacing(u: PlacedUnit): Pt {
  if (u.glassWall === 'side') {
    const c = Math.cos(rad(u.rotDeg)), s2 = Math.sin(rad(u.rotDeg));
    return u.mirrored ? { x: -c, y: -s2 } : { x: c, y: s2 };
  }
  const a = lengthAxis(u);
  return { x: -a.x, y: -a.y };
}

/** How far the glass wall stands from the unit's centre. */
export function glassReachFt(u: PlacedUnit): number {
  return u.glassWall === 'side' ? u.widthFt / 2 : u.lengthFt / 2;
}

/** How wide the glass wall is. A side wall is the LONG one — that is the point of ÖÖD. */
export function glassWidthFt(u: PlacedUnit): number {
  return u.glassWall === 'side' ? u.lengthFt : u.widthFt;
}

export function glassPoint(u: PlacedUnit): Pt {
  const g = glassFacing(u);
  const r = glassReachFt(u);
  return { x: u.at.x + g.x * r, y: u.at.y + g.y * r };
}

export function glassOpensOntoDeck(u: PlacedUnit, layout: SiteLayout): boolean {
  const g = glassFacing(u), q = glassPoint(u);
  const probe = { x: q.x + g.x * DOOR_LANDING_FT, y: q.y + g.y * DOOR_LANDING_FT };
  return layout.decks.some((deck) => pointInPolygon(probe, deck.outline));
}

/** Open ground a glass wall needs in front of it before it is just a window onto a wall. */
export const VIEW_CLEAR_FT = 40;

/** The corridor the view runs down, as wide as the unit. */
export function viewCorridor(u: PlacedUnit): Pt[] {
  const g = glassFacing(u);
  const px = -g.y, py = g.x;
  const hw = glassWidthFt(u) / 2;
  const start = glassReachFt(u);
  const end = start + VIEW_CLEAR_FT;
  const at = (t: number, side: number): Pt => ({
    x: u.at.x + g.x * t + px * hw * side,
    y: u.at.y + g.y * t + py * hw * side,
  });
  return [at(start, -1), at(end, -1), at(end, 1), at(start, 1)];
}

/**
 * The glass is the product. A glass wall pointed at another unit is not a view,
 * it is a privacy problem sold at a premium — so this is a check, not a note.
 */
export function glassHasView(u: PlacedUnit, layout: SiteLayout): boolean {
  const corridor = viewCorridor(u);
  return !layout.units.some((o) => o.id !== u.id && polysOverlap(corridor, unitCorners(o)));
}

export function everyGlassWorks(layout: SiteLayout): boolean {
  return layout.units.every((u) => glassOpensOntoDeck(u, layout) && glassHasView(u, layout));
}

/** Total open deck laid, in square feet. */
export function deckAreaSqFt(layout: SiteLayout): number {
  const area = (pts: Pt[]) => Math.abs(pts.reduce((acc, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return acc + (p.x * q.y - q.x * p.y);
  }, 0) / 2);
  return Math.round(layout.decks.reduce((sum, d) => sum + area(d.outline), 0));
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

const studio = {
  widthFt: 13.5, lengthFt: 32, entry: 'side' as EntryPattern,
  doorAtFractionFromGlass: 0.85, glassWall: 'gable' as const,
};
/** ÖÖD: glass on the long wall, door in the same wall. No flank strip needed. */
const ood = {
  widthFt: 11.16, lengthFt: 26.08, entry: 'side' as EntryPattern,
  doorAtFractionFromGlass: 0.5, glassWall: 'side' as const,
};

/**
 * THE SHAPE OF EVERY LAYOUT BELOW IS SET BY ONE FACT: the glass is on the gable
 * and the door is on the long wall near the OTHER end. So each unit needs deck
 * in two places — a view deck off the glass, and a strip down the flank to reach
 * the door. The strip is pure circulation. It buys no view and no sitting space.
 *
 * SPECIFYING THE DOOR NEAR THE GLASS END DELETES IT. That is the concrete thing
 * a reversed or end-flipped plan is worth, and flankStripCostSqFt() prices it.
 */
export const FLANK_STRIP_WIDTH_FT = 8;

/** Deck laid purely to reach a door that sits at the far end from the glass. */
export function flankStripCostSqFt(u: { lengthFt: number }): number {
  return Math.round(FLANK_STRIP_WIDTH_FT * u.lengthFt);
}

export const LAYOUTS: readonly SiteLayout[] = [
  {
    id: 'glass-single',
    title: 'One unit — view deck at the glass, strip to the door',
    unitCount: 1,
    requiresEntry: 'side',
    units: [{ id: 'A', model: 'A-Frame Studio', ...studio, at: { x: 0, y: 0 }, rotDeg: 0, hitch: 'far-end' }],
    decks: [
      { id: 'view-deck', cantileverFt: 2, outline: [{ x: -12, y: -34 }, { x: 12, y: -34 }, { x: 12, y: -16 }, { x: -12, y: -16 }] },
      { id: 'strip-A', cantileverFt: 0, outline: [{ x: 6.75, y: -16 }, { x: 14.75, y: -16 }, { x: 14.75, y: 16 }, { x: 6.75, y: 16 }] },
    ],
    why:
      'The whole plan in one unit. The view deck sits off the glass gable where the ground falls away, '
      + 'and the cantilever runs along its outer edge. The strip down the flank exists only because the '
      + 'door is at the far end — it is circulation, not living space. Note what the geometry gives you '
      + 'for free: the hitch is at the door end, so the unit tows AWAY from its own view deck and that '
      + 'deck can be as large as the site allows without ever blocking the exit.',
  },
  {
    id: 'glass-pair-corner',
    title: 'Two units — right angle, both glass walls on one deck',
    unitCount: 2,
    requiresEntry: 'side',
    units: [
      { id: 'A', model: 'A-Frame Studio', ...studio, at: { x: 0, y: 0 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'B', model: 'A-Frame Studio', ...studio, at: { x: 28, y: -30 }, rotDeg: -90, hitch: 'far-end', mirrored: true },
    ],
    decks: [
      { id: 'view-deck', cantileverFt: 2, outline: [{ x: -12, y: -38 }, { x: 12, y: -38 }, { x: 12, y: -16 }, { x: -12, y: -16 }] },
      { id: 'strip-A', cantileverFt: 0, outline: [{ x: 6.75, y: -16 }, { x: 14.75, y: -16 }, { x: 14.75, y: 16 }, { x: 6.75, y: 16 }] },
      { id: 'strip-B', cantileverFt: 0, outline: [{ x: 14.75, y: -23.25 }, { x: 44, y: -23.25 }, { x: 44, y: -15.25 }, { x: 14.75, y: -15.25 }] },
    ],
    why:
      'Set square to each other at ninety degrees, both glass walls looking onto the same deck but down '
      + 'different sightlines — so the deck is shared and the views are not. Neither unit appears in the '
      + 'other\'s glass, which is the point of the right angle. B is a reversed plan so its door faces '
      + 'back toward the shared surface instead of out into the trees. They tow in different directions.',
  },
  {
    id: 'glass-comb-three',
    title: 'Three units — parallel, all glass onto one long deck',
    unitCount: 3,
    requiresEntry: 'side',
    units: [
      { id: 'A', model: 'A-Frame Studio', ...studio, at: { x: -26, y: 0 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'B', model: 'A-Frame Studio', ...studio, at: { x: 0, y: 0 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'C', model: 'A-Frame Studio', ...studio, at: { x: 26, y: 0 }, rotDeg: 0, hitch: 'far-end' },
    ],
    decks: [
      { id: 'view-deck', cantileverFt: 2, outline: [{ x: -40, y: -34 }, { x: 40, y: -34 }, { x: 40, y: -16 }, { x: -40, y: -16 }] },
      { id: 'strip-A', cantileverFt: 0, outline: [{ x: -19.25, y: -16 }, { x: -11.25, y: -16 }, { x: -11.25, y: 16 }, { x: -19.25, y: 16 }] },
      { id: 'strip-B', cantileverFt: 0, outline: [{ x: 6.75, y: -16 }, { x: 14.75, y: -16 }, { x: 14.75, y: 16 }, { x: 6.75, y: 16 }] },
      { id: 'strip-C', cantileverFt: 0, outline: [{ x: 32.75, y: -16 }, { x: 40.75, y: -16 }, { x: 40.75, y: 16 }, { x: 32.75, y: 16 }] },
    ],
    why:
      'Three units square to the contour, every glass wall aimed the same way down the fall, sharing one '
      + 'long deck with the fire at its centre. Nothing stands in front of anything. All three tow '
      + 'straight back uphill on parallel lanes, so any one can leave without touching the others. It is '
      + 'the most view per unit of anything here, and the most strip — three flanks of pure circulation, '
      + 'which is the price of a door at the far end.',
  },
  {
    id: 'mirror-contour-three',
    title: 'Three side-glass units — stepped down the contour',
    unitCount: 3,
    requiresEntry: 'side',
    units: [
      { id: 'A', model: 'ÖÖD Extended', ...ood, at: { x: -40, y: 30 }, rotDeg: -90, hitch: 'far-end' },
      { id: 'B', model: 'ÖÖD Extended', ...ood, at: { x: 0, y: 10 }, rotDeg: -90, hitch: 'far-end' },
      { id: 'C', model: 'ÖÖD Extended', ...ood, at: { x: 40, y: -10 }, rotDeg: -90, hitch: 'far-end' },
    ],
    decks: [
      { id: 'deck-A', cantileverFt: 2, outline: [{ x: -53.04, y: 16.42 }, { x: -26.96, y: 16.42 }, { x: -26.96, y: 24.42 }, { x: -53.04, y: 24.42 }] },
      { id: 'deck-B', cantileverFt: 2, outline: [{ x: -13.04, y: -3.58 }, { x: 13.04, y: -3.58 }, { x: 13.04, y: 4.42 }, { x: -13.04, y: 4.42 }] },
      { id: 'deck-C', cantileverFt: 2, outline: [{ x: 26.96, y: -23.58 }, { x: 53.04, y: -23.58 }, { x: 53.04, y: -15.58 }, { x: 26.96, y: -15.58 }] },
    ],
    why:
      'The layout only a SIDE glass wall allows. Each unit lies along the contour with its long glazed '
      + 'face aimed down the fall, so the pad is a shallow even cut and the whole 26 ft wall is view. '
      + 'Because the glass and the door share that wall, ONE deck serves both — no flank strip anywhere, '
      + 'which is why three units here need barely a third of the deck the A-frame comb does. They step '
      + 'far enough apart that each tows out along the contour past its neighbour. '
      + '⚠️ Mirror glazing reflects whatever stands in front of it and carries a real bird-strike duty; '
      + 'both belong in the spec, not in the snagging list.',
  },
  {
    id: 'glass-pair-facing',
    title: 'Two units — glass walls facing each other (do not build)',
    unitCount: 2,
    requiresEntry: 'side',
    units: [
      { id: 'A', model: 'A-Frame Studio', ...studio, at: { x: 0, y: 24 }, rotDeg: 0, hitch: 'far-end' },
      { id: 'B', model: 'A-Frame Studio', ...studio, at: { x: 0, y: -24 }, rotDeg: 180, hitch: 'far-end' },
    ],
    decks: [
      { id: 'court', cantileverFt: 0, outline: [{ x: -12, y: -8 }, { x: 12, y: -8 }, { x: 12, y: 8 }, { x: -12, y: 8 }] },
      { id: 'strip-A', cantileverFt: 0, outline: [{ x: 6.75, y: 8 }, { x: 14.75, y: 8 }, { x: 14.75, y: 40 }, { x: 6.75, y: 40 }] },
      { id: 'strip-B', cantileverFt: 0, outline: [{ x: -14.75, y: -40 }, { x: -6.75, y: -40 }, { x: -6.75, y: -8 }, { x: -14.75, y: -8 }] },
    ],
    why:
      'A courtyard between two glass walls. It passes every structural test in this file — the gaps are '
      + 'right, both units tow clear, every door and every glass wall lands on deck — and it is still the '
      + 'worst plan here, because each unit\'s twelve-foot window looks straight into the other\'s '
      + 'bedroom from sixteen feet away. The glazing is the product. Point it at a view or do not pay '
      + 'for it.',
    rejected: 'Both glass walls look into each other, not at the valley. Structurally fine, commercially '
      + 'worthless — the one thing guests are paying for is cancelled.',
  },
];

export function layoutById(id: string): SiteLayout | undefined {
  return LAYOUTS.find((l) => l.id === id);
}

/** Layouts a given catalogue unit can actually be arranged in. */
export function layoutsFor(unit: ObservedUnit): SiteLayout[] {
  return LAYOUTS.filter((l) => !l.rejected && l.requiresEntry === unit.entry);
}
