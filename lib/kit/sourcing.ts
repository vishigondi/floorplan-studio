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

/** Published R per inch. EPS from Mighty Small Homes' supplier disclosure;
 * polyurethane from eco-panels' product information. Retrieved 2026-08-28. */
export const CORE_R_PER_INCH: Readonly<Record<string, number>> = {
  eps: 3.9,
  polyurethane: 7.0,
};

/** Thicknesses the industry actually stocks. A target met only at a
 * non-standard thickness is a custom order, which is its own lock-in. */
export const STANDARD_THICKNESS_IN: readonly number[] = [3, 4.5, 6.5, 8.25, 10.25, 12.25];

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
    const bidders = Object.entries(CORE_R_PER_INCH)
      .filter(([, rPerIn]) => rPerIn * thicknessIn >= minR)
      .map(([core]) => core);
    const overshootR = Object.fromEntries(
      bidders.map((core) => [core, Math.round((CORE_R_PER_INCH[core] * thicknessIn - minR) * 10) / 10]),
    );
    return { thicknessIn, bidders, overshootR, singleSource: bidders.length === 1 };
  });
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
