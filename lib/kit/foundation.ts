/**
 * The helical pile take-off.
 *
 * The build method drives helical piles with a hydraulic torque head on a mini
 * excavator, and helicals suit a kit that refuses supplier lock-in better than
 * any other foundation — because of how they are specified. You do not specify
 * a depth or a product: you specify a LOCATION, a required working capacity,
 * and the installation torque that demonstrates it. The installer drives until
 * the torque is achieved, whatever depth that takes, with whatever brand of
 * pile they stock. Two installers can bid the identical scope without either
 * one's catalogue entering the document.
 *
 * WHAT THIS IS NOT. This is a schematic quantity take-off for BIDDING: pile
 * count, positions, and the tributary loads behind them, so two bids can be
 * compared line for line. It is not a foundation design. Allowable capacity
 * depends on soil nobody has tested yet, and every number here needs a North
 * Carolina PE to confirm before anything is driven. Saying otherwise would be
 * practising engineering out of a text file.
 */

import { BEARING_COVERAGE_RATIO } from '../build-validator.ts';

/**
 * Piles are spaced EVENLY at no more than this, rather than snapped to the 4 ft
 * panel module. Even bays keep the pile loads equal, which is what sizes the
 * governing pile; snapping a 28 ft run to the module would mean 4 ft bays and
 * nearly double the piles to buy alignment a rim beam makes unnecessary.
 */
export const MAX_PILE_SPACING_FT = 8;

/** A value the take-off rests on, and where it came from. */
export interface LoadInput {
  psf: number;
  citation: string;
  /** False when nobody has confirmed it for this site — it must not read as fact. */
  sourced: boolean;
}

/**
 * Service (ASD) loads. Helical pile capacity is quoted as allowable, so these
 * are unfactored on purpose.
 */
export const FLOOR_LIVE: LoadInput = {
  psf: 40, sourced: true,
  citation: 'IRC Table R301.5 — living areas 40 psf (sleeping rooms are 30; the heavier governs)',
};
export const FLOOR_DEAD: LoadInput = {
  psf: 12, sourced: false,
  citation: 'Assumed: SIP floor panel, finish and services. Confirm against the panel schedule.',
};
export const ROOF_DEAD: LoadInput = {
  psf: 15, sourced: false,
  citation: 'Assumed: SIP roof panel plus roofing. Confirm against the panel schedule.',
};
/** Per square foot of WALL area, not floor area. */
export const WALL_DEAD: LoadInput = {
  psf: 10, sourced: false,
  citation: 'Assumed: SIP wall with finishes. A 4.5 in panel is ~3.1 psf bare (Thermapan).',
};
/**
 * Roof live load. NOT additive with snow — ASCE 7 takes the larger of D+Lr and
 * D+S, never their sum, and treating them as cumulative would inflate every
 * pile on the roof's whole tributary.
 */
export const ROOF_LIVE: LoadInput = {
  psf: 20, sourced: true,
  citation: 'IRC Table R301.6 — 20 psf for roof slope under 4:12. Steeper roofs are '
    + 'lighter (16 psf to 12:12, then 12 psf), so 20 psf is the governing case.',
};

/**
 * Ground snow for the build region. NC IRC Table R301.2(1) leaves this as a
 * local fill-in, so it cannot be read off the state code the way the R-values
 * can — but ASCE 7-22 does publish a mapped value, and western NC turns out NOT
 * to be a Case Study zone, which is the thing that would have made this a
 * site-specific engineering exercise rather than a lookup.
 *
 * The consequence is worth stating plainly: at 10 psf the ROOF LIVE LOAD
 * GOVERNS, not snow. Flat-roof snow is 0.7 x 10 = 7 psf against a 20 psf roof
 * live minimum, so snow never sizes anything here. It would have to roughly
 * triple before it mattered.
 */
export const CHEROKEE_GROUND_SNOW: LoadInput = {
  psf: 10, sourced: true,
  citation: 'ASCE 7-22 mapped ground snow load, "Measured" quality, not a Case Study zone. '
    + 'Andrews 28901, Murphy 28906 (Cherokee) and Robbinsville 28771 (Graham) all 10 psf. '
    + 'Elevation matters: Cashiers 28717 (~3,500 ft) is 15 psf. NC IRC Table R301.2(1) '
    + 'leaves the code value to the jurisdiction, so confirm with Cherokee County '
    + 'Building Inspections (828-837-6730) before a permit set.',
};

/** For a site whose snow load nobody has looked up yet. */
export const GROUND_SNOW_UNCONFIRMED: LoadInput = {
  psf: 0, sourced: false,
  citation: 'NOT SET BY CODE. NC IRC Table R301.2(1) leaves ground snow load to the '
    + 'jurisdiction. Confirm with Cherokee County Building Inspections before pricing.',
};

/** The wind the site has to stand up to. Context for the tension quote, not a demand. */
export interface WindBasis {
  ultimateMph: number;
  seismicDesignCategory: string;
  citation: string;
  sourced: boolean;
}

/**
 * Cherokee County. Sourced from the state code rather than assumed — NC does
 * publish wind and seismic by county, unlike ground snow load, which it leaves
 * to the jurisdiction.
 */
export const CHEROKEE_WIND: WindBasis = {
  ultimateMph: 115,
  seismicDesignCategory: 'C',
  sourced: true,
  citation: 'NC IRC Table R301.2(5) — Cherokee County is a special mountain region; '
    + '115 mph ultimate below 2,700 ft first-floor elevation (Andrews is ~1,700 ft). '
    + 'Seismic Design Category C per Table R301.2(7).',
};

export interface WallSpan { x1: number; z1: number; x2: number; z2: number }
export interface WallLike { id: string; span?: WallSpan }

export interface Pile {
  id: string;
  xFt: number;
  zFt: number;
  kind: 'corner' | 'perimeter' | 'interior';
  /** Floor/roof area this pile carries, sq ft. */
  tributarySqFt: number;
  /** Unfactored service load in COMPRESSION, lb. */
  serviceLoadLb: number;
  /** Dead load alone — the only load that resists uplift. */
  deadLoadLb: number;
  /**
   * What is available to hold this pile down under ASCE 7's 0.6D + 0.6W uplift
   * case. It is deliberately NOT compared against a wind demand here: that
   * needs exposure category, roof zone and enclosure judgements which are a
   * PE's to make. What this number does is show how little there is — a SIP
   * cabin is light, and at a corner it is a few hundred pounds.
   */
  upliftResistanceLb: number;
}

export interface PileSchedule {
  planId: string;
  piles: Pile[];
  spacingFt: number;
  /** The governing pile, which is what an installer quotes a capacity against. */
  maxServiceLoadLb: number;
  /** Least hold-down available at any pile — the corner. */
  minUpliftResistanceLb: number;
  wind?: WindBasis;
  /** Bearing-line positions used, along the axis the joists span. */
  bearingLinesFt: number[];
  joistAxis: 'x' | 'z';
  loads: {
    snow: LoadInput; floorLive: LoadInput; floorDead: LoadInput;
    roofDead: LoadInput; roofLive: LoadInput; wallDead: LoadInput;
  };
  /** Which of snow or roof live actually sized the roof. */
  roofGovernedBy: 'snow' | 'roof live';
  notes: string[];
}

/**
 * Bearing lines along one axis: the two exterior faces, plus any interior wall
 * line covering BEARING_COVERAGE_RATIO of the perpendicular dimension. Shares
 * that ratio with the joist-span rule on purpose — piles belong under the lines
 * that calculation believes are carrying the floor, and nowhere else.
 */
export function bearingLinesAlong(
  axis: 'x' | 'z',
  widthFt: number,
  depthFt: number,
  interiorWalls: WallLike[],
): number[] {
  const extent = axis === 'z' ? depthFt : widthFt;
  const perp = axis === 'z' ? widthFt : depthFt;
  const TOL = 0.1;
  const coverage = new Map<number, number>();
  for (const wall of interiorWalls) {
    const s = wall.span;
    if (!s) continue;
    const constantZ = Math.abs(s.z1 - s.z2) < TOL;
    const constantX = Math.abs(s.x1 - s.x2) < TOL;
    if (axis === 'z' && constantZ) {
      const pos = Math.round(s.z1 * 2) / 2;
      coverage.set(pos, (coverage.get(pos) ?? 0) + Math.abs(s.x2 - s.x1));
    } else if (axis === 'x' && constantX) {
      const pos = Math.round(s.x1 * 2) / 2;
      coverage.set(pos, (coverage.get(pos) ?? 0) + Math.abs(s.z2 - s.z1));
    }
  }
  const interior = [...coverage.entries()]
    .filter(([, covered]) => covered >= BEARING_COVERAGE_RATIO * perp)
    .map(([pos]) => pos)
    .filter((pos) => pos > TOL && pos < extent - TOL);
  return [...new Set([0, ...interior, extent])].sort((a, b) => a - b);
}

/** Evenly spaced positions from 0 to length, no gap exceeding max. */
export function pilePositions(lengthFt: number, maxSpacingFt = MAX_PILE_SPACING_FT): number[] {
  if (lengthFt <= 0) return [0];
  const bays = Math.max(1, Math.ceil(lengthFt / maxSpacingFt));
  const step = lengthFt / bays;
  return Array.from({ length: bays + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}

export interface PileScheduleInput {
  planId: string;
  footprint: { widthFt: number; depthFt: number };
  interiorWalls?: WallLike[];
  eaveHeightFt: number;
  snow?: LoadInput;
  wind?: WindBasis;
  maxSpacingFt?: number;
}

export function buildPileSchedule(input: PileScheduleInput): PileSchedule {
  const { widthFt, depthFt } = input.footprint;
  const snow = input.snow ?? GROUND_SNOW_UNCONFIRMED;
  const spacingFt = input.maxSpacingFt ?? MAX_PILE_SPACING_FT;
  const interiorWalls = input.interiorWalls ?? [];
  const notes: string[] = [];

  // Joists span the direction with the smaller worst gap, which is also the
  // direction the bearing lines run across. Pick it the same way the joist gate
  // does, so a plan cannot be panelised one way and piled the other.
  const linesZ = bearingLinesAlong('z', widthFt, depthFt, interiorWalls);
  const linesX = bearingLinesAlong('x', widthFt, depthFt, interiorWalls);
  const worst = (lines: number[]) => lines.slice(1).reduce((m, v, i) => Math.max(m, v - lines[i]), 0);
  const joistAxis: 'x' | 'z' = worst(linesZ) <= worst(linesX) ? 'z' : 'x';
  const lines = joistAxis === 'z' ? linesZ : linesX;
  const alongLen = joistAxis === 'z' ? widthFt : depthFt;

  // Flat-roof snow from ground snow: pf = 0.7 Ce Ct Is pg, with the exposure,
  // thermal and importance factors at 1.0 for a heated, partially exposed
  // Risk Category II house. Cs is left at 1.0 rather than taking the slope
  // reduction a pitched roof would earn — conservative, and it keeps the number
  // independent of roof style so two plans stay comparable.
  const roofSnowPsf = 0.7 * snow.psf;
  // The larger of the two, never the sum.
  const roofLivePsf = Math.max(roofSnowPsf, ROOF_LIVE.psf);
  const areaPsf = ROOF_DEAD.psf + roofLivePsf + FLOOR_LIVE.psf + FLOOR_DEAD.psf;
  const deadPsf = ROOF_DEAD.psf + FLOOR_DEAD.psf;
  const wallLineLb = WALL_DEAD.psf * input.eaveHeightFt; // lb per ft of wall run

  const piles: Pile[] = [];
  const along = pilePositions(alongLen, spacingFt);
  lines.forEach((linePos, li) => {
    // Tributary width: half the bay each side of this line.
    const before = li > 0 ? (linePos - lines[li - 1]) / 2 : 0;
    const after = li < lines.length - 1 ? (lines[li + 1] - linePos) / 2 : 0;
    const tribWidth = before + after;
    const isEdgeLine = li === 0 || li === lines.length - 1;
    along.forEach((alongPos, ai) => {
      const beforeA = ai > 0 ? (alongPos - along[ai - 1]) / 2 : 0;
      const afterA = ai < along.length - 1 ? (along[ai + 1] - alongPos) / 2 : 0;
      const tribLen = beforeA + afterA;
      const tributarySqFt = Math.round(tribWidth * tribLen * 100) / 100;
      // Only lines that are actual walls carry wall weight down.
      const serviceLoadLb = Math.round(tributarySqFt * areaPsf + wallLineLb * tribLen);
      // Dead only. Live and snow are transient and cannot be counted on to be
      // present when the wind blows.
      const deadLoadLb = Math.round(tributarySqFt * deadPsf + wallLineLb * tribLen);
      const atEndAlong = ai === 0 || ai === along.length - 1;
      const kind: Pile['kind'] = isEdgeLine && atEndAlong ? 'corner'
        : isEdgeLine ? 'perimeter' : 'interior';
      const x = joistAxis === 'z' ? alongPos : linePos;
      const z = joistAxis === 'z' ? linePos : alongPos;
      piles.push({
        id: `pile-${piles.length + 1}`,
        xFt: Math.round(x * 100) / 100,
        zFt: Math.round(z * 100) / 100,
        kind,
        tributarySqFt,
        serviceLoadLb,
        deadLoadLb,
        upliftResistanceLb: Math.round(0.6 * deadLoadLb),
      });
    });
  });

  const maxServiceLoadLb = piles.reduce((m, p) => Math.max(m, p.serviceLoadLb), 0);
  // The corner is where uplift is worst and hold-down is least, so that is the
  // number an installer needs to see, not the average or the best case.
  const minUpliftResistanceLb = piles.reduce((m, p) => Math.min(m, p.upliftResistanceLb), Infinity);

  if (!snow.sourced) {
    notes.push(`GROUND SNOW LOAD IS UNCONFIRMED (${snow.psf} psf assumed). ${snow.citation} `
      + 'Every load below is short by the real snow load until it is confirmed, so these '
      + 'quantities are comparable between bidders but not yet correct in absolute terms.');
  }
  notes.push(`Roof sized by ${roofSnowPsf > ROOF_LIVE.psf ? 'SNOW' : 'ROOF LIVE LOAD'}: `
    + `${roofLivePsf.toFixed(1)} psf governs (snow gives ${roofSnowPsf.toFixed(1)} psf, `
    + `roof live ${ROOF_LIVE.psf} psf). These are alternatives under ASCE 7, never added.`);
  // The missing load case. A pile rated only for compression is a DIFFERENT
  // PRODUCT from one rated for tension — different helix configuration, often a
  // different shaft, and always a different cap. Two installers quoting the same
  // schedule while assuming differently is exactly the incomparability this
  // document exists to prevent.
  notes.push('QUOTE TENSION AS WELL AS COMPRESSION. '
    + (input.wind
      ? `The site is ${input.wind.ultimateMph} mph ultimate wind, Seismic Design Category `
        + `${input.wind.seismicDesignCategory}. `
      : 'No wind basis was supplied for this site. ')
    + `Hold-down at the lightest pile is only ${Math.round(minUpliftResistanceLb)} lb `
    + '(0.6 x dead load, per the ASCE 7 uplift case) — a SIP building is light, so uplift '
    + 'is likely to govern the corners. The uplift DEMAND is not computed here: it needs '
    + 'exposure category, roof zone and enclosure decisions that belong to the PE. Bid the '
    + 'tension capacity they specify.');
  notes.push('Depth is NOT specified. Each pile is driven to the torque that develops its '
    + 'required capacity per the installer\'s published torque correlation, so any '
    + 'manufacturer\'s pile can meet this scope and no brand appears in it.');
  notes.push(`Piles are placed on the bearing lines the joist calculation uses (a wall must `
    + `cover ${Math.round(BEARING_COVERAGE_RATIO * 100)}% of the span to carry floor), at no `
    + `more than ${spacingFt} ft centres.`);
  notes.push('SCHEMATIC TAKE-OFF FOR BIDDING, NOT A FOUNDATION DESIGN. Allowable capacity '
    + 'depends on untested soil; a North Carolina PE must confirm pile capacity, helix '
    + 'configuration and embedment before installation.');

  return {
    planId: input.planId,
    piles,
    spacingFt,
    maxServiceLoadLb,
    minUpliftResistanceLb,
    wind: input.wind,
    bearingLinesFt: lines,
    joistAxis,
    loads: {
      snow, floorLive: FLOOR_LIVE, floorDead: FLOOR_DEAD,
      roofDead: ROOF_DEAD, roofLive: ROOF_LIVE, wallDead: WALL_DEAD,
    },
    roofGovernedBy: roofSnowPsf > ROOF_LIVE.psf ? 'snow' : 'roof live',
    notes,
  };
}
