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
  /** Clear gap between deck edge and unit — no contact, no fastener. */
  airGapIn: number;
  /** Clear height under the pergola beam, above the deck. */
  pergolaClearFt: number;
  /** Site basis. */
  wind: WindBasis;
  groundSnow: LoadInput;
  roofLivePsf: number;
  /** Which sides get screens. Screens are not walls; see notes. */
  screened: { doorSide: boolean; farSide: boolean; endA: boolean; endB: boolean };
}

// ---------------------------------------------------------------------------
// Outputs.

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
}

export interface DeckPlan {
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
  /** Every unique post position in the ring frame — one helical pile each. */
  postsXY: Array<[number, number]>;
  /** Foundation: one helical pile per post. */
  piles: { count: number; perPostServiceLb: number; tensionRequired: boolean; footingMinDepthIn: number };
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
    sides.push({
      id, runFt: round2(runFt), depthFt, areaSqFt: round2(runFt * depthFt),
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
  // Unique post positions across all beam lines — shared corners count once.
  const postCount = allPosts.length;
  // The inner girder line sits on the air-gap edge, so a post there has its face
  // (half its width) inside the gap. What is left is the real clearance to the
  // vehicle, and it has to be positive with room to level and skirt the unit.
  const postWidthIn = postSize === '6x6' ? 5.5 : 3.5;
  const postFaceClearanceIn = round2(cfg.airGapIn - postWidthIn / 2);

  // Roof: does the pergola span the unit, or only the deck? That is decided by
  // whether the unit fits UNDER the pergola beam. An A-frame park model's ridge
  // (~13.5 ft) is above a 9.5 ft-clear beam (12.5 ft), and its roof slopes down
  // to deck level — so a roof across it would intersect it nearly everywhere.
  // The first version assumed the full ring and was wrong for exactly the unit
  // this was designed around; the drawing showed the ridge poking through.
  const beamAboveGradeFt = round2(floorIn / 12 + cfg.pergolaClearFt);
  const roofCoversUnit = u.transportHeightFt <= beamAboveGradeFt;
  // The clear height that WOULD put one roof over everything: beam a foot above
  // the unit's highest point. Derived so the alternative is always priced, not
  // guessed — and because the drawing showed why it is usually the better one.
  const RIDGE_MARGIN_FT = 1;
  const clearToSpanUnitFt = round2(Math.max(cfg.pergolaClearFt, u.transportHeightFt + RIDGE_MARGIN_FT - floorIn / 12));
  const roofAreaSqFt = roofCoversUnit
    ? round2(outerWidthFt * outerLengthFt)
    : round2(sides.reduce((t, s) => t + s.areaSqFt, 0));
  const roofSnowPsf = 0.7 * cfg.groundSnow.psf;
  const roofGovernedBy = roofSnowPsf > cfg.roofLivePsf ? 'snow' as const : 'roof live' as const;
  const roofDesignPsf = Math.max(roofSnowPsf, cfg.roofLivePsf);
  const topAboveGradeFt = round2(floorIn / 12 + cfg.pergolaClearFt + 1);

  // Piles: one per post. Service load = tributary deck (live+dead) + roof share
  // + a modest frame allowance. Roughly even, so the max is close to the mean.
  const deckLoadLb = deckAreaSqFt * (APPENDIX_M.deckLivePsf + APPENDIX_M.deckDeadPsf);
  const roofLoadLb = roofAreaSqFt * (roofDesignPsf + 8); // 8 psf aluminum roof + frame
  const perPostServiceLb = Math.round((deckLoadLb + roofLoadLb) / postCount * 1.15);

  notes.push(roofCoversUnit
    ? `THE PERGOLA SPANS THE UNIT: the unit tops out at ${u.transportHeightFt} ft, under the ${beamAboveGradeFt} ft beam, `
      + `so one roof covers deck and unit together (${roofAreaSqFt} sq ft).`
    : `THE PERGOLA COVERS THE DECK ONLY (${roofAreaSqFt} sq ft), NOT THE UNIT. The unit's ridge (~${u.transportHeightFt} ft) `
      + `is above the ${beamAboveGradeFt} ft beam and its roof slopes to deck level, so a roof across it would `
      + 'intersect it. The pergola runs as strips along each deck side and ABUTS the unit\'s roof plane with a '
      + 'removable flashing or gap — never fastened to it.');
  if (!roofCoversUnit) {
    notes.push(`RUNOFF WARNING: an A-frame's eave is AT DECK LEVEL, so the unit's whole roof (~${round2(u.widthFt * u.lengthFt)} `
      + `sq ft) sheds into the ${cfg.airGapIn} in gap, inches from the covered deck. The inner edge of a strips-only `
      + `pergola gets every drop. RECOMMENDED: lift the beam to ${clearToSpanUnitFt} ft clear (${RIDGE_MARGIN_FT} ft over the `
      + 'ridge) and put ONE roof over deck and unit — the unit stays dry, nothing sheds onto the deck, and it is one '
      + `roof to build instead of four strips. Cost: posts to ${round2(clearToSpanUnitFt + floorIn / 12 + 1)} ft above grade `
      + `and about ${round2(clearToSpanUnitFt + floorIn / 12 + 1 - u.transportHeightFt)} ft on the Part 77 declaration.`);
  }
  notes.push(`POST FACE TO VEHICLE: ${postFaceClearanceIn} in. The inner girder line sits on the air-gap edge, so a `
    + `${postSize} (${postWidthIn} in) takes ${postWidthIn / 2} in of the ${cfg.airGapIn} in gap. Leave room to re-level and skirt.`);
  notes.push(`FREE-STANDING. ${cfg.airGapIn} in clear air gap to the unit on every side; no ledger, no `
    + 'fastener, no bearing on the vehicle. A weather strip may bridge the gap if it is removable. '
    + 'This is what keeps the park model a park model.');
  notes.push('SCREENS ARE NOT WALLS. Track-retained mesh on a pergola is a screened porch, which NC '
    + 'park-model practice and Appendix M both permit; a wall panel, glazing or a door in that '
    + 'opening makes it an enclosed room. Do not add one.');
  if (guardsRequired) {
    notes.push(`GUARDS REQUIRED, ${APPENDIX_M.guardMinIn} in minimum (R312): the deck floor is `
      + `${floorIn} in above grade, over the ${APPENDIX_M.guardThresholdIn} in threshold. This follows `
      + 'from meeting the unit\'s floor, not from a choice.');
  }
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
  notes.push('UPLIFT: a roof at 115 mph pulls UP. Every pile is quoted for tension as well as compression; '
    + 'the demand is the PE\'s to compute, the requirement is not.');
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
    unit: u, outerWidthFt, outerLengthFt, floorAboveGradeIn: floorIn, airGapIn: cfg.airGapIn,
    sides, deckAreaSqFt, guardsRequired, guardMinIn: APPENDIX_M.guardMinIn, lateralBracingRequired,
    postSize, postHeightFt, postsXY: allPosts, postFaceClearanceIn,
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
    piles: { count: postCount, perPostServiceLb, tensionRequired: true, footingMinDepthIn: APPENDIX_M.footingMinDepthIn },
    notes,
  };
}

/** The bid package, provider-neutral, in the same form as the panel and pile tenders. */
export function renderDeckTender(plan: DeckPlan, meta: { deliverTo?: string } = {}): string {
  const out: string[] = [];
  out.push('# Covered screened deck around a park model — request for quotation');
  out.push('');
  out.push(`Unit: **${plan.unit.name}**, ${round2(plan.unit.widthFt)} x ${round2(plan.unit.lengthFt)} ft, floor **${plan.floorAboveGradeIn} in** above grade  `);
  out.push(`Deck ring outside: **${plan.outerWidthFt} x ${plan.outerLengthFt} ft** · deck area **${plan.deckAreaSqFt} sq ft** · roof **${plan.pergola.roofAreaSqFt} sq ft**`);
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
  out.push(`**${plan.piles.count} helical piles**, one per post, **${plan.piles.perPostServiceLb} lb** service compression each, `
    + `**tension capacity to be quoted**, footing depth >= ${plan.piles.footingMinDepthIn} in. No depth specified — drive to torque.`);
  out.push('');
  out.push('## Read these before quoting');
  out.push('');
  for (const n of plan.notes) out.push(`- ${n}`);
  out.push(bidForm([
    'Deck framing and decking, delivered and installed',
    'Guards and stairs',
    'Pergola, supplied and installed (state the ICC-ES report or PE stamp)',
    'Screens, per bay, with motor and wind sensor',
    'Helical piles, supplied and driven (compression AND tension capacity)',
    'Freight / mobilisation',
  ]));
  return out.join('\n');
}
