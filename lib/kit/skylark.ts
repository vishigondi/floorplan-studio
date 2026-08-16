/**
 * WikiHouse Skylark 150 — the kit envelope this planner builds against.
 *
 * Skylark is the open WikiHouse structural system (Open Systems Lab). We adopt
 * its blocks rather than authoring our own joinery: every block ships CNC-ready
 * DXF cut files (tolerances + dog-bone pockets pre-applied) and a production CSV
 * part list. Source: github.com/wikihouseproject/Skylark, CC BY-SA 4.0.
 *
 * EVERYTHING IN THIS FILE IS OBSERVED FROM THE PUBLISHED REPO. Where a value is
 * NOT verifiable from those files it is left empty and the assessment degrades
 * honestly — we never guess a manufacturing number. In particular the roof
 * PITCH ANGLES are not recoverable from nested cut sheets; they live in the
 * WikiHouse block database (Airtable). Until they are sourced, no plan may
 * claim to be Skylark-buildable.
 */

/** Sheet stock named by the CNC layer `0_SHEET_SPRUCEPLY_2440X1220X18`. */
export const SKYLARK_SHEET_MM = { length: 2440, width: 1220, thickness: 18 } as const;

/** 1220 mm = 4.003 ft — the planner's 4 ft structural grid matches the real
 * sheet width. (The 1.2 m figure build-validator originally used was wrong.) */
export const SKYLARK_MODULE_FT = 1220 / 304.8;

/** Wall thickness options in Skylark v1.0. 150 is released; 200 is not. */
export const SKYLARK_WALL_THICKNESS_MM = [150, 200] as const;

/**
 * The published SKYLARK150 block index, as present in the repo (58 blocks).
 * Span suffixes L / M / S / XXS are Skylark's own size classes.
 */
export const SKYLARK150_BLOCKS = {
  roofs: ['R-L', 'R-L-42', 'R-S', 'R-S-42', 'R-XXS', 'R-XXS-42'],
  walls: [
    'C-L-1', 'C-L-2', 'C-M-1', 'C-M-2', 'C-S-1', 'C-S-2',
    'G-L-5', 'G-L-6', 'G-L-10',
    'G-M-1', 'G-M-2', 'G-M-3', 'G-M-4', 'G-M-7', 'G-M-8', 'G-M-9',
    'G-S-1', 'G-S-2', 'G-S-3', 'G-S-4', 'G-S-5',
    'V-L-1', 'V-L-2', 'V-S-1', 'V-S-2', 'V-XXS-1', 'V-XXS-2',
    'W-L', 'W-M', 'W-S',
  ],
  floors: ['E-L', 'E-S', 'E-XXS', 'F-L', 'F-S', 'F-XXS'],
  openings: [
    'W-O-L-1', 'W-O-L-2', 'W-O-L-3', 'W-O-L-4', 'W-O-L-5',
    'W-O-M-1', 'W-O-M-2', 'W-O-M-3', 'W-O-M-4', 'W-O-M-5',
    'W-O-S-1', 'W-O-S-2', 'W-O-S-3', 'W-O-S-4', 'W-O-S-5',
  ],
  other: ['Ties'],
} as const;

/**
 * Roof pitches Skylark 150 actually ships, in degrees.
 *
 * DELIBERATELY EMPTY. The block set (R-{L,S,XXS} plus a `-42` variant of each)
 * shows ONE roof archetype at TWO pitch variants per span, but the angles are
 * not recoverable from the nested DXF cut sheets, and guessing a roof pitch
 * would be fabricating a manufacturing spec. Populate from the WikiHouse block
 * database, then plans at those pitches become kit-buildable automatically.
 */
export const SKYLARK_ROOF_PITCHES_DEG: readonly number[] = [];

/** Roof archetypes Skylark 150 has NO blocks for, at any pitch. */
const UNSUPPORTED_ROOF_STYLES = ['flat', 'shed', 'hip', 'gambrel', 'barn'] as const;

export type SkylarkKitStatus = 'buildable' | 'not-buildable' | 'unverified';

export interface SkylarkKitAssessment {
  status: SkylarkKitStatus;
  /** Plain-language reasons, safe to show a customer. */
  reasons: string[];
}

export interface SkylarkKitInput {
  roofStyle: string;
  roofPitchDeg: number;
  /** Wall lengths in feet, for the panel-module check. */
  wallLengthsFt?: number[];
}

const MODULE_TOLERANCE_FT = 0.16;

/**
 * Assess whether a compiled plan can be built from the Skylark 150 kit.
 *
 * Fails SAFE: a plan is only ever reported `buildable` when its roof pitch is in
 * the verified Skylark pitch set. With that set empty, nothing claims buildable —
 * which is the honest state until the pitch spec is sourced.
 */
export function assessSkylarkKit(input: SkylarkKitInput): SkylarkKitAssessment {
  const reasons: string[] = [];

  if ((UNSUPPORTED_ROOF_STYLES as readonly string[]).includes(input.roofStyle)) {
    reasons.push(
      `Skylark 150 has no ${input.roofStyle} roof blocks — it ships one roof archetype `
      + `(R-L/R-S/R-XXS, each with a -42 variant). This plan is not buildable from the kit.`,
    );
    return { status: 'not-buildable', reasons };
  }

  const offModule = (input.wallLengthsFt ?? []).filter(
    (len) => Math.abs(len - Math.round(len / SKYLARK_MODULE_FT) * SKYLARK_MODULE_FT) > MODULE_TOLERANCE_FT,
  );
  if (offModule.length) {
    reasons.push(
      `${offModule.length} wall(s) are not a multiple of the ${SKYLARK_SHEET_MM.width} mm sheet module.`,
    );
  }

  if (!SKYLARK_ROOF_PITCHES_DEG.length) {
    reasons.push(
      `Roof pitch ${input.roofPitchDeg.toFixed(1)}° cannot be matched to a Skylark block: the published `
      + `pitch angles are not in the CNC files and have not been sourced from the WikiHouse block database. `
      + `Not claiming kit-buildable without them.`,
    );
    return { status: 'unverified', reasons };
  }

  const pitchMatch = SKYLARK_ROOF_PITCHES_DEG.some((p) => Math.abs(p - input.roofPitchDeg) <= 0.5);
  if (!pitchMatch) {
    reasons.push(
      `Roof pitch ${input.roofPitchDeg.toFixed(1)}° is not one of the Skylark pitches `
      + `(${SKYLARK_ROOF_PITCHES_DEG.join('°, ')}°). The kit is discrete; this plan's pitch is derived.`,
    );
    return { status: 'not-buildable', reasons };
  }

  if (offModule.length) return { status: 'not-buildable', reasons };
  reasons.push('Roof pitch and wall modules match Skylark 150 blocks.');
  return { status: 'buildable', reasons };
}
