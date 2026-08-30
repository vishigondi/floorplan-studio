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

export interface ErectionRequirement {
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
): ErectionRequirement {
  const heaviestPanelLb = panelWeightLb(heaviestPanelAreaSqFt);
  const requiredLiftFt = Math.round((ridgeFt + LANDING_CLEARANCE_FT) * 100) / 100;
  const fits = (m: LiftMachine) => m.widthFt <= SITE_ACCESS_WIDTH_FT;
  const carries = (m: LiftMachine) => m.ratedCapacityLb >= heaviestPanelLb;
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
    notes.push(`Capacity is not the constraint: the heaviest panel is ~${heaviestPanelLb} lb `
      + `against ratings of ${Math.min(...machines.map((m) => m.ratedCapacityLb))}-`
      + `${Math.max(...machines.map((m) => m.ratedCapacityLb))} lb. Reach is the constraint.`);
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
  return { ridgeFt, requiredLiftFt, heaviestPanelLb, capable, marginal, notes };
}
