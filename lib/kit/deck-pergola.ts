/**
 * A covered, screened deck wrapped around a park model.
 *
 * The unit is a vehicle. That single fact decides almost everything here: the
 * deck must be FREE-STANDING (a fastener into the unit is what turns a
 * recreational vehicle into a building), it must meet a floor that already sits
 * ~36 in above the pad on a deck-over chassis, and it is what makes 400 sq ft
 * of park model into a place you would stay for a week in the mountains.
 *
 * Every dimension below is derived from a code table, a manufacturer's
 * published limit, or the site, and the source is named beside it. Nothing is
 * chosen by taste.
 */

import { pilePositions } from './foundation.ts';
import type { LoadInput, WindBasis } from './foundation.ts';
import { bidForm } from './tender.ts';

// ---------------------------------------------------------------------------
// The rules, with their sources.

/** NC Residential Code 2018 Appendix M — Wood Decks. Governs roofed and
 *  screened porches too (AM101), so this is the whole code path. */
export const APPENDIX_M = {
  /** AM102.1 — minimum footing depth below finished grade, in. */
  footingMinDepthIn: 12,
  /** AM108.1 / Table AM108.1 — post size by height, top of footing to girder. */
  postMaxHeightFt: { '4x4': 8, '6x6': 20 },
  /** AM109.1.1 — lateral bracing NOT required at or below this floor height. */
  bracingThresholdIn: 30,
  /** R312 — guards required above this floor height; minimum guard height. */
  guardThresholdIn: 30,
  guardMinIn: 36,
  /** Table AM105.2 — allowable girder span, Southern Pine, by joist span. */
  girderSpanFt: {
    '2-ply 2x10': { 8: 9.0, 10: 8.0, 12: 7.33 },
    '3-ply 2x10': { 8: 11.25, 10: 10.0, 12: 9.17 },
  } as Record<string, Record<number, number>>,
  /** Table AM106.1 — joist span at 16 in o.c., Southern Pine, no cantilever. */
  joistSpanFt: { '2x8': 11.83, '2x10': 14.0 } as Record<string, number>,
  /** AM105.2 / AM106.1 — the load basis behind those tables. */
  deckLivePsf: 40,
  deckDeadPsf: 10,
  /** AM105.3 — a COVERED deck's girders go to the heavier R602.7 tables. Kept
   *  off the deck framing here by carrying the roof on its own posts. */
  coveredDeckGirdersUseR602: true,
};

/**
 * THE DECK MUST STAY OPEN, and that is a tax rule, not a design preference.
 *
 * The deal workstream's position is "three park models linked by open decks,
 * ~$168K year-one, bulletproof, no Whiteco argument" — the deck stays OPEN
 * under the one-building rule, and the deck pods are §1245 property in the
 * 5-year lane. A roof and screens over the WHOLE deck is exactly what a
 * Whiteco inherently-permanent-structure argument feeds on, and a continuous
 * roof linking units is what the one-building rule is about.
 *
 * So coverage is capped. A pergola over a fraction of the deck is an amenity on
 * an open deck; a pergola over all of it is a building with a deck in it.
 */
export const OPEN_DECK = {
  /** Covered fraction above which the "open deck" position gets harder. */
  maxCoveredFraction: 0.35,
  /** A roof must never bridge between two units — that is the one-building rule. */
  neverLinkUnits: true,
  source: 'deal-params: "three park models linked by open decks ... no Whiteco argument"; '
    + '"the deck stays OPEN (the one-building rule)"; "§1245 deck pods — already the design"',
};

/**
 * THE CANTILEVER, AND WHY IT IS THE BEST PREFAB CANDIDATE ON THIS PROJECT.
 *
 * A post-and-beam ring is many small connections made in the field on a 12.8%
 * slope. A cantilevered bay is ONE moment connection to a backspan, made in a
 * shop. Prefabrication pays where connections repeat and tolerances are tight,
 * and a cantilever concentrates the whole structure into a single line — so it
 * is more suited to shop fabrication than the ring, not less.
 *
 * Two things follow that the photographs do not show:
 *
 * 1. WOOD CANNOT DO THE LOOK. IRC R507 / App M allow a joist to cantilever a
 *    QUARTER of its backspan — 3.5 ft off a 14 ft span. That is a bay window.
 *    The 8-12 ft overhangs in the reference images are STEEL, which is exactly
 *    what those projects say they are ("supported entirely on steel").
 *
 * 2. A LONG CANTILEVER LIFTS ITS BACK SUPPORT. Load out on the tip levers the
 *    far line upward. It reverses on itself: the earlier finding here was that
 *    a gravity-only deck needs no pile, and that stands for a post ring — but a
 *    cantilever past about 0.45 of its backspan puts the BACK LINE into uplift,
 *    and that line must be tied down. The piles come back, for a different
 *    reason and in a different place.
 */
export const CANTILEVER = {
  /** IRC R507 / App M: joist cantilever as a fraction of backspan. Wood only. */
  woodMaxFractionOfBackspan: 0.25,
  /** Below this fraction the back line still bears; above it, uplift. */
  upliftFractionOfBackspan: Math.sqrt(10 / 50),
  /** Past the wood rule it is an engineered steel frame with a PE stamp. */
  steelRequiredAboveFtPerBackspan: 0.25,
  /** Cantilever tip deflection limit, IRC Table R301.7 for a cantilever. */
  tipDeflectionLimit: 'L/180 at the tip (2c/180), stiffer than the L/360 backspan',
  source: 'IRC R507 cantilever rule; statics for the back reaction; reference projects state steel',
};

/**
 * Prefabricated deck panels, built in a shop and set on site.
 *
 * This is the labour answer: field work becomes setting panels on a levelled
 * post grid instead of cutting and fastening every joist on a 12.8% slope, 50
 * times over. Panels stack for transport — about 8 x 20 ft is what fits a truck
 * bed alongside others.
 */
export const PREFAB_PANEL = {
  maxWidthFt: 8,
  maxLengthFt: 20,
  /** Panels land on the girder lines, so a panel edge must fall on a post line. */
  mustLandOnGirders: true,
  source: 'Prefabricated modular deck systems — panels ~8 x 20 ft stack for delivery and remove per-panel field framing',
};

/**
 * WHAT THE OPERATING COMPARABLE ACTUALLY BUILT — observed, not inferred.
 *
 * Photographs of the mirror-cabin decks at the nearest working resort settle a
 * question the deal archive had open (0E.11): their decks stand on POSTS BEARING
 * ON PRECAST/POURED PIER BLOCKS AT GRADE. No helical piles, no deep foundation,
 * no visible excavation — the same detail carries the cabins themselves.
 *
 * That is direct support for splitting the foundation by load: a gravity-only
 * deck does not need a pile, and the operator with nine units in the same
 * climate did not buy one. It is NOT support for skipping frost protection —
 * see the caveat below, which is the part a photograph cannot settle.
 */
export const OBSERVED_COMPARABLE = {
  deckFoundation: 'posts on precast/poured pier blocks at grade',
  guardSystem: 'horizontal cable on dark metal posts, including the stair',
  decking: 'composite boards, and pressure-treated on other units',
  approach: 'poured concrete walkway to the deck',
  pergola: 'none — decks are open to the sky',
  /** What the photographs cannot show, and why it matters. */
  unresolved: 'Whether anything sits BELOW those blocks. App M AM102.1 wants a footing 12 in '
    + 'below finished grade; a block resting on grade does not obviously meet it, and Transylvania '
    + 'County practice need not match Cherokee County. Ask the operator and the inspector, not the photo.',
  source: 'Owner-supplied photographs of the mirror-cabin decks, Sep 2026',
};

/**
 * The guard is the view, and a height alone does not specify it.
 *
 * R312 asks for 36 in and says nothing about infill, so "36 in guard" invites a
 * quote for solid balusters — which walls off the forest the unit is sold on.
 * The observed comparable uses horizontal cable on black metal posts: code
 * height, near-zero visual obstruction. Specified as PERFORMANCE (opening size,
 * obstruction, finish) so any cable, rod or mesh system can bid it.
 */
export const GUARD = {
  minHeightIn: 36,
  /** R312.1.3 — a 4 in sphere must not pass through. Governs cable spacing and tension. */
  maxOpeningIn: 4,
  /** The point of the thing: infill must not read as a wall from a seated eye. */
  viewPreserving: true,
  /** Exterior, wooded, mountain — the finish is a durability spec, not a colour. */
  finish: 'corrosion-resistant, dark, factory-finished',
  source: 'R312 height and the 4 in sphere; view-preserving infill observed on the operating comparable (horizontal cable on dark metal posts)',
};

/**
 * Decking runs PERPENDICULAR to the unit — boards leading away from the
 * building, as observed. That puts joists parallel to the wall, which is the
 * opposite of the shortest span, so it is a finish decision with a framing
 * consequence and belongs in the specification rather than in a builder's head.
 */
export const DECK_BOARD_DIRECTION = 'perpendicular to the unit wall';

/** Published limits for track-retained ("zipper") retractable screens. */
export const ZIPPER_SCREEN = {
  /** Largest single panel any of the surveyed makers builds. */
  maxPanelWidthFt: 25,
  maxPanelHeightFt: 16,
  /** Makers rate deployment to about this; above it the mesh is retracted. */
  deployMaxMph: 25,
  /** Structural rating of the deployed mesh — 50 (Phantom) to 75 (MagnaTrack). */
  structuralMinMph: 50,
  /** A wind sensor that retracts the mesh automatically is standard; it is a
   *  REQUIREMENT here, not an option, because the frame — not the mesh — is
   *  what is designed for the site wind. */
  windSensorRequired: true,
  source: 'Mirage (25 x 16 ft max), Phantom (50+ mph, deploy <25), Progressive MagnaTrack (75 mph, deploy 25) — published, Sep 2026',
};

/** What engineered aluminum pergolas publish, and what that means for us. */
export const PERGOLA_MARKET = {
  /** Snow ratings across surveyed makers span this range. */
  snowRatingRangePsf: [20, 100] as const,
  /** Wind ratings: kits ~90-150 mph; ICC-ES / Miami-Dade systems 150-190+. */
  windRatingRangeMph: [90, 190] as const,
  /** Three makers independently clear our site numbers, so this is a
   *  COMPETITIVE line, not a single-source one. */
  makersClearingSite: 3,
  source: 'StruXure (ICC-ES, 50 psf, 150 mph), Azenco R-BLADE (100 psf, 190 mph, Miami-Dade NOA), Renson (40 psf, 195 mph Miami-Dade) — published, Sep 2026',
};

// ---------------------------------------------------------------------------
// Inputs.

export interface ParkModel {
  name: string;
  widthFt: number;
  lengthFt: number;
  /** Floor above the pad. Deck-over chassis (body over the wheels, needed above
   *  11 ft 8 in wide) sits about 36 in; deck-between about 24 in. */
  floorAboveGradeIn: number;
  /** Which long side carries the entry door, and where along it. */
  door: { side: 'long-a' | 'long-b'; offsetFt: number; widthFt: number };
  /** Widest dimension in transit — the road envelope this unit already needs. */
  transportHeightFt: number;
  source: string;
}

/**
 * DESIGN TO THE ENVELOPE, NOT TO A MODEL.
 *
 * A park model is bought, not designed, and the catalogue turns over. Building
 * the deck around one unit locks the site plan to that unit's manufacturer —
 * the same lock-in the panel specification was built to avoid, arriving through
 * the back door.
 *
 * The published range is narrow enough to design to. Across Zook's sixteen
 * models and the Factory Expo plans, width runs 12-15 ft and length 29-35 ft.
 *
 * ⚠️ THE 400 SQ FT CAP IS NOT THE EXTERIOR FOOTPRINT, and conflating the two is
 * an easy mistake — this module made it. ANSI A119.5 measures GROSS FLOOR AREA
 * IN SETUP MODE, excluding lofts, and manufacturers publish exterior box
 * dimensions separately: the Factory Expo Mexia is 15 x 34 ft (510 sq ft of
 * box) and is a legal park model. So the exterior ranges below are INDEPENDENT
 * bounds on the box the deck has to wrap, and the 400 sq ft rule is a different
 * measure that this module cannot compute from width and length. It is recorded
 * for context and deliberately NOT enforced here.
 *
 * The deck absorbs the swing by ordering MORE OF THE SAME PARTS — 28 to 32
 * footings, 12 to 14 panels, always 6 piles — while the post spacing, spans,
 * panel module and every detail stay put.
 *
 * So the deck is specified once, to the envelope, and any unit inside it can be
 * bought — including next year's.
 */
export const PARK_MODEL_ENVELOPE = {
  widthFt: [12, 15] as const,
  lengthFt: [29, 35] as const,
  /**
   * ANSI A119.5's cap on GROSS FLOOR AREA IN SETUP MODE, lofts excluded.
   * Context only — it is NOT the exterior box, and nothing here enforces it
   * against width x length. The Mexia's 15 x 34 ft box is 510 sq ft and legal.
   */
  ansiLivingAreaCapSqFt: 400,
  /** Deck-over chassis above ~11 ft 8 in body width; deck-between below it. */
  floorAboveGradeIn: [24, 40] as const,
  maxTransportHeightFt: 13.5,
  source: 'Zook park models (16 plans, 204-400 sq ft); Factory Expo Cavalry 12x35 and Mexia 15x34; '
    + 'ANSI A119.5 400 sq ft cap; 13 ft 6 in legal road height',
};

export interface EnvelopeFit {
  fits: boolean;
  failures: string[];
}

/** Does a unit sit inside the envelope the deck is designed to? */
export function fitsEnvelope(u: ParkModel): EnvelopeFit {
  const E = PARK_MODEL_ENVELOPE;
  const failures: string[] = [];
  if (u.widthFt < E.widthFt[0] || u.widthFt > E.widthFt[1]) failures.push(`width ${round2(u.widthFt)} ft outside ${E.widthFt[0]}-${E.widthFt[1]}`);
  if (u.lengthFt < E.lengthFt[0] || u.lengthFt > E.lengthFt[1]) failures.push(`length ${round2(u.lengthFt)} ft outside ${E.lengthFt[0]}-${E.lengthFt[1]}`);
  if (u.floorAboveGradeIn < E.floorAboveGradeIn[0] || u.floorAboveGradeIn > E.floorAboveGradeIn[1]) failures.push(`floor ${u.floorAboveGradeIn} in outside ${E.floorAboveGradeIn[0]}-${E.floorAboveGradeIn[1]}`);
  if (u.transportHeightFt > E.maxTransportHeightFt) failures.push(`${u.transportHeightFt} ft over the ${E.maxTransportHeightFt} ft road height`);
  return { fits: failures.length === 0, failures };
}

/** Zook A-Frame Classic, from the product page and park-model chassis practice. */
export const ZOOK_A_FRAME_CLASSIC: ParkModel = {
  name: 'A-Frame Classic (park model)',
  widthFt: 13 + 10 / 12,
  lengthFt: 29 + 2 / 12,
  floorAboveGradeIn: 36,
  door: { side: 'long-a', offsetFt: 12, widthFt: 3 },
  transportHeightFt: 13.5, // legal road limit, used as the ceiling — Zook does not publish the unit's height; UNCONFIRMED
  source: 'Zook: 13 ft 10 in x 29 ft 2 in = 400 sq ft, single inset entry on the long side; '
    + 'floor height not published — 13 ft 10 in exceeds the 11 ft 8 in deck-between limit, so '
    + 'deck-over chassis, ~36 in (industry practice). Confirm with the transport desk.',
};

export interface DeckConfig {
  unit: ParkModel;
  /** Deck depth on each side of the unit, ft. 0 = no deck on that side. */
  depthFt: { doorSide: number; farSide: number; endA: number; endB: number };
  /**
   * Cantilever beyond the outer girder, ft, per side. The deck depth is the
   * BACKSPAN; this is what reaches past it into the view.
   */
  cantileverFt?: Partial<Record<'doorSide' | 'farSide' | 'endA' | 'endB', number>>;
  /** Clear gap between deck edge and unit — no contact, no fastener. */
  airGapIn: number;
  /** Clear height under the pergola beam, above the deck. */
  pergolaClearFt: number;
  /**
   * Where the pergola goes. Omit for an open deck with no roof at all.
   * A zone covers part of ONE side — the outdoor room — not the whole ring.
   */
  pergolaZone?: { side: 'doorSide' | 'farSide' | 'endA' | 'endB'; startFt: number; lengthFt: number };
  /** Site basis. */
  wind: WindBasis;
  groundSnow: LoadInput;
  roofLivePsf: number;
  /** Which sides get screens. Screens are not walls; see notes. */
  screened: { doorSide: boolean; farSide: boolean; endA: boolean; endB: boolean };
}

// ---------------------------------------------------------------------------
// Outputs.

export interface CantileverCheck {
  cantileverFt: number;
  backspanFt: number;
  fraction: number;
  /** Within the IRC/App M quarter rule, so ordinary wood joists carry it. */
  woodOk: boolean;
  /** Past the point where the BACK line goes into uplift. */
  liftsBackLine: boolean;
  /** Net reaction at the back line, plf. Negative is uplift. */
  backReactionPlf: number;
  material: 'wood, App M tables' | 'engineered steel, PE stamp';
  reason: string;
}

export interface DeckSide {
  id: 'doorSide' | 'farSide' | 'endA' | 'endB';
  /** Length of this side's outer edge, ft. */
  runFt: number;
  depthFt: number;
  areaSqFt: number;
  /** Joist span across the depth, and what that requires. */
  joist: { spanFt: number; size: string };
  /** Post spacing along the run, from the girder table for that joist span.
   *  A joist span needs a girder at BOTH ends, and the inner one cannot bear on
   *  the vehicle — so every side carries two beam lines of posts. */
  post: { spacingFt: number; perLine: number; lines: 2; girder: string; size: string };
  /** Absolute post coordinates (x, z) in the deck-ring frame, both beam lines. */
  postsXY: Array<[number, number]>;
  /** Pergola bays follow the posts; each bay is one screen panel. */
  bays: number;
  bayWidthFt: number;
  screened: boolean;
  screenPanelOk: boolean;
  /** Present only when this side reaches past its outer girder. */
  cantilever?: CantileverCheck;
}

export type SupportType = 'footing' | 'pile';

export interface DeckPost {
  xFt: number;
  zFt: number;
  /** 'pile' only where uplift can occur — under the pergola. Everything else is
   *  a gravity-only post and App M asks for a footing 12 in below grade. */
  support: SupportType;
  serviceLoadLb: number;
}

export interface DeckPlan {
  /** Whether the unit sits inside the envelope this deck is designed to. */
  envelope: EnvelopeFit;
  unit: ParkModel;
  /** Overall outside dimensions of the deck ring, ft. */
  outerWidthFt: number;
  outerLengthFt: number;
  floorAboveGradeIn: number;
  airGapIn: number;
  sides: DeckSide[];
  deckAreaSqFt: number;
  guardsRequired: boolean;
  guardMinIn: number;
  lateralBracingRequired: boolean;
  postSize: string;
  postHeightFt: number;
  /** Clear distance from the nearest post FACE to the vehicle, in. */
  postFaceClearanceIn: number;
  /** Pergola geometry. coversUnit is derived: false when the unit is taller than the beam.
   *  clearToSpanUnitFt is the clear height at which one roof would cover everything. */
  pergola: { clearFt: number; beamAboveGradeFt: number; topAboveGradeFt: number; roofAreaSqFt: number; bays: number; coversUnit: boolean; clearToSpanUnitFt: number };
  /** Performance requirements, for the tender. Never a product. */
  spec: {
    deck: { livePsf: number; deadPsf: number; code: string };
    roof: { livePsf: number; snowGroundPsf: number; governedBy: 'roof live' | 'snow'; windMph: number; certification: string };
    screens: { maxPanelFt: [number, number]; deployMaxMph: number; structuralMinMph: number; windSensor: boolean };
    frame: { windMph: number; note: string };
  };
  /** Every unique post position in the ring frame. */
  postsXY: Array<[number, number]>;
  posts: DeckPost[];
  /** Foundation split by what actually loads each post. */
  foundation: {
    footingCount: number; pileCount: number;
    footingMinDepthIn: number;
    perFootingServiceLb: number; perPileServiceLb: number;
    tensionRequired: boolean;
    note: string;
  };
  /** Prefab take-off: the deck as shop-built panels. */
  prefab: { panelCount: number; maxPanelFt: [number, number]; note: string };
  /** Guard requirement, as performance rather than a height alone. */
  guard: { requiredNow: boolean; minHeightIn: number; maxOpeningIn: number; viewPreserving: boolean; finish: string };
  /** Board direction, a finish decision with a framing consequence. */
  boardDirection: string;
  /** Covered fraction and whether it keeps the open-deck position. */
  openness: { coveredSqFt: number; deckSqFt: number; coveredFraction: number; withinOpenDeckRule: boolean };
  notes: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Girder span for a joist span, from the table, reading the next LONGER
 *  joist span when between rows so the answer is conservative. */
export function girderSpanFt(girder: string, joistSpanFt: number): number {
  const row = APPENDIX_M.girderSpanFt[girder];
  const keys = Object.keys(row).map(Number).sort((a, b) => a - b);
  const key = keys.find((k) => k >= joistSpanFt) ?? keys[keys.length - 1];
  return row[key];
}

/**
 * What a cantilever costs, decided by statics rather than by taste.
 *
 * Backspan is the deck depth — the joist runs from the inner girder to the
 * outer one and then keeps going. Uplift at the BACK line is checked with full
 * load out on the tip, which is the case that lifts it.
 */
export function checkCantilever(cantileverFt: number, backspanFt: number): CantileverCheck {
  const wd = APPENDIX_M.deckDeadPsf, wl = APPENDIX_M.deckLivePsf;
  const L = backspanFt, c = cantileverFt;
  // R_back = wd*L/2 - (wd+wl)*c^2/(2L): dead holds it down, tip load levers it up.
  const backReactionPlf = round2(L > 0 ? (wd * L) / 2 - ((wd + wl) * c * c) / (2 * L) : 0);
  const fraction = L > 0 ? round2(c / L) : Infinity;
  const woodOk = fraction <= CANTILEVER.woodMaxFractionOfBackspan + 1e-9;
  const liftsBackLine = backReactionPlf < 0;
  return {
    cantileverFt: round2(c), backspanFt: round2(L), fraction, woodOk, liftsBackLine, backReactionPlf,
    material: woodOk ? 'wood, App M tables' : 'engineered steel, PE stamp',
    reason: woodOk
      ? `${round2(c)} ft is ${Math.round(fraction * 100)}% of the ${round2(L)} ft backspan, inside the `
        + `${CANTILEVER.woodMaxFractionOfBackspan * 100}% joist rule (IRC R507), so ordinary joists carry it.`
      : `${round2(c)} ft is ${Math.round(fraction * 100)}% of the ${round2(L)} ft backspan, past the `
        + `${CANTILEVER.woodMaxFractionOfBackspan * 100}% joist rule — this is an ENGINEERED STEEL frame with a PE `
        + 'stamp, which is what the reference projects are ("supported entirely on steel").',
  };
}

export function buildDeckPlan(cfg: DeckConfig): DeckPlan {
  const u = cfg.unit;
  const gap = cfg.airGapIn / 12;
  const notes: string[] = [];

  // Outer envelope: unit + gap + deck on each side.
  const outerWidthFt = round2(u.widthFt + 2 * gap + cfg.depthFt.doorSide + cfg.depthFt.farSide);
  const outerLengthFt = round2(u.lengthFt + 2 * gap + cfg.depthFt.endA + cfg.depthFt.endB);

  // Floor height drives two code requirements, both binary.
  const floorIn = u.floorAboveGradeIn;
  const guardsRequired = floorIn > APPENDIX_M.guardThresholdIn;
  const lateralBracingRequired = floorIn > APPENDIX_M.bracingThresholdIn;

  // Posts: from footing to girder. Footing top is at grade (pile cap), so the
  // post is the floor height less joist + girder depth. 6x6 clears 20 ft; a
  // 4x4 clears 8 — the pergola posts continue above the deck, so 6x6 throughout.
  const postHeightFt = round2(floorIn / 12 - (10 / 12 + 10 / 12) + cfg.pergolaClearFt + 1);
  const postSize = postHeightFt <= APPENDIX_M.postMaxHeightFt['4x4'] ? '4x4' : '6x6';

  const joistSize = '2x10';
  const girder = '3-ply 2x10';
  // Deck-ring frame: x across the unit's width, z along its length. The unit
  // sits at x in [dDoor+gap, dDoor+gap+uW], z in [dA+gap, dA+gap+uL].
  const dDoor = cfg.depthFt.doorSide, dFar = cfg.depthFt.farSide, dA = cfg.depthFt.endA, dB = cfg.depthFt.endB;
  const sides: DeckSide[] = [];
  const allPosts: Array<[number, number]> = [];
  const addPost = (x: number, z: number) => {
    const X = round2(x), Z = round2(z);
    if (!allPosts.some(([px, pz]) => Math.abs(px - X) < 0.05 && Math.abs(pz - Z) < 0.05)) allPosts.push([X, Z]);
  };
  // One side = a strip of joists spanning `depthFt`, carried by two girder
  // lines (outer and inner). Posts along each line at the table spacing.
  const mk = (
    id: DeckSide['id'], runFt: number, depthFt: number, screened: boolean,
    lineAt: (alongFt: number, line: 'outer' | 'inner') => [number, number],
  ) => {
    if (depthFt <= 0) return;
    if (depthFt > APPENDIX_M.joistSpanFt[joistSize]) {
      throw new Error(`${id}: ${depthFt} ft deck depth exceeds the ${APPENDIX_M.joistSpanFt[joistSize]} ft ${joistSize} joist span (AM106.1)`);
    }
    const maxPost = girderSpanFt(girder, depthFt);
    const positions = pilePositions(runFt, maxPost);
    const bays = positions.length - 1;
    const bayWidthFt = round2(runFt / bays);
    const postsXY: Array<[number, number]> = [];
    for (const line of ['outer', 'inner'] as const) {
      for (const a of positions) { const xy = lineAt(a, line); postsXY.push(xy); addPost(...xy); }
    }
    const cant = cfg.cantileverFt?.[id];
    const cantilever = cant && cant > 0 ? checkCantilever(cant, depthFt) : undefined;
    sides.push({
      id, runFt: round2(runFt), depthFt, areaSqFt: round2(runFt * (depthFt + (cant ?? 0))),
      cantilever,
      joist: { spanFt: depthFt, size: joistSize },
      post: { spacingFt: bayWidthFt, perLine: positions.length, lines: 2, girder, size: postSize },
      postsXY, bays, bayWidthFt, screened,
      screenPanelOk: bayWidthFt <= ZIPPER_SCREEN.maxPanelWidthFt && cfg.pergolaClearFt <= ZIPPER_SCREEN.maxPanelHeightFt,
    });
  };
  // Long sides run the full outer length; their inner line sits at the air gap.
  mk('doorSide', outerLengthFt, dDoor, cfg.screened.doorSide, (a, l) => [l === 'outer' ? 0 : dDoor, a]);
  mk('farSide', outerLengthFt, dFar, cfg.screened.farSide, (a, l) => [l === 'outer' ? outerWidthFt : outerWidthFt - dFar, a]);
  // Ends run between the long sides' inner lines; their outer line is the ring
  // edge, their inner line is the air gap at the unit's end.
  const endRun = u.widthFt + 2 * gap;
  mk('endA', endRun, dA, cfg.screened.endA, (a, l) => [dDoor + a, l === 'outer' ? 0 : dA]);
  mk('endB', endRun, dB, cfg.screened.endB, (a, l) => [dDoor + a, l === 'outer' ? outerLengthFt : outerLengthFt - dB]);

  const deckAreaSqFt = round2(sides.reduce((t, s) => t + s.areaSqFt, 0));
  // The inner girder line sits on the air-gap edge, so a post there has its face
  // (half its width) inside the gap. What is left is the real clearance to the
  // vehicle, and it has to be positive with room to level and skirt the unit.
  const postWidthIn = postSize === '6x6' ? 5.5 : 3.5;
  const postFaceClearanceIn = round2(cfg.airGapIn - postWidthIn / 2);

  // WHICH POSTS NEED A PILE. Only the ones under the pergola: they are the only
  // ones a 115 mph roof can lift. Everything else is gravity-only, and App M
  // asks for a footing 12 in below grade — a precast pier or a poured pad.
  // Piling all 28 because six of them need it is the expensive default.
  // A zoned pergola sits over ONE side's deck strip. It never crosses the unit,
  // so the ridge-clearance question does not arise and the beam can stay low.
  const zone = cfg.pergolaZone;
  const zoneSide = zone ? sides.find((x) => x.id === zone.side) : undefined;
  if (zone && !zoneSide) throw new Error(`pergolaZone names side "${zone.side}", which has no deck`);
  // THE PERGOLA CARRIES ITS OWN POSTS. It cannot adopt whichever deck posts
  // happen to fall inside it — a 20 ft roof landing on two mid-span posts and
  // nothing at its corners is not a structure. So the zone places posts at its
  // own corners and splits its span to the screen module, then those positions
  // join the deck grid (deduped, so a coincident deck post is reused).
  const pergolaPosts: Array<[number, number]> = [];
  if (zone && zoneSide) {
    const a0 = zone.startFt, a1 = Math.min(zone.startFt + zone.lengthFt, zoneSide.runFt);
    const alongs = pilePositions(a1 - a0, Math.min(ZIPPER_SCREEN.maxPanelWidthFt, girderSpanFt(girder, zoneSide.depthFt)))
      .map((d) => round2(a0 + d));
    const acrossLines = zoneSide.id.startsWith('end')
      ? [zoneSide.postsXY[0][1], zoneSide.postsXY[zoneSide.postsXY.length - 1][1]]
      : [zoneSide.postsXY[0][0], zoneSide.postsXY[zoneSide.postsXY.length - 1][0]];
    for (const across of acrossLines) {
      for (const along of alongs) {
        const xy: [number, number] = zoneSide.id.startsWith('end') ? [along, across] : [across, along];
        pergolaPosts.push(xy); addPost(...xy);
      }
    }
  }
  const inZone = (x: number, z: number): boolean =>
    pergolaPosts.some(([px, pz]) => Math.abs(px - x) < 0.05 && Math.abs(pz - z) < 0.05);

  // A cantilever that lifts its back line makes THAT line a tie-down. The inner
  // girder of a cantilevered side therefore needs piles, for a different reason
  // than the pergola and in a different place.
  const liftedLines = sides.filter((x) => x.cantilever?.liftsBackLine);
  const onLiftedBackLine = (x: number, z: number): boolean => liftedLines.some((sd) => {
    // the inner line is the one nearer the unit
    const pts = sd.postsXY;
    const key = sd.id.startsWith('end') ? 1 : 0;
    const vals = [...new Set(pts.map((q) => q[key]))].sort((a, b) => a - b);
    const inner = sd.id === 'doorSide' || sd.id === 'endA' ? vals[vals.length - 1] : vals[0];
    return Math.abs((key ? z : x) - inner) < 0.05
      && pts.some(([px, pz]) => Math.abs(px - x) < 0.05 && Math.abs(pz - z) < 0.05);
  });

  // Roof: does the pergola span the unit, or only the deck? That is decided by
  // whether the unit fits UNDER the pergola beam. An A-frame park model's ridge
  // (~13.5 ft) is above a 9.5 ft-clear beam (12.5 ft), and its roof slopes down
  // to deck level — so a roof across it would intersect it nearly everywhere.
  // The first version assumed the full ring and was wrong for exactly the unit
  // this was designed around; the drawing showed the ridge poking through.
  const beamAboveGradeFt = round2(floorIn / 12 + cfg.pergolaClearFt);
  const roofCoversUnit = false;
  // The clear height that WOULD put one roof over everything: beam a foot above
  // the unit's highest point. Derived so the alternative is always priced, not
  // guessed — and because the drawing showed why it is usually the better one.
  const RIDGE_MARGIN_FT = 1;
  const clearToSpanUnitFt = round2(Math.max(cfg.pergolaClearFt, u.transportHeightFt + RIDGE_MARGIN_FT - floorIn / 12));
  const roofAreaSqFt = zoneSide ? round2(Math.min(zone!.lengthFt, zoneSide.runFt) * zoneSide.depthFt) : 0;
  const roofSnowPsf = 0.7 * cfg.groundSnow.psf;
  const roofGovernedBy = roofSnowPsf > cfg.roofLivePsf ? 'snow' as const : 'roof live' as const;
  const roofDesignPsf = Math.max(roofSnowPsf, cfg.roofLivePsf);
  const topAboveGradeFt = round2(floorIn / 12 + cfg.pergolaClearFt + 1);

  // Counted AFTER the pergola has placed its own posts.
  const postCount = allPosts.length;
  const deckLoadLb = deckAreaSqFt * (APPENDIX_M.deckLivePsf + APPENDIX_M.deckDeadPsf);
  const roofLoadLb = roofAreaSqFt * (roofDesignPsf + 8); // 8 psf aluminum roof + frame
  const posts: DeckPost[] = allPosts.map(([x, z]) => ({
    xFt: x, zFt: z, support: (inZone(x, z) || onLiftedBackLine(x, z)) ? 'pile' : 'footing', serviceLoadLb: 0,
  }));
  const pileCount = posts.filter((q) => q.support === 'pile').length;
  const footingCount = posts.length - pileCount;
  const perFootingServiceLb = Math.round(deckLoadLb / postCount * 1.15);
  const perPileServiceLb = pileCount
    ? Math.round((deckLoadLb / postCount + roofLoadLb / pileCount) * 1.15)
    : 0;
  for (const q of posts) q.serviceLoadLb = q.support === 'pile' ? perPileServiceLb : perFootingServiceLb;

  // Prefab: the deck as shop-built panels landing on the girder lines.
  const panelCount = sides.reduce((t, x) => {
    const perBay = Math.ceil(x.bayWidthFt / PREFAB_PANEL.maxLengthFt);
    const across = Math.ceil(x.depthFt / PREFAB_PANEL.maxWidthFt);
    return t + x.bays * perBay * across;
  }, 0);

  const coveredFraction = deckAreaSqFt ? round2(roofAreaSqFt / deckAreaSqFt) : 0;
  const withinOpenDeckRule = coveredFraction <= OPEN_DECK.maxCoveredFraction;

  if (!zone) {
    notes.push('OPEN DECK, NO ROOF. Nothing here can be lifted by wind, so every post is a '
      + 'gravity-only footing and the deck is unambiguously open for the one-building rule.');
  } else {
    notes.push(`THE PERGOLA COVERS ONE ZONE (${roofAreaSqFt} sq ft of ${deckAreaSqFt} sq ft, `
      + `${Math.round(coveredFraction * 100)}%) on the ${zone.side} — the outdoor room, not the whole ring. `
      + 'It never crosses the unit and never links two units.');
    notes.push('THE DECK STAYS OPEN, AND THAT IS A TAX RULE. The deal position is "three park models '
      + 'linked by open decks, no Whiteco argument" — the deck pods are §1245, 5-year lane. A roof over '
      + 'the whole deck is what a Whiteco inherently-permanent argument feeds on, and a roof bridging two '
      + `units is the one-building rule itself. This design stays at ${Math.round(coveredFraction * 100)}% `
      + `covered against the ${Math.round(OPEN_DECK.maxCoveredFraction * 100)}% working cap`
      + `${withinOpenDeckRule ? '' : ' — OVER IT, and the tax workstream should price that before it is built'}. `
      + 'Confirm the covered fraction with the tax workstream, not with me.');
  }
  notes.push(`FREE-STANDING. ${cfg.airGapIn} in clear air gap to the unit on every side; no ledger, no `
    + 'fastener, no bearing on the vehicle. A weather strip may bridge the gap if it is removable. '
    + 'This is what keeps the park model a park model.');
  notes.push('SCREENS ARE NOT WALLS. Track-retained mesh on a pergola is a screened porch, which NC '
    + 'park-model practice and Appendix M both permit; a wall panel, glazing or a door in that '
    + 'opening makes it an enclosed room. Do not add one.');
  if (guardsRequired) {
    notes.push(`GUARDS REQUIRED, ${GUARD.minHeightIn} in minimum (R312): the deck floor is `
      + `${floorIn} in above grade, over the ${APPENDIX_M.guardThresholdIn} in threshold. This follows `
      + 'from meeting the unit\'s floor, not from a choice.');
    notes.push(`THE GUARD IS THE VIEW. ${GUARD.minHeightIn} in and a ${GUARD.maxOpeningIn} in sphere are the code; `
      + 'the requirement here is that the infill be VIEW-PRESERVING — horizontal cable, rod or fine mesh on slim '
      + `posts, ${GUARD.finish}. A height alone invites solid balusters, which meet R312 and wall off the forest `
      + 'the unit is sold on. Specified as performance so any system can bid it.');
  }
  // The framing consequence FOLLOWS the board direction — boards always run
  // across their joists, so naming one names the other. Hardcoding it meant
  // flipping the direction left the note saying the opposite of the truth.
  const boardsPerp = /perpendicular/.test(DECK_BOARD_DIRECTION);
  notes.push(`DECKING RUNS ${DECK_BOARD_DIRECTION.toUpperCase()}, so joists run `
    + `${boardsPerp ? 'PARALLEL to the wall' : 'ACROSS the deck depth'} — boards always run across their joists. `
    + `${boardsPerp
      ? 'That is not the shortest span, so it is a finish decision with a framing consequence.'
      : 'That is the shortest span, so it is also the cheapest framing.'} `
    + 'State it, and let the panel shop lay boards to match before delivery.');
  if (lateralBracingRequired) {
    notes.push(`LATERAL BRACING REQUIRED (AM109.1.1): a free-standing deck above ${APPENDIX_M.bracingThresholdIn} in `
      + 'needs knee braces, cross-bracing or embedded posts. Same cause as the guards.');
  }
  notes.push(`THE FRAME, NOT THE MESH, TAKES THE WIND. Design the pergola and posts for ${cfg.wind.ultimateMph} mph `
    + `ultimate with screens retracted. Screens deploy to ${ZIPPER_SCREEN.deployMaxMph} mph and must carry a `
    + 'wind sensor that retracts them automatically — a requirement, not an option. Basis: '
    + `${cfg.wind.citation}`);
  notes.push(`ROOF SIZED BY ${roofGovernedBy.toUpperCase()}: ${roofDesignPsf.toFixed(1)} psf (ground snow `
    + `${cfg.groundSnow.psf} -> ${roofSnowPsf.toFixed(1)} psf on the roof; roof live ${cfg.roofLivePsf}). `
    + `Specify >= ${Math.ceil(roofDesignPsf)} psf and >= ${cfg.wind.ultimateMph} mph with an ICC-ES report or a `
    + 'NC PE stamp; three surveyed makers clear both, so this line is competitive.');
  for (const sd of sides) {
    const cc = sd.cantilever;
    if (!cc) continue;
    notes.push(`${sd.id.toUpperCase()} CANTILEVERS ${cc.cantileverFt} FT past its outer girder. ${cc.reason}`
      + (cc.liftsBackLine
        ? ` ⚠️ AND IT LIFTS ITS BACK LINE: full load on the tip gives ${cc.backReactionPlf} plf there, so the inner `
          + 'girder line is a TIE-DOWN, not a bearing. Those posts are piles quoted for tension — a different reason '
          + 'and a different place from the pergola.'
        : ` The back line still bears (${cc.backReactionPlf} plf), so no tie-down is needed for it.`)
      + ` Deflection governs the feel: ${CANTILEVER.tipDeflectionLimit}.`);
    notes.push(`AND THE CANTILEVER IS THE BEST PREFAB CANDIDATE HERE. A post ring is many small field `
      + 'connections on a 12.8% slope; a cantilevered bay is ONE moment connection to a backspan, made in a shop '
      + 'with camber built in. Fabricate the bay complete, set it on the two girder lines, bolt it down. That is '
      + 'fewer site operations than the ring it replaces, not more.');
  }

  const fit = fitsEnvelope(u);
  notes.push(fit.fits
    ? `DESIGNED TO THE ENVELOPE, NOT TO THIS UNIT. Any park model ${PARK_MODEL_ENVELOPE.widthFt[0]}-${PARK_MODEL_ENVELOPE.widthFt[1]} ft `
      + `wide by ${PARK_MODEL_ENVELOPE.lengthFt[0]}-${PARK_MODEL_ENVELOPE.lengthFt[1]} ft long fits this deck `
      + `(exterior box — A119.5's ${PARK_MODEL_ENVELOPE.ansiLivingAreaCapSqFt} sq ft is living area in setup mode, `
      + 'a different measure): the ring dimension '
      + 'changes, the post grid, spans, panel sizes and details do not. Buy on price and lead time, not on which '
      + 'manufacturer the deck was drawn around — including next year\'s catalogue.'
    : `⚠️ THIS UNIT IS OUTSIDE THE ENVELOPE (${fit.failures.join('; ')}). The deck still computes, but it is now `
      + 'a one-off for one model rather than a design any park model can sit on.');
  notes.push(`THE OPERATING COMPARABLE USES ${OBSERVED_COMPARABLE.deckFoundation.toUpperCase()} — observed, `
    + 'not inferred, on the nearest working resort in the same climate, and the same detail carries their '
    + `cabins. ⚠️ ${OBSERVED_COMPARABLE.unresolved}`);
  notes.push(pileCount
    ? `FOUNDATION SPLIT BY WHAT LOADS IT. ${pileCount} posts sit under the pergola and are the only ones a `
      + `${cfg.wind.ultimateMph} mph roof can lift, so those get piles quoted for TENSION as well as `
      + `compression. The other ${footingCount} carry gravity only, and App M AM102.1 asks for a footing `
      + `${APPENDIX_M.footingMinDepthIn} in below grade — a precast pier or a poured pad. Piling all `
      + `${posts.length} because ${pileCount} need it is the expensive default, and it is not required.`
    : `NO UPLIFT ANYWHERE, so no piles: all ${footingCount} posts are gravity-only footings at `
      + `${APPENDIX_M.footingMinDepthIn} in below grade.`);
  notes.push(`SITE LABOUR. ${panelCount} shop-built deck panels (max ${PREFAB_PANEL.maxWidthFt} x `
    + `${PREFAB_PANEL.maxLengthFt} ft, stacked for delivery) landing on the girder lines, so field work is `
    + 'SETTING panels on a levelled post grid rather than cutting and fastening joists on a 12.8% slope, '
    + 'fifty times over. Screw piles and precast piers both avoid concrete cure entirely — no truck, no '
    + 'wait, load the same day. Across 50 lots the repeated field operation is what costs, not the parts.');
  notes.push('SEQUENCE: deliver and level the unit FIRST, deck after. The manufacturer restricts delivery '
    + 'onto elevated platforms, and the deck floor is set to the unit\'s as-levelled height.');
  notes.push(topAboveGradeFt <= u.transportHeightFt + 0.01
    ? `The pergola top sits ${topAboveGradeFt} ft above grade — at or below the unit's own `
      + `${u.transportHeightFt} ft transport height, so it adds nothing to the Part 77 declaration.`
    : `The pergola top sits ${topAboveGradeFt} ft above grade, ${round2(topAboveGradeFt - u.transportHeightFt)} ft above the `
      + `unit's ${u.transportHeightFt} ft — declare the pergola, not the unit, on Form 7460-1.`);
  notes.push('Frost depth is a LOCAL fill-in in NC and is UNCONFIRMED for Cherokee County; Appendix M\'s '
    + '12 in minimum is the floor, and a helical pile is driven well past either. Confirm before a permit set.');
  if (!sides.every((s) => s.screenPanelOk)) {
    notes.push('A bay exceeds the screen module — split it with an intermediate post.');
  }

  return {
    unit: u, envelope: fitsEnvelope(u), outerWidthFt, outerLengthFt, floorAboveGradeIn: floorIn, airGapIn: cfg.airGapIn,
    sides, deckAreaSqFt, guardsRequired, guardMinIn: APPENDIX_M.guardMinIn, lateralBracingRequired,
    postSize, postHeightFt, postsXY: allPosts, posts, postFaceClearanceIn,
    foundation: {
      footingCount, pileCount, footingMinDepthIn: APPENDIX_M.footingMinDepthIn,
      perFootingServiceLb, perPileServiceLb, tensionRequired: pileCount > 0,
      note: pileCount
        ? `${pileCount} piles under the pergola (uplift), ${footingCount} footings elsewhere (gravity only).`
        : 'No pergola, so no uplift anywhere: every post is a gravity-only footing.',
    },
    guard: { requiredNow: guardsRequired, minHeightIn: GUARD.minHeightIn, maxOpeningIn: GUARD.maxOpeningIn,
      viewPreserving: GUARD.viewPreserving, finish: GUARD.finish },
    boardDirection: DECK_BOARD_DIRECTION,
    prefab: { panelCount, maxPanelFt: [PREFAB_PANEL.maxWidthFt, PREFAB_PANEL.maxLengthFt],
      note: 'Panels are shop-built and land on the girder lines; field work is setting, not framing.' },
    openness: { coveredSqFt: roofAreaSqFt, deckSqFt: deckAreaSqFt, coveredFraction, withinOpenDeckRule },
    pergola: { clearFt: cfg.pergolaClearFt, beamAboveGradeFt, topAboveGradeFt, roofAreaSqFt,
      bays: sides.reduce((t, s) => t + s.bays, 0), coversUnit: roofCoversUnit, clearToSpanUnitFt },
    spec: {
      deck: { livePsf: APPENDIX_M.deckLivePsf, deadPsf: APPENDIX_M.deckDeadPsf, code: 'NC Residential Code 2018 Appendix M' },
      roof: { livePsf: cfg.roofLivePsf, snowGroundPsf: cfg.groundSnow.psf, governedBy: roofGovernedBy,
        windMph: cfg.wind.ultimateMph, certification: 'ICC-ES ESR or NC PE stamp' },
      screens: { maxPanelFt: [ZIPPER_SCREEN.maxPanelWidthFt, ZIPPER_SCREEN.maxPanelHeightFt],
        deployMaxMph: ZIPPER_SCREEN.deployMaxMph, structuralMinMph: ZIPPER_SCREEN.structuralMinMph,
        windSensor: ZIPPER_SCREEN.windSensorRequired },
      frame: { windMph: cfg.wind.ultimateMph, note: 'designed bare — screens retracted' },
    },
    notes,
  };
}

/** The bid package, provider-neutral, in the same form as the panel and pile tenders. */
export function renderDeckTender(plan: DeckPlan, meta: { deliverTo?: string } = {}): string {
  const out: string[] = [];
  out.push('# Covered screened deck around a park model — request for quotation');
  out.push('');
  out.push(`Unit: **${plan.unit.name}**, ${round2(plan.unit.widthFt)} x ${round2(plan.unit.lengthFt)} ft, floor **${plan.floorAboveGradeIn} in** above grade  `);
  out.push(`Deck ring outside: **${plan.outerWidthFt} x ${plan.outerLengthFt} ft** · deck **${plan.deckAreaSqFt} sq ft** · `
    + `pergola **${plan.pergola.roofAreaSqFt} sq ft** (${Math.round(plan.openness.coveredFraction * 100)}% covered — the deck stays OPEN)`);
  if (meta.deliverTo) out.push(`Site: **${meta.deliverTo}**`);
  out.push('');
  out.push('**Performance and geometry only.** No pergola brand, screen brand, pile brand or lumber');
  out.push('supplier is named. Quote whatever you supply that meets the numbers.');
  out.push('');
  out.push('## Deck (NC Residential Code 2018 Appendix M)');
  out.push('');
  out.push('| Side | Run ft | Depth ft | Area sq ft | Joist | Posts | Spacing ft | Girder | Screened |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const s of plan.sides) {
    out.push(`| ${s.id} | ${s.runFt} | ${s.depthFt} | ${s.areaSqFt} | ${s.joist.size} @16 | ${s.post.perLine} x 2 lines | ${s.bayWidthFt} | ${s.post.girder} | ${s.screened ? 'yes' : 'no'} |`);
  }
  out.push('');
  if (plan.guard.requiredNow) {
    out.push('');
    out.push(`**Guard: ${plan.guard.minHeightIn} in min, ${plan.guard.maxOpeningIn} in sphere (R312), and VIEW-PRESERVING infill** — `
      + `horizontal cable, rod or fine mesh on slim posts, ${plan.guard.finish}. Solid balusters meet the code and `
      + 'defeat the purpose; do not quote them.');
    out.push(`**Decking runs ${plan.boardDirection}.**`);
  }
  out.push('');
  out.push(`Posts **${plan.postSize}**, ${plan.postHeightFt} ft footing-to-pergola-beam. Guards **${plan.guardsRequired ? `required, ${plan.guardMinIn} in min` : 'not required'}**. `
    + `Lateral bracing **${plan.lateralBracingRequired ? 'required' : 'not required'}**. Live ${plan.spec.deck.livePsf} / dead ${plan.spec.deck.deadPsf} psf.`);
  out.push('');
  out.push('## Pergola roof (performance)');
  out.push('');
  out.push(`| Roof live / snow | >= ${Math.ceil(Math.max(plan.spec.roof.livePsf, 0.7 * plan.spec.roof.snowGroundPsf))} psf (governed by ${plan.spec.roof.governedBy}) |`);
  out.push('|---|---|');
  out.push(`| Wind, screens retracted | >= ${plan.spec.roof.windMph} mph ultimate |`);
  out.push(`| Certification | ${plan.spec.roof.certification} |`);
  out.push(`| Clear height over deck | ${plan.pergola.clearFt} ft |`);
  out.push(`| Bays | ${plan.pergola.bays} |`);
  out.push('');
  out.push('## Screens (track-retained, retractable)');
  out.push('');
  out.push(`| Panel | one per bay, none over ${plan.spec.screens.maxPanelFt[0]} x ${plan.spec.screens.maxPanelFt[1]} ft |`);
  out.push('|---|---|');
  out.push(`| Deployed rating | >= ${plan.spec.screens.deployMaxMph} mph; structural >= ${plan.spec.screens.structuralMinMph} mph |`);
  out.push(`| Wind sensor | **required** — automatic retraction |`);
  out.push('');
  out.push('## Foundation');
  out.push('');
  const f = plan.foundation;
  out.push(`| Gravity-only posts | **${f.footingCount}** footings, **${f.perFootingServiceLb} lb** each, >= ${f.footingMinDepthIn} in below grade (AM102.1) — precast pier or poured pad |`);
  out.push('|---|---|');
  if (f.pileCount) {
    out.push(`| Under the pergola | **${f.pileCount}** piles, **${f.perPileServiceLb} lb** compression each, **tension capacity to be quoted** — no depth specified, drive to torque |`);
  }
  out.push('');
  out.push(`Only the pergola posts can be lifted by wind. Quoting piles under all ${plan.posts.length} posts is not required.`);
  out.push('');
  out.push('## Prefabrication');
  out.push('');
  out.push(`**${plan.prefab.panelCount} shop-built deck panels**, none over ${plan.prefab.maxPanelFt[0]} x ${plan.prefab.maxPanelFt[1]} ft, landing on the girder lines. `
    + 'Price the panels and the setting separately from any field framing — across 50 lots the repeated field operation is the cost.');
  out.push('');
  out.push('## Read these before quoting');
  out.push('');
  for (const n of plan.notes) out.push(`- ${n}`);
  out.push(bidForm([
    'Deck framing and decking, delivered and installed',
    'Guards and stairs',
    'Pergola, supplied and installed (state the ICC-ES report or PE stamp)',
    'Screens, per bay, with motor and wind sensor',
    'Footings for the gravity-only posts (precast pier or poured pad)',
    'Piles under the pergola only (compression AND tension capacity)',
    'Shop-built deck panels, delivered',
    'Setting panels on site',
    'Freight / mobilisation',
  ]));
  return out.join('\n');
}
