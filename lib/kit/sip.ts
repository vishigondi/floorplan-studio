// THE KIT: structural insulated panels.
//
// Replaces lib/kit/skylark.ts. WikiHouse Skylark is no longer the system this
// generator targets, and the code had drifted off it long before the decision
// was made: Skylark ships roof blocks at 0 and 42 degrees only, while the
// generator produces 15.9, 23.2, 29.7 and 50.5 — six of seven roof styles could
// not be built from the library the bill of materials named. The bill was
// counting generic 4 ft modules and calling them Skylark blocks; it never named
// a real one (no G-M-3, no C-L-1). Removing Skylark deletes a claim we were not
// meeting rather than a capability we were using.
//
// SIPs fit what the generator already produces: there is no pitch restriction,
// so every roof style is manufacturable.
//
// THIS FILE IS THE SINGLE HOME FOR PANEL FACTS. Core R-values, product ladders
// and panel sizes were previously spread across sourcing.ts and panel-spec.ts,
// with CORE_R_PER_INCH defined twice. Anything about what a panel IS belongs
// here; sourcing.ts decides who can bid, panel-spec.ts decides what the tender
// document says, and neither keeps its own copy.
//
// PROVENANCE. Every number below is published by a manufacturer and marked. The
// two limits that gate geometry — module width and span — are DERIVED from
// verified panel sizes rather than asserted, because a limit is only as good as
// the smallest supplier who has to meet it.

/**
 * Published assembly R-values per thickness, per core.
 *
 * Not a rate. R per inch is not constant — the facings contribute a fixed
 * amount, so effective R/in climbs across the range — and modelling it as one
 * over-stated every EPS thickness by 2.6 to 3.4, which pushed every roof answer
 * a full step too thin.
 *
 * EPS: Insulspan MasterFormat Section 06 12 00, thermal resistance at 75F mean,
 * OSB surface spline or insulated block spline. VERIFIED at source 2026-08-29.
 *
 * Polyurethane: eco-panels product information, VERIFIED, but published as
 * RANGES (4.5 in is "R-26 to 31.5"). The conservative end is carried: a
 * compliance decision taken on the optimistic end of a marketing range is not a
 * compliance decision.
 */
export const CORE_R_BY_THICKNESS: Readonly<Record<string, Readonly<Record<number, number>>>> = {
  eps: { 4.5: 15.0, 6.5: 22.6, 8.25: 29.2, 10.25: 36.8, 12.25: 44.4 },
  polyurethane: { 3: 21, 4.5: 26, 6.5: 40, 8.125: 60 },
};

/** Thicknesses each core is manufactured in. A thickness outside a core's
 * ladder is not a thin panel, it is a panel that does not exist. */
export const CORE_THICKNESS_LADDER: Readonly<Record<string, readonly number[]>> = {
  eps: [4.5, 6.5, 8.25, 10.25, 12.25],
  polyurethane: [3, 4.5, 6.5, 8.125],
};

/** Largest panel each core is made in, as width x length in feet.
 * eco-panels: 4 x 16 (standard wall 4 x 8). Insulspan: 8 x 24 "jumbo", verified
 * from their MasterFormat spec as 2440 x 7320 mm. */
export const CORE_MAX_PANEL_FT: Readonly<Record<string, { widthFt: number; lengthFt: number }>> = {
  eps: { widthFt: 8, lengthFt: 24 },
  polyurethane: { widthFt: 4, lengthFt: 16 },
};

/** Nominal rate, for rough reasoning ONLY. Never used for compliance — every
 * qualification test goes through publishedR(). Kept because it is useful for
 * sanity-checking an unfamiliar thickness, and clearly labelled so it cannot
 * drift back into a decision. */
export const CORE_R_PER_INCH: Readonly<Record<string, number>> = {
  eps: 3.9,
  polyurethane: 7.0,
};

/** The R a core actually delivers at a thickness, or undefined where it is not
 * manufactured. No interpolation: a thickness nobody publishes is a thickness
 * nobody sells. */
export function publishedR(core: string, thicknessIn: number): number | undefined {
  return CORE_R_BY_THICKNESS[core]?.[thicknessIn];
}

/** Cores that can reach a target within their manufactured range. */
export function coresMeeting(minR: number, thicknessIn: number): string[] {
  return Object.keys(CORE_R_BY_THICKNESS)
    .filter((core) => (publishedR(core, thicknessIn) ?? -1) >= minR);
}

// --- Geometry limits, derived from the panel sizes above --------------------
//
// Both are set by the SMALLEST supplier who has to meet them, because a limit
// sized to the largest is a limit only one bidder can satisfy — which is the
// lock-in this project exists to avoid.

/** Structural module. The widest panel BOTH cores are made in is 4 ft, so a
 * 4 ft grid keeps every supplier able to quote. Designing to Insulspan's 8 ft
 * would silently exclude the polyurethane supplier and the cam-latch install
 * advantage with them.
 *
 * This is unchanged from the Skylark era, where 4 ft came from a 1220 mm sheet.
 * The number survives the kit change; only its justification is different. */
export const PANEL_MODULE_FT = 4;

/**
 * Longest a panel may span between bearing lines, keeping both cores in play.
 *
 * A panel cannot span further than it is long. eco-panels top out at 16 ft,
 * Insulspan at 24 ft, so 16 ft is the limit that leaves two bidders and 24 ft
 * is EPS-only. SIP literature quotes spans "up to 24 feet with structural
 * splines", which is the single-supplier figure.
 *
 * Note this is TIGHTER than the 18.83 ft Skylark F-L block allowed. Removing
 * WikiHouse does not relax the floor span, it constrains it — and generated
 * plans already sit at exactly 16.0 ft, so nothing has to move.
 */
export const MAX_PANEL_SPAN_FT = Math.min(
  ...Object.values(CORE_MAX_PANEL_FT).map((p) => p.lengthFt),
);

/** Span available if the tender is opened to EPS alone. Recorded so the cost of
 * insisting on two bidders is visible rather than assumed. */
export const MAX_PANEL_SPAN_SINGLE_SOURCE_FT = Math.max(
  ...Object.values(CORE_MAX_PANEL_FT).map((p) => p.lengthFt),
);

/**
 * Wall heights a SIP is stocked in. eco-panels' standard wall panel is 4 x 8;
 * both cores reach 16 ft, and EPS reaches 24 ft.
 *
 * Replaces the Skylark wall SKUs (2.4 m and 3.0 m), which were sheet-derived
 * metric heights with no meaning for a SIP.
 */
export const WALL_PANEL_HEIGHTS_FT: readonly number[] = [8, 9, 10, 12, 16];

/**
 * SIPs impose NO roof pitch restriction, which is the substantive difference
 * from the kit this replaces.
 *
 * Skylark shipped blocks at 0 and 42 degrees only, so a 23 degree gable was
 * unbuildable — and the generator produced 23 degree gables. That constraint is
 * gone, and with it the roof-pitch gate: there is no pitch to check against
 * because any pitch can be panelised.
 */
export const PITCH_IS_UNRESTRICTED = true;
