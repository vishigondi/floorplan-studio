import {
  CORE_R_BY_THICKNESS, CORE_THICKNESS_LADDER, CORE_R_PER_INCH, publishedR,
} from './sip.ts';

// SOURCING ANALYSIS — choosing a specification that keeps suppliers competing.
//
// The panel spec says what to build. This says how to write it so more than one
// manufacturer can bid, and how to compare the bids that come back on TOTAL
// DELIVERED COST rather than panel price.
//
// THE PROBLEM THIS SOLVES, concretely. A 6.5 in roof panel comfortably clears a
// R-38 ceiling target, and it is what a polyurethane maker would naturally
// propose. It also has exactly ONE bidder: at R-7/in polyurethane reaches R-46
// there, while EPS at R-3.9/in reaches only R-25 and cannot comply. Write 6.5 in
// on the drawing and the competitive tender is over before it starts — not
// through any bad faith, just arithmetic. The wall has no such trap at R-15
// (4.5 in admits both cores), so the risk is concentrated in the roof, which is
// exactly where nobody thinks to look.
//
// SPECIFY THE OUTCOME, SCORE THE MECHANISM. Connection systems are the live
// case. One manufacturer joins panels with cam latches rather than timber
// splines, which plausibly means a smaller crew and no thermal bridge through
// the joint. Both are real advantages — and writing "cam latch" into the
// specification hands them the job by definition. So connection method is never
// specified. It is scored, through the install-labour term below: if the faster
// system is worth its price it wins the comparison on merit, and if a plant
// ninety miles away beats it on freight, that wins instead.
//
// NO PRICES ARE HELD HERE. Every money figure is one the user supplies, for the
// same reason the kit schedule refuses to estimate: we have no supplier pricing,
// and a generated number would be fabricated. What this module contributes is
// the STRUCTURE of the comparison — which terms belong in it, and which
// specification choices quietly delete a bidder.

// Panel facts live in ./sip.ts. This module decides WHO CAN BID; it does not
// keep its own copy of what a panel is. CORE_R_PER_INCH used to be defined here
// and again in panel-spec.ts — two copies of a number that must never disagree.
export {
  CORE_R_BY_THICKNESS, CORE_THICKNESS_LADDER, CORE_R_PER_INCH,
  CORE_MAX_PANEL_FT, publishedR, coresMeeting,
} from './sip.ts';

/** Every thickness any core is made in, ascending — derived from the ladders
 * rather than restated, so a ladder change cannot leave this list stale. */
export const STANDARD_THICKNESS_IN: readonly number[] = [
  ...new Set(Object.values(CORE_THICKNESS_LADDER).flat()),
].sort((a, b) => a - b);

export interface ThicknessChoice {
  thicknessIn: number;
  /** Cores that can reach the target at this thickness — i.e. who may bid. */
  bidders: string[];
  /** How far each qualifying core overshoots, in R. Overshoot is material a
   * buyer pays for and does not need; it is the price of interchangeability. */
  overshootR: Record<string, number>;
  /** True when only one core qualifies: lock-in by arithmetic. */
  singleSource: boolean;
}

/** Every standard thickness scored against a target, thinnest first. */
export function thicknessOptions(minR: number): ThicknessChoice[] {
  return STANDARD_THICKNESS_IN.map((thicknessIn) => {
    // A core qualifies only if it BOTH reaches the R and is manufactured at
    // this thickness. Dropping the second test is what produced a roof
    // recommendation nobody could supply.
    // Published assembly value, and membership of the product ladder. Both, or
    // the answer describes a panel that is not for sale.
    const bidders = Object.keys(CORE_R_BY_THICKNESS)
      .filter((core) => (publishedR(core, thicknessIn) ?? -1) >= minR)
      .map((core) => core);
    const overshootR = Object.fromEntries(
      bidders.map((core) => [core, Math.round(((publishedR(core, thicknessIn) ?? 0) - minR) * 10) / 10]),
    );
    return { thicknessIn, bidders, overshootR, singleSource: bidders.length === 1 };
  });
}

/**
 * How much competition a target can support, which is NOT a yes/no.
 *
 * 'interchangeable' — two or more cores meet the target at the SAME standard
 *   thickness. Best case: bids are comparable and a supplier can be swapped
 *   without moving a dimension.
 * 'competitive' — two or more cores meet it, but each at their own thickness.
 *   You still get real bids; you cannot switch mid-element, because the two
 *   quotes describe walls of different depth.
 * 'single-source' — one core can meet it at all. The tender is decorative.
 *
 * The middle case is the one the earlier model could not express, and it is
 * where the roof actually lives.
 */
export type CompetitionMode = 'interchangeable' | 'competitive' | 'single-source' | 'unbuildable';

export interface CompetitionAssessment {
  mode: CompetitionMode;
  /** Cores that can meet the target somewhere in their range. */
  capableCores: string[];
  /** Thickness each capable core would use — differs in 'competitive'. */
  thicknessByCore: Record<string, number>;
  /** Present only when a single thickness serves two or more cores. */
  commonThicknessIn?: number;
  note: string;
}

/**
 * What competition is available for a target, given real product ladders.
 *
 * Written because `recommendThickness` answers "which single thickness do I
 * write down", and for the roof the honest answer is "don't write one" — say
 * the R and let each bidder reach it their own way. A function that can only
 * return a thickness cannot express that, and returning `undefined` reads as
 * failure when it is actually the correct specification.
 */
export function assessCompetition(minR: number): CompetitionAssessment {
  const thicknessByCore: Record<string, number> = {};
  for (const core of Object.keys(CORE_R_BY_THICKNESS)) {
    const fit = (CORE_THICKNESS_LADDER[core] ?? []).find((t) => (publishedR(core, t) ?? -1) >= minR);
    if (fit !== undefined) thicknessByCore[core] = fit;
  }
  const capableCores = Object.keys(thicknessByCore);
  const common = thicknessOptions(minR).find((o) => o.bidders.length >= 2);

  if (capableCores.length === 0) {
    return {
      mode: 'unbuildable',
      capableCores,
      thicknessByCore,
      note: `No core reaches R-${minR} within any manufactured thickness. The target needs a `
        + 'different assembly — added continuous insulation, or a different system entirely.',
    };
  }
  if (capableCores.length === 1) {
    return {
      mode: 'single-source',
      capableCores,
      thicknessByCore,
      note: `Only ${capableCores[0]} reaches R-${minR} within a manufactured thickness, so this `
        + 'target has one bidder however it is written. Lower the target, accept a thicker '
        + 'assembly, or accept the single source knowingly.',
    };
  }
  if (common) {
    return {
      mode: 'interchangeable',
      capableCores,
      thicknessByCore,
      commonThicknessIn: common.thicknessIn,
      note: `R-${minR} is met by ${common.bidders.join(' and ')} at a common ${common.thicknessIn} in, `
        + 'so bids are comparable AND a supplier can be changed without moving a dimension.',
    };
  }
  return {
    mode: 'competitive',
    capableCores,
    thicknessByCore,
    note: `R-${minR} is reachable by ${capableCores.join(' and ')}, but at different thicknesses `
      + `(${Object.entries(thicknessByCore).map(([c, t]) => `${c} ${t} in`).join(', ')}). `
      + 'Specify the R and let each bidder reach it their own way: the quotes are genuinely '
      + 'competitive, but they describe assemblies of different depth, so a supplier cannot be '
      + 'swapped part-way through this element. Tender it per build, not mid-build.',
  };
}

export interface ThicknessRecommendation {
  /** Thinnest thickness that keeps at least two cores in the running. */
  recommended?: ThicknessChoice;
  /** Thinnest that meets the target at all, competitive or not. */
  thinnestCompliant?: ThicknessChoice;
  /** Thicknesses that comply but leave a single bidder — the ones to refuse. */
  lockInTraps: ThicknessChoice[];
  /** What choosing `recommended` over `thinnestCompliant` costs, in inches. */
  interchangeabilityCostIn: number;
  note: string;
}

/**
 * The thinnest thickness that preserves competition, and what it costs.
 *
 * Thinnest-compliant is the cheapest panel. Thinnest-with-two-bidders is the
 * cheapest panel you can still re-tender. Where they differ, the gap is the
 * premium paid for not being locked in, stated in inches so it can be priced
 * rather than argued about.
 */
export function recommendThickness(minR: number): ThicknessRecommendation {
  const options = thicknessOptions(minR);
  const compliant = options.filter((o) => o.bidders.length > 0);
  const competitive = options.filter((o) => o.bidders.length >= 2);
  const recommended = competitive[0];
  const thinnestCompliant = compliant[0];
  const lockInTraps = compliant.filter((o) => o.singleSource);
  const interchangeabilityCostIn = recommended && thinnestCompliant
    ? Math.round((recommended.thicknessIn - thinnestCompliant.thicknessIn) * 100) / 100
    : 0;

  const note = !recommended
    ? `No standard thickness admits two cores at R-${minR}; this target is single-source or custom by construction.`
    : interchangeabilityCostIn === 0
      ? `R-${minR} is met at ${recommended.thicknessIn} in by every qualifying core, so competition costs nothing here.`
      : `The thinnest compliant panel is ${thinnestCompliant!.thicknessIn} in with only `
        + `${thinnestCompliant!.bidders.join(' and ')} able to supply it. Holding ${recommended.thicknessIn} in `
        + `keeps ${recommended.bidders.length} cores bidding, at the cost of ${interchangeabilityCostIn} in of `
        + 'extra panel. That is the price of being able to re-tender, and it should be weighed against the '
        + 'quotes rather than assumed either way.';

  return { recommended, thinnestCompliant, lockInTraps, interchangeabilityCostIn, note };
}

/**
 * A panel plant that could bid. Locations are as researched, NOT verified at
 * source, and no distances are recorded because none were measured — a mileage
 * invented here would propagate straight into a freight number and look precise.
 * Distance is the caller's input.
 */
export interface SupplierRef {
  name: string;
  /** Where the plant is, as published. */
  location: string;
  core: keyof typeof CORE_R_PER_INCH | 'unknown';
  /** Panel-to-panel joint, which drives install labour. NEVER specified — scored. */
  connection: string;
  provenance: 'verified' | 'search-summary';
}

/** Plants within plausible freight range of western North Carolina.
 * Everything marked search-summary needs confirming before it informs a tender. */
export const REGIONAL_SUPPLIERS: readonly SupplierRef[] = [
  { name: 'Insulspan', location: 'Asheville, NC (regional sales/manufacturing)', core: 'eps', connection: 'splines (2x lumber, OSB, LVL, or proprietary)', provenance: 'search-summary' },
  { name: 'Energy Panel Structures', location: 'Asheville, NC (regional)', core: 'eps', connection: 'spline', provenance: 'search-summary' },
  { name: 'Eco-Panels', location: 'Mocksville, NC (mfg); founded Asheville, NC', core: 'polyurethane', connection: 'cam latch — no spline, no timber thermal bridge', provenance: 'verified' },
  { name: 'Porter SIPs', location: 'Augusta, GA / Memphis, TN / Greenville, NC', core: 'eps', connection: 'spline', provenance: 'search-summary' },
  { name: 'ACME Panel', location: 'I-81 corridor, VA', core: 'eps', connection: 'spline', provenance: 'search-summary' },
  { name: 'FischerSIPs', location: 'Louisville, KY — ships nationally', core: 'eps', connection: 'spline', provenance: 'search-summary' },
];

export interface BidInput {
  supplier: string;
  /** User-supplied, from an actual quote. */
  panelCost: number;
  /** User-supplied: freight for this plant to this site. */
  freightCost: number;
  /** User-supplied: crew hours to install, and the rate. Connection method
   * shows up HERE rather than in the specification — a faster joint earns its
   * premium by lowering this number, not by being named on the drawing. */
  installHours: number;
  hourlyRate: number;
  currency?: string;
}

export interface BidComparison {
  supplier: string;
  panelCost: number;
  freightCost: number;
  installCost: number;
  totalDelivered: number;
  currency: string;
}

/**
 * Rank bids on TOTAL DELIVERED COST — panels plus freight plus install labour.
 *
 * Ranking on panel price alone is how a distant plant with a slow joint wins on
 * paper and loses on site. All three terms come from the user; this only decides
 * what gets added together and in what order the answers land.
 */
export function compareBids(bids: BidInput[]): BidComparison[] {
  return bids
    .map((bid) => {
      const installCost = Math.round(bid.installHours * bid.hourlyRate * 100) / 100;
      return {
        supplier: bid.supplier,
        panelCost: bid.panelCost,
        freightCost: bid.freightCost,
        installCost,
        totalDelivered: Math.round((bid.panelCost + bid.freightCost + installCost) * 100) / 100,
        currency: bid.currency ?? 'USD',
      };
    })
    .sort((a, b) => a.totalDelivered - b.totalDelivered);
}

// ---------------------------------------------------------------------------
// BID PACKAGES — the actual deliverable.
//
// The goal is two compliant bids to compare on price. Not the thinnest possible
// panel, not dimensional interchangeability: both bidders quote whatever they
// make that MEETS the target, overbuild is expected and fine, and the prices
// decide it.
//
// That makes most of the optimisation above informational rather than
// governing. It is kept because knowing WHY a bid is thick is useful when the
// quotes come back — an EPS ceiling at 12.25 in is 6.4 R over target because
// that is their first compliant step, not because anyone gold-plated it — but
// nothing here should be read as a reason to reject a compliant bid.
//
// The one thing that must be right is the target itself. Everything downstream
// tolerates overbuild; nothing tolerates a wrong R.

export interface ElementTarget {
  /** 'Wall', 'Ceiling', etc. */
  element: string;
  minR: number;
  /** Which code provision this target comes from. Travels with the bid. */
  basis: string;
}

export interface BidLine {
  core: string;
  /** Thinnest thickness this core is MADE in that meets the target. */
  thicknessIn: number;
  publishedR: number;
  /** How far over target. Expected, not a fault. */
  overbuildR: number;
}

export interface ElementBidPackage {
  element: string;
  minR: number;
  basis: string;
  lines: BidLine[];
  /** False when some core has no compliant product — the only real blocker. */
  everyCoreCanBid: boolean;
  note: string;
}

/**
 * For each element, what each core would quote.
 *
 * Two or more lines means two or more comparable, compliant bids — which is the
 * whole requirement. A core with no compliant product is the only outcome that
 * needs action, and it is named rather than silently dropped.
 */
export function bidPackages(targets: ElementTarget[]): ElementBidPackage[] {
  return targets.map(({ element, minR, basis }) => {
    const lines: BidLine[] = [];
    for (const core of Object.keys(CORE_R_BY_THICKNESS)) {
      const fit = (CORE_THICKNESS_LADDER[core] ?? []).find((t) => (publishedR(core, t) ?? -1) >= minR);
      if (fit === undefined) continue;
      const r = publishedR(core, fit)!;
      lines.push({
        core,
        thicknessIn: fit,
        publishedR: r,
        overbuildR: Math.round((r - minR) * 10) / 10,
      });
    }
    const everyCoreCanBid = lines.length === Object.keys(CORE_R_BY_THICKNESS).length;
    const tight = lines.filter((l) => l.overbuildR === 0);
    const note = !everyCoreCanBid
      ? `Only ${lines.map((l) => l.core).join(' and ')} has a compliant product at R-${minR}; `
        + 'the others cannot bid this element at all.'
      : tight.length
        ? `All cores can bid. ${tight.map((l) => l.core).join(' and ')} meets R-${minR} EXACTLY at `
          + `${tight.map((l) => l.thicknessIn).join('/')} in with no margin — compliant, but any `
          + 'rounding, derating or code revision puts it under. Worth knowing before it is the '
          + 'cheapest quote.'
        : `All cores can bid, with ${lines.map((l) => `${l.core} +${l.overbuildR}`).join(', ')} over target. `
          + 'Overbuild differs by core because their product ladders differ; compare on price.';
    return { element, minR, basis, lines, everyCoreCanBid, note };
  });
}
