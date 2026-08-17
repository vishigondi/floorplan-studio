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
 * honestly — we never guess a manufacturing number.
 *
 * The roof PITCH ANGLES were the last unsourced value, and they are now
 * MEASURED: they are absent from the nested cut sheets (flat parts) but present
 * in the detailed 3DM assemblies, which scripts/measure-skylark-pitch.py reads
 * from a pinned commit. See SKYLARK_ROOF_BLOCKS for the per-block evidence.
 */

import { roofPitchDeg } from '../roof-geometry.ts';

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
 * Roof pitches Skylark 150 actually ships, in degrees — MEASURED, not guessed.
 *
 * The angles are not in the nested DXF cut sheets (those are flat parts) and the
 * repo states them nowhere, so this was blocked on real evidence: with the set
 * empty, no plan could claim kit-buildable. `scripts/measure-skylark-pitch.py`
 * reads the six detailed 3DM assemblies from a pinned WikiHouse commit and bins
 * every straight structural edge by angle, weighted by length. The result is
 * unambiguous — see SKYLARK_ROOF_BLOCKS below.
 *
 * Source: github.com/wikihouseproject/Skylark @ 6581cc1de0f4daef81a6b5c5a2eaed3c537d1d8f
 * (SKYLARK150/Roofs/*&#47;*_detailed/*.3dm), measured 2026-08-16. CC BY-SA 4.0 —
 * we vendor no WikiHouse files, only these measurements of them.
 */
export const SKYLARK_ROOF_PITCHES_DEG: readonly number[] = [0, 42];

/**
 * What each roof block measures. `pitchSharePct` is the share of in-plane edge
 * length lying at `pitchDeg` — the evidence that this is the block's pitch and
 * not an incidental angle. The plain blocks are flat roofs carrying a 1 deg
 * drainage fall (that fall is the second-largest angle bin in each of them);
 * every `-42` variant is 42.0 deg to the tenth of a degree.
 */
export const SKYLARK_ROOF_BLOCKS = [
  { block: 'R-L', pitchDeg: 0, pitchSharePct: 71.4, spanMm: 5839, riseMm: 560 },
  { block: 'R-S', pitchDeg: 0, pitchSharePct: 70.9, spanMm: 4639, riseMm: 534 },
  { block: 'R-XXS', pitchDeg: 0, pitchSharePct: 100.0, spanMm: 720, riseMm: 382 },
  { block: 'R-L-42', pitchDeg: 42, pitchSharePct: 85.6, spanMm: 3548, riseMm: 3558 },
  { block: 'R-S-42', pitchDeg: 42, pitchSharePct: 82.2, spanMm: 3034, riseMm: 2937 },
  { block: 'R-XXS-42', pitchDeg: 42, pitchSharePct: 83.3, spanMm: 2377, riseMm: 2278 },
] as const;

/**
 * Roof archetypes Skylark 150 has NO blocks for, at any pitch.
 *
 * `flat` was on this list and that was WRONG: R-L/R-S/R-XXS measure 0 deg with a
 * 1 deg fall, i.e. they ARE the flat-roof blocks. The kit ships two archetypes —
 * flat and a 42 deg pitched roof — and nothing else. A shed (mono-pitch), hip,
 * gambrel or barn roof cannot be assembled from these blocks at any angle.
 */
const UNSUPPORTED_ROOF_STYLES = ['shed', 'hip', 'gambrel', 'barn'] as const;

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
 * the MEASURED Skylark pitch set. If a future kit's pitches have not been
 * measured, the set is empty and nothing claims buildable.
 */
export function assessSkylarkKit(input: SkylarkKitInput): SkylarkKitAssessment {
  const reasons: string[] = [];

  if ((UNSUPPORTED_ROOF_STYLES as readonly string[]).includes(input.roofStyle)) {
    reasons.push(
      `Skylark 150 has no ${input.roofStyle} roof blocks — it ships two archetypes, a flat roof `
      + `(R-L/R-S/R-XXS) and a 42° pitched roof (the -42 variants). This plan is not buildable from the kit.`,
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

  // Kept for a future Skylark release whose pitches we have not measured yet:
  // an unmeasured kit must never silently read as buildable.
  if (!SKYLARK_ROOF_PITCHES_DEG.length) {
    reasons.push(
      `Roof pitch ${input.roofPitchDeg.toFixed(1)}° cannot be matched to a Skylark block: no pitch `
      + `angles have been measured for this kit. Not claiming kit-buildable without them.`,
    );
    return { status: 'unverified', reasons };
  }

  const pitchMatch = SKYLARK_ROOF_PITCHES_DEG.some((p) => Math.abs(p - input.roofPitchDeg) <= 0.5);
  if (!pitchMatch) {
    reasons.push(
      `Roof pitch ${input.roofPitchDeg.toFixed(1)}° is not one of the Skylark pitches `
      + `(${SKYLARK_ROOF_PITCHES_DEG.join('°, ')}°). The kit is discrete; this plan's pitch is derived. `
      + `A ${SKYLARK_ROOF_PITCHES_DEG[SKYLARK_ROOF_PITCHES_DEG.length - 1]}° roof would use stock blocks.`,
    );
    return { status: 'not-buildable', reasons };
  }

  if (offModule.length) return { status: 'not-buildable', reasons };
  reasons.push('Roof pitch and wall modules match Skylark 150 blocks.');
  return { status: 'buildable', reasons };
}

/** A compiled plan, in the shape this module needs to judge it. */
export interface KitPlanLike {
  roofStyle?: string;
  roof?: { style?: string; ridgeAxis?: 'x' | 'z'; ridgeHeightFt?: number; eaveHeightFt?: number };
  footprint?: { widthFt?: number; depthFt?: number };
  exteriorWalls?: Array<{ span?: { x1: number; z1: number; x2: number; z2: number } }>;
}

/**
 * Assess a compiled plan against the kit.
 *
 * One adapter, so the screen, the batteries and any export all ask the same
 * question of the same geometry — pitch included, which comes from the single
 * definition in roof-geometry rather than being recomputed per caller.
 */
export function assessSkylarkKitForPlan(plan: KitPlanLike): SkylarkKitAssessment {
  const roofStyle = plan.roof?.style ?? plan.roofStyle ?? 'gable';
  const widthFt = Number(plan.footprint?.widthFt ?? 0);
  const depthFt = Number(plan.footprint?.depthFt ?? 0);
  const pitch = roofPitchDeg(
    {
      style: roofStyle,
      ridgeAxis: plan.roof?.ridgeAxis ?? 'z',
      ridgeHeightFt: Number(plan.roof?.ridgeHeightFt ?? 0),
      eaveHeightFt: Number(plan.roof?.eaveHeightFt ?? 0),
    },
    { widthFt, depthFt },
  );
  const wallLengthsFt = (plan.exteriorWalls ?? [])
    .filter((wall) => wall.span)
    .map((wall) => Math.hypot(wall.span!.x2 - wall.span!.x1, wall.span!.z2 - wall.span!.z1));
  return assessSkylarkKit({ roofStyle, roofPitchDeg: pitch, wallLengthsFt });
}
