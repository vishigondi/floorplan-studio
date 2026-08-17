/**
 * Roof pitch — ONE definition, shared by everything that asks the question.
 *
 * The relationship between ridge height, eave height and pitch was written out
 * by hand in four places (the build validator, the compiler, the buildability
 * battery, and the inverse in the kit-gable ridge). They had drifted: some
 * clamped a negative rise and some did not, and every one of them divided the
 * span in half — which is right for a ridged roof and WRONG for a shed, whose
 * single plane rises across the WHOLE span. A 28 ft shed going 8 ft to 12 ft was
 * reported at 15.9° when it is really 8.1°.
 *
 * That is the P7 failure this file exists to prevent: shared math lives once, so
 * the compiler, the validator and the gates cannot disagree about the same roof.
 */

export interface RoofLike {
  style: string;
  ridgeAxis: 'x' | 'z';
  ridgeHeightFt: number;
  eaveHeightFt: number;
}

export interface FootprintLike {
  widthFt: number;
  depthFt: number;
}

/**
 * The horizontal distance the roof rises over, in feet.
 *
 * The slope always crosses the axis PERPENDICULAR to the ridge. A ridged roof
 * (gable, a-frame, hip, gambrel, barn) climbs from the eave to a ridge at the
 * centre, so it rises over half that span; a mono-pitch shed has no centre ridge
 * and rises over all of it.
 */
export function roofRunFt(roof: RoofLike, footprint: FootprintLike): number {
  const across = roof.ridgeAxis === 'x' ? footprint.depthFt : footprint.widthFt;
  return Math.max(0.1, roof.style === 'shed' ? across : across / 2);
}

/** Roof pitch in degrees. Flat is 0 by definition, not by arithmetic. */
export function roofPitchDeg(roof: RoofLike, footprint: FootprintLike): number {
  if (roof.style === 'flat') return 0;
  const rise = Math.max(0, roof.ridgeHeightFt - roof.eaveHeightFt);
  return (Math.atan(rise / roofRunFt(roof, footprint)) * 180) / Math.PI;
}

/**
 * The inverse: the ridge height that gives this footprint exactly `pitchDeg`.
 * Used to build a roof ON a discrete manufactured pitch instead of picking a
 * ridge height and reporting whatever angle falls out.
 */
export function ridgeHeightForPitchFt(roof: RoofLike, footprint: FootprintLike, pitchDeg: number): number {
  return roof.eaveHeightFt + Math.tan((pitchDeg * Math.PI) / 180) * roofRunFt(roof, footprint);
}
