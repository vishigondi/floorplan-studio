/**
 * How the kit gets stood up, and what that rules out.
 *
 * The build method is a compact telehandler plus a mini excavator with a
 * hydraulic torque head — no crane. That is a cost decision, and it is the
 * reason panel size has a ceiling at all. But the constraint that actually
 * bites is not the one you would expect: a SIP is light. The binding
 * constraint is REACH, and it is a property of the roof, not the panel.
 */

/** A 4.5 in 4x8 EPS SIP weighs about 100 lb, so 32 sq ft -> ~3.1 psf.
 * Thicker cores add foam, not skins, and foam is light: the OSB dominates.
 * Source: Thermapan, published panel weight. */
export const SIP_AREAL_WEIGHT_PSF = 3.125;
/** Thicker panels, and roof panels carrying a heavier skin schedule, run above
 * the published 4.5 in figure. Planning weight, not a quoted weight. */
export const SIP_AREAL_WEIGHT_PSF_MAX = 4.5;

export function panelWeightLb(areaSqFt: number, psf = SIP_AREAL_WEIGHT_PSF_MAX): number {
  return Math.round(areaSqFt * psf);
}

/**
 * You cannot land a panel on a seat you can only just touch. The boom has to
 * carry the panel clear of its bearing before it comes down onto it. Two feet
 * is a planning allowance, not a published figure — which is why the machine
 * table below reports BOTH the strict reach and the reach with this allowance,
 * so a decision never rests on the allowance alone.
 */
export const LANDING_CLEARANCE_FT = 2;

export interface LiftMachine {
  id: string;
  name: string;
  /** Published maximum lift height, ft. */
  maxLiftFt: number;
  /** Published rated capacity, lb — at minimum reach. Derates with height. */
  ratedCapacityLb: number;
  /** Overall width over tyres, ft. The site path is 8 ft. */
  widthFt: number;
  source: string;
}

/** The machines under consideration. They do not belong to one class. */
export const LIFT_MACHINES: LiftMachine[] = [
  {
    id: 'jcb-515-40',
    name: 'JCB 515-40',
    maxLiftFt: 13.17, // 13 ft 2 in / 4.0 m
    ratedCapacityLb: 3300, // 1500 kg
    widthFt: 5.17, // 5 ft 2 in / 1.56 m
    source: 'JCB published spec (3,300 lb, 13 ft 2 in, 1.56 m over tyres)',
  },
  {
    id: 'jlg-g5-18a',
    name: 'JLG G5-18A',
    maxLiftFt: 18.33, // 18 ft 4 in
    ratedCapacityLb: 5500,
    widthFt: 5.96, // 71.5 in
    source: 'JLG published spec (5,500 lb, 18 ft 4 in, 71.5 in; 4,400 lb at max height)',
  },
  {
    id: 'merlo-p27-6',
    name: 'Merlo P27.6',
    maxLiftFt: 19.33, // 19 ft 4 in
    ratedCapacityLb: 6000, // 2.7 t
    widthFt: 6.1, // 1.86 m transport width
    source: 'Merlo published spec (6,000 lb, 19 ft 4 in, 1.86 m transport width; 1 t at full forward reach)',
  },
];

/** The rugged approach path the machine has to fit down. */
export const SITE_ACCESS_WIDTH_FT = 8;

/**
 * Every capacity above is a badge number: measured at minimum reach, on level
 * ground, in still air. Two site facts invalidate it, and mountain ground has
 * both.
 *
 * A load chart is valid only within about 3 degrees of horizontal. Past roughly
 * 5 degrees of side slope the centre of gravity shifts downhill and at least a
 * 20% derate applies. Source: published telehandler load-chart guidance.
 *
 * The consequence is not the one you would expect. Our panels are so light
 * relative to these machines that even a heavy derate leaves enormous margin —
 * capacity still does not bind. What the slope actually dictates is that the
 * ground the machine STANDS on has to be benched to within chart validity. That
 * is a site-work line item that follows from the machine choice, and it is
 * invisible if you only ever compare panel weight against a badge capacity.
 */
export const SLOPE_CHART_VALID_DEG = 3;
export const SLOPE_DERATE_TRIGGER_DEG = 5;
export const SLOPE_DERATE_MIN_PCT = 20;

export const gradePctToDeg = (pct: number) => (Math.atan(pct / 100) * 180) / Math.PI;

/** Badge capacity reduced for the ground it is actually standing on. */
export function capacityOnGrade(ratedLb: number, gradePct?: number): number {
  if (gradePct === undefined) return ratedLb;
  if (gradePctToDeg(gradePct) <= SLOPE_DERATE_TRIGGER_DEG) return ratedLb;
  return Math.round(ratedLb * (1 - SLOPE_DERATE_MIN_PCT / 100));
}

/**
 * The height that goes on the FAA obstruction-evaluation form.
 *
 * The form asks for the maximum height INCLUDING CONSTRUCTION EQUIPMENT, which
 * makes the machine choice a filing decision and not only a cost one. A
 * telehandler that reaches 19 ft and a crane that reaches 100 ft produce two
 * very different declarations from the same building, and on high ground the
 * difference decides whether the declared object stays beneath an existing
 * catalogued obstruction or rises above it.
 *
 * The number is the taller of the finished structure and the machine that sets
 * it — not their sum, because the boom is above the roof while it is working
 * and the roof is there afterwards.
 */
export interface DeclaredEnvelope {
  structureFt: number;
  machineFt: number;
  /** The greater of the two: what a filing must declare, before margin. */
  maxHeightFt: number;
  /** Which one governs, because it is the one to argue about if it is too tall. */
  governedBy: 'structure' | 'equipment';
  /** Declared figure with margin, so one filing can cover a range of plans. */
  declareFt: number;
}

/**
 * A determination is valid 18 months and costs only time, so it is worth
 * declaring a height you will not have to come back and revise. Filing at the
 * exact computed figure means any later plan with a taller ridge reopens it.
 */
export const ENVELOPE_MARGIN_FT = 5;

export function declaredEnvelope(
  structureFt: number,
  machine: LiftMachine,
  marginFt = ENVELOPE_MARGIN_FT,
): DeclaredEnvelope {
  const machineFt = machine.maxLiftFt;
  const maxHeightFt = Math.max(structureFt, machineFt);
  return {
    structureFt,
    machineFt,
    maxHeightFt,
    governedBy: structureFt > machineFt ? 'structure' : 'equipment',
    declareFt: Math.ceil(maxHeightFt + marginFt),
  };
}

export interface ErectionRequirement {
  /** Site grade the assessment was made against, if one was supplied. */
  siteGradePct?: number;
  /** What a Form 7460-1 would declare for this plan on the best machine. */
  envelope?: DeclaredEnvelope;
  /** The height a panel has to be carried to: the ridge. */
  ridgeFt: number;
  /** Ridge plus the allowance to land it. */
  requiredLiftFt: number;
  heaviestPanelLb: number;
  /** Machines that clear requiredLiftFt, fit the path, and can carry the panel. */
  capable: LiftMachine[];
  /** Machines that reach the ridge itself but have no room to land onto it. */
  marginal: LiftMachine[];
  notes: string[];
}

export function assessErection(
  ridgeFt: number,
  heaviestPanelAreaSqFt: number,
  machines: LiftMachine[] = LIFT_MACHINES,
  /** Average ground slope, percent. Omit only when the site is genuinely level. */
  siteGradePct?: number,
): ErectionRequirement {
  const heaviestPanelLb = panelWeightLb(heaviestPanelAreaSqFt);
  const requiredLiftFt = Math.round((ridgeFt + LANDING_CLEARANCE_FT) * 100) / 100;
  const fits = (m: LiftMachine) => m.widthFt <= SITE_ACCESS_WIDTH_FT;
  // Compare against the DERATED capacity, never the badge, whenever a grade is
  // known. Using the badge on sloping ground is the quiet version of this bug.
  const carries = (m: LiftMachine) => capacityOnGrade(m.ratedCapacityLb, siteGradePct) >= heaviestPanelLb;
  const capable = machines.filter((m) => fits(m) && carries(m) && m.maxLiftFt >= requiredLiftFt);
  const marginal = machines.filter((m) => fits(m) && carries(m)
    && m.maxLiftFt >= ridgeFt && m.maxLiftFt < requiredLiftFt);
  const notes: string[] = [];

  const tooNarrow = machines.filter((m) => !fits(m));
  if (tooNarrow.length) {
    notes.push(`${tooNarrow.map((m) => m.name).join(', ')} will not fit the `
      + `${SITE_ACCESS_WIDTH_FT} ft approach path.`);
  }
  // Worth stating plainly, because it is the opposite of the intuition that
  // sizes panels around what a machine can carry.
  const lightest = machines.filter(carries).length;
  if (lightest === machines.length) {
    const derated = machines.map((m) => capacityOnGrade(m.ratedCapacityLb, siteGradePct));
    notes.push(`Capacity is not the constraint: the heaviest panel is ~${heaviestPanelLb} lb `
      + `against ${siteGradePct === undefined ? 'ratings' : 'grade-derated capacities'} of `
      + `${Math.min(...derated)}-${Math.max(...derated)} lb. Reach is the constraint.`);
  }
  if (siteGradePct !== undefined) {
    const deg = gradePctToDeg(siteGradePct);
    if (deg > SLOPE_CHART_VALID_DEG) {
      notes.push(`SITE GRADE ${siteGradePct}% is ${deg.toFixed(1)} deg, beyond the `
        + `${SLOPE_CHART_VALID_DEG} deg within which a load chart is valid`
        + (deg > SLOPE_DERATE_TRIGGER_DEG
          ? ` and past the ${SLOPE_DERATE_TRIGGER_DEG} deg side-slope threshold, so at least `
            + `${SLOPE_DERATE_MIN_PCT}% has been taken off every capacity above. `
          : '. ')
        + 'BENCH THE SETTING PADS to within chart validity. This is a site-work item that '
        + 'follows from the machine choice, and it is invisible if panel weight is only ever '
        + 'compared against a badge capacity.');
    }
  }
  const short = machines.filter((m) => fits(m) && m.maxLiftFt < ridgeFt);
  if (short.length) {
    notes.push(`${short.map((m) => m.name).join(', ')} cannot reach the ${ridgeFt} ft ridge at all `
      + '(not a clearance question — the boom is short of the seat).');
  }
  if (marginal.length) {
    notes.push(`${marginal.map((m) => m.name).join(', ')} reach ${ridgeFt} ft but leave under `
      + `${LANDING_CLEARANCE_FT} ft to land the panel onto its bearing.`);
  }
  if (!capable.length) {
    notes.push('NO machine in the set can erect this roof crane-free. Either lower the ridge, '
      + 'set the ridge panels from staging, or accept a crane and the cost that comes with it.');
  }
  // Declared against the machine that will actually do it. Reporting an
  // envelope for a machine that cannot set the roof would understate the filing.
  const chosen = capable[0] ?? marginal[0];
  const envelope = chosen ? declaredEnvelope(ridgeFt, chosen) : undefined;
  if (envelope) {
    notes.push(`FAA DECLARATION: this plan's maximum height including construction equipment is `
      + `${envelope.maxHeightFt} ft, governed by the ${envelope.governedBy}. File `
      + `${envelope.declareFt} ft to leave margin — a determination is valid 18 months, and one `
      + 'filed for a development envelope covers what follows, whereas one filed at the exact '
      + 'computed height is reopened by the next plan with a taller ridge.');
  }
  return {
    ridgeFt, requiredLiftFt, heaviestPanelLb, capable, marginal, notes, siteGradePct, envelope,
  };
}
