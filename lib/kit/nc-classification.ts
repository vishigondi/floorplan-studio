/**
 * NORTH CAROLINA — RECREATIONAL PARK TRAILERS (PARK MODELS) / PERMANENT DWELLINGS
 *
 * NC Department of Insurance, Office of State Fire Marshal, Manufactured Building
 * Division. Memorandum dated 15 January 2019, from the Chief Building Code
 * Consultant, replacing the 21 October 2015 memo. Addressed to building
 * inspectors and third-party inspection agencies — so this is what the person
 * signing off the site will be reading.
 *
 * It is the governing document for this project and it settles, in the state's
 * own words, several questions the rest of this kit had been arguing from tax
 * reasoning and manufacturer guidance. It also contradicts one of them.
 *
 * Source: ncosfm.gov/manufactured-homes/recreational-park-trailer-memo
 */

export const NC_MEMO = {
  issuer: 'NC Department of Insurance — Office of State Fire Marshal, Manufactured Building Division',
  dated: '2019-01-15',
  replaces: '2015-10-21 Recreational Park Trailer (Park Models) / Permanent Dwellings memo',
  audience: 'Building Inspectors / Third Party Inspection Agencies / other Interested Parties',
  source: 'ncosfm.gov/manufactured-homes/recreational-park-trailer-memo',
} as const;

/**
 * THE THREE SENTENCES THAT GOVERN THE SITE.
 *
 * Everything this kit has argued about composition, attachment and skirting now
 * has a state-level source. Two of the three are stricter than anything assumed
 * so far; the third is a straightforward prohibition that the deck design has
 * been quietly complying with already.
 */
export const TEMPORARY_INSTALLATION = {
  /**
   * The hardest constraint on the whole programme, and it is not about decks.
   * A rental cabin wants water, sewer and power. This says a unit that stays a
   * temporary structure cannot have any of them permanently.
   */
  noPermanentConnections:
    'Since these units are defined to be temporary structures, it is not permissible to set them up as '
    + 'permanent dwelling units. Therefore, it is our interpretation that they cannot have any permanent '
    + 'electrical, plumbing or mechanical connections.',
  /**
   * Settles the ÖÖD question outright, and goes further than Zook's site-prep
   * page: not merely attached, but ON THE UNIT AT ALL TIMES.
   */
  wheelsAndAxlesStayOn:
    'for safety reasons we will allow these units to be temporarily blocked up and anchored against '
    + 'overturning forces, but to remain classified as a temporary structure, the wheels and axles must '
    + 'remain on the unit at all times.',
  /**
   * The deck rule, from the state rather than from a tax memo. Every deck in
   * this kit is already free-standing; this is why that was never optional.
   */
  accessoryStructures: 'Accessory structures may not be supported by these units.',
} as const;

/**
 * THE WAY TO A PERMANENT DWELLING IS DUAL LABELLING, AND IT IS A MANUFACTURER
 * CAPABILITY — not a site decision, not a paperwork step, and not something a
 * builder can add afterwards.
 *
 * An RVIA-only label cannot be a permanent dwelling in NC. A unit built through
 * BOTH the RVIA programme and the NC Modular Construction Program (or HUD) can
 * be permanently installed, because it carries a second label. That question —
 * "do you dual label for North Carolina?" — belongs at the top of every
 * manufacturer conversation, before glazing, before price.
 */
export const PERMANENT_INSTALLATION = {
  rviaOnlyIsInsufficient:
    'A Recreational Park Trailer constructed in accordance with ANSI A119.5 ... and only labeled as a '
    + 'Recreational Park Trailer under the ... (RVIA) [program], cannot be accepted as a permanent '
    + 'dwelling structure in North Carolina.',
  theRoute:
    'sometimes manufacturers will dual label their Recreational Park Trailers by constructing them '
    + 'through the RVIA program and also through the NC Modular Construction Program or the HUD '
    + 'Manufactured Housing program, dual labeling the unit for each respective program.',
  labelsRequired: [
    'NC Modular Construction Validating Stamp — permanent install as a single-family modular dwelling',
    'HUD Manufactured Housing Label — permanent install as a single-family manufactured home',
  ],
  conditions:
    'Permitted only where the installation meets the NC Code foundation/anchoring requirements and the '
    + 'local zoning ordinances.',
} as const;

/**
 * AND THE ANSWER TO "CAN A LOCAL BUILDER MAKE THESE".
 *
 * Only an RVIA member can apply the label. A capable local shop that is not a
 * member cannot produce a unit that NC will accept as a permanent dwelling, at
 * any quality, at any price. Worse, over 400 sq ft it is not merely unlabelled
 * — it is a code violation on arrival.
 */
export const UNLABELLED_OR_SITE_BUILT = {
  whoCannot:
    'Some manufacturers are not members of the ... (RVIA) and are not authorized/able to certify and '
    + 'label their Recreational Park Trailers as being constructed in accordance with the ANSI A119.5 ...',
  consequence:
    'Unlabeled and/or site-constructed Recreational Park Trailers cannot be accepted as a permanent '
    + 'dwelling structure in North Carolina.',
  hardCeiling:
    'All unlabeled and/or site constructed recreational park trailers greater than 400 sq.ft. gross '
    + 'trailer area will be considered to be a non-complying single family dwelling in violation of the '
    + 'NC Residential Code.',
  soWhat:
    'RVIA membership is therefore a procurement filter, not a quality signal. "Find a local builder" '
    + 'means "find an RVIA member within trucking distance", and there is no substitute for the label.',
} as const;

/**
 * ⚠️ THIS CORRECTS A CLAIM MADE IN THIS KIT.
 *
 * The Skyview 400 record said a loft "is excluded from the ANSI living-area cap,
 * so it buys sleeping space for free". In North Carolina that is WRONG. NCDOI
 * counts a habitable loft — 5 ft or more of ceiling height — inside the gross
 * trailer area. Only sub-5 ft loft space is free.
 *
 * A loft marketed as a sleeping level is habitable by definition. So on any unit
 * whose loft you actually intend to sleep in, that area counts against the 400.
 */
export const GROSS_TRAILER_AREA = {
  definition: 'The total plan area measured to the maximum horizontal projections of exterior walls in the setup mode.',
  loftsCount:
    'Loft areas that are habitable room(s) (5 ft. or greater ceiling height) shall be included in the '
    + 'gross trailer areas. Accessible loft spaces with ceiling height less than 5 ft. are not included '
    + 'in the gross trailer area.',
  habitableLoftCeilingFt: 5,
  roofOverhangs: 'Per HUD, roof overhangs are not included in the calculation of the gross trailer area.',
  hudMinimumSqFt: 320,
  correctionNote:
    'Supersedes the "lofts are free" note previously carried against the Skyview 400. Ask any maker '
    + 'quoting a loft what its ceiling height is, and whether the quoted square footage already includes it.',
} as const;

/** Does a loft of this ceiling height count against the cap in NC? */
export function loftCountsTowardArea(ceilingHeightFt: number): boolean {
  return ceilingHeightFt >= GROSS_TRAILER_AREA.habitableLoftCeilingFt;
}

/** ANSI A119.5 park-model definition as NC restates it. Note the second limb. */
export const ANSI_DEFINITION = {
  capSqFt: 400,
  /** Under this area, a unit may exceed 8.5 ft in transport mode. */
  narrowLimbSqFt: 320,
  transportWidthFt: 8.5,
  restated:
    'A single living unit primarily designed and completed on a single chassis, mounted on wheels ... '
    + '(a) Has a gross trailer area not exceeding 400 square feet in the setup mode or (b) If having a '
    + 'gross trailer area not exceeding 320 square feet in the setup mode, has a width greater than '
    + '8.5 ft. in the transport mode.',
  necIntent:
    'NEC 552.4: A park trailer ... is intended for seasonal use. It is not intended as a permanent '
    + 'dwelling unit or for commercial uses such as banks, clinics, offices, or similar.',
} as const;

/**
 * The fork this project now faces, stated plainly. Both roads are open; they
 * are not the same road, and the choice is upstream of unit selection.
 */
export type NcRoute = 'temporary-rv' | 'dual-labelled-permanent';

export interface RouteAssessment {
  route: NcRoute;
  permanentUtilitiesAllowed: boolean;
  wheelsMustStayOn: boolean;
  deckMayBearOnUnit: boolean;
  requiresManufacturerCapability: string | null;
  mechanism: string;
}

export function assessNcRoute(route: NcRoute): RouteAssessment {
  if (route === 'temporary-rv') {
    return {
      route,
      permanentUtilitiesAllowed: false,
      wheelsMustStayOn: true,
      deckMayBearOnUnit: false,
      requiresManufacturerCapability: null,
      mechanism:
        'The unit stays a vehicle. Wheels and axles remain ON THE UNIT AT ALL TIMES, it may be blocked '
        + 'and anchored but not permanently connected, and nothing may bear on it. This is the road the '
        + 'rest of this kit has been designing for — free-standing decks, removable skirting, visible '
        + 'chassis. ⚠️ Its real cost is not the deck: it is that permanent electrical, plumbing and '
        + 'mechanical connections are not permissible, which a nightly-rental cabin needs. Resolve how '
        + 'services are delivered before anything else.',
    };
  }
  return {
    route,
    permanentUtilitiesAllowed: true,
    wheelsMustStayOn: false,
    deckMayBearOnUnit: true,
    requiresManufacturerCapability:
      'Dual labelling: built through the RVIA programme AND the NC Modular Construction Program (or HUD).',
    mechanism:
      'The unit becomes a permanently installed modular dwelling and the temporary-structure limits fall '
      + 'away with it. This is a MANUFACTURER capability — it cannot be added on site, by an inspector, '
      + 'or after delivery, and an RVIA-only unit can never reach it. Ask every maker "do you dual label '
      + 'for North Carolina?" before discussing glazing or price. ⚠️ It also ends the vehicle argument: '
      + 'a permanently installed modular dwelling is real property, and the depreciation position that '
      + 'follows is the tax workstream\'s call, not this module\'s.',
  };
}

/** The questions that now precede every other question to a manufacturer. */
export const MANUFACTURER_GATING_QUESTIONS = [
  'Do you dual label for North Carolina — RVIA plus the NC Modular Construction Validating Stamp?',
  'Are you an RVIA member able to apply the Recreational Park Trailer label yourself?',
  'Do you deliver to western North Carolina, and at what haul cost?',
  'Does your quoted square footage already include a habitable loft at 5 ft or more of ceiling?',
  'Will the tow bar, wheels and axles remain on the unit, and will you say so in the order?',
] as const;

// ---------------------------------------------------------------------------
// THE WAY THROUGH: NC ALREADY HAS A PARK MODEL CATEGORY FOR UTILITIES
// ---------------------------------------------------------------------------

/**
 * The OSFM memo says a park model may have no permanent connections. Read alone
 * that looks fatal to a rental cabin, which needs water, sewer and power.
 *
 * It is not fatal, because a second agency regulates the other half. NC DHHS
 * Division of Public Health, On-Site Water Protection Branch, "Permitting and
 * Design Guidance for Wastewater Treatment and Dispersal Systems for
 * Recreational Vehicle Parks", 21 August 2024, updated to reflect 15A NCAC 18E,
 * gives PARK MODEL RVs their own design flow inside an RV Park.
 *
 * So the state does contemplate a connected park model. What it does not
 * contemplate is a connected park model that is a DWELLING. The unit is served
 * as an RV SPACE, on a system sized as an RV park "and not as a dwelling unit".
 * That distinction is the whole game, and it is a question about the PARK's
 * ownership structure rather than about the unit.
 *
 * Source: ehs.dph.ncdhhs.gov/oswp/docs/design/RV-ParksGuidance.pdf
 */
export const RV_PARK_WASTEWATER = {
  issuer: 'NC DHHS, Division of Public Health — On-Site Water Protection Branch',
  dated: '2024-08-21',
  rule: '15A NCAC 18E',
  /** Design daily flow per space. A park model is rated half again a traditional RV. */
  traditionalRvGpd: 100,
  parkModelRvGpd: 150,
  maxOccupantsPerRv: 4,
  /** Spaces the local health department may approve without State review. */
  traditionalMaxSpacesLocal: 15,
  parkModelMaxSpacesLocal: 10,
  localReviewCeilingGpd: 1500,
  peRequiredAboveGpd: 1500,
  stateReviewAboveGpd: 3000,
  definition:
    'an RV Park addressed by this guidance includes two or more RVs located on an individual lot or '
    + 'tract of land or multiple RVs, each located on adjoining lots under common ownership or control. '
    + 'The RV Park is served by a common system sized in accordance with this document and not as a '
    + 'dwelling unit.',
  /** Assume the worst unless you pay to prove otherwise. */
  strengthDefault:
    'If wastewater strength is not characterized specifically, it shall be assumed to be high strength.',
  strengthConsequence:
    'High strength drives advanced pretreatment or a characterisation programme — two effluent samples '
    + 'from a comparable facility, analysed for BOD, TSS, TKN and FOG. It is a real line item, and it '
    + 'is cheaper to plan for than to discover.',
  bathhouseAlternative:
    'Traditional RV spaces with NO water and sewer connections may be treated as campsites where a '
    + 'bathhouse is provided, at 70 gpd/campsite. Park models cannot use this route: they carry no '
    + 'holding tanks, so they depend on connection.',
} as const;

/** Design daily flow for a park of this size, before any adjustment. */
export function parkModelDdfGpd(spaces: number): number {
  return spaces * RV_PARK_WASTEWATER.parkModelRvGpd;
}

/**
 * Below the ceiling the local health department can approve it alone.
 *
 * These are TWO INDEPENDENT LIMITS, not one expressed twice. At the unadjusted
 * 150 gpd they happen to coincide — ten spaces is exactly 1,500 gpd — which
 * makes the space cap look like dead code until you remember that the guidance
 * also allows DDF ADJUSTMENTS under 18E .0403. An adjustment can pull the flow
 * back under the ceiling while the space count stays over its own cap, and the
 * cap still bites. Hence the optional argument: it is the only way to exercise
 * the two limits apart, and without it a mutation deleting the space cap
 * survives unnoticed.
 */
export function withinLocalReview(spaces: number, adjustedDdfGpd?: number): boolean {
  const ddf = adjustedDdfGpd ?? parkModelDdfGpd(spaces);
  return spaces <= RV_PARK_WASTEWATER.parkModelMaxSpacesLocal
    && ddf <= RV_PARK_WASTEWATER.localReviewCeilingGpd;
}

/**
 * ⚠️ THE SENTENCE THAT BEARS DIRECTLY ON SELLING UNITS TO BUYERS.
 *
 * The guidance draws its line at ownership and control, not at construction:
 *
 *   "Individual RVs on separately owned parcels not under common control or RVs
 *    that are designed or used as permanent dwelling units are required to meet
 *    the same requirements as a dwelling unit."
 *
 * So a structure where each buyer owns a SEPARATE PARCEL, outside common
 * control, is the one arrangement that forfeits RV-park treatment and pulls
 * every unit up to dwelling requirements. The thing being sold decides the
 * classification more than the thing being built does.
 *
 * The same document names the route that survives: separately owned SPACES, on
 * a common system, held together by an owners' association and a bi-party
 * agreement under 15A NCAC 18E .0204(g). That keeps common control while still
 * letting buyers own something.
 *
 * WHAT FOLLOWS FROM EITHER STRUCTURE IN TAX TERMS IS NOT THIS MODULE'S CALL.
 * This records what the health rules require of each; the depreciation and
 * ownership consequences belong to the tax workstream, and they should see this
 * sentence before a sales structure is settled.
 */
export const OWNERSHIP_DECIDES_CLASSIFICATION = {
  forfeits:
    'Individual RVs on separately owned parcels not under common control or RVs that are designed or '
    + 'used as permanent dwelling units are required to meet the same requirements as a dwelling unit.',
  survives:
    'When the individual spaces are to be separately owned, and a common on-site wastewater system '
    + 'serves two or more individual spaces an owner\'s association and bi-party agreement are typically '
    + 'required, in accordance with 15A NCAC 18E .0204(g).',
  soWhat:
    'Separately owned PARCELS outside common control forfeit RV-park treatment. Separately owned SPACES '
    + 'under an association, on a common system, do not. If the commercial plan is to sell to buyers, '
    + 'that distinction is upstream of every design decision in this kit.',
  escalateTo: 'tax workstream, before a sales structure is settled',
} as const;

/**
 * Tiny homes are not a way around any of this. NCDOI's Tiny Homes memo of
 * 15 February 2019 treats them as PERMANENT single-family dwellings under the
 * NC Residential Code: 7 ft ceilings, 70 sq ft habitable rooms, plumbing to
 * sewer or an approved private system with "Storage tanks are not acceptable",
 * heating, egress and energy compliance. Built through the NC Modular programme
 * they also take a 5:12 minimum roof pitch, 10 in eaves, a 7 ft 6 in exterior
 * wall and perimeter foundation supports.
 *
 * That is a building. Chasing it does not produce movable housing; it produces
 * a small house with extra rules.
 */
export const TINY_HOME_ROUTE = {
  memoDated: '2019-02-15',
  classification: 'permanent single-family dwelling under the NC Residential Code',
  notAWayAround:
    'Full residential code compliance, permanent connection to sewer or an approved private system, and '
    + 'perimeter foundation supports if built modular. It is a building with extra rules, not a movable '
    + 'asset — so it answers neither the utilities problem nor the classification one.',
  source: 'ncosfm.gov/modular-building/tiny-homes-nc-memo',
} as const;

/** Every movable-housing category NC recognises, and what each actually gets you. */
export const MOVABLE_HOUSING_ROUTES = [
  {
    id: 'park-model-in-rv-park',
    what: 'Park Model RV (ANSI A119.5, RVIA labelled) on a space in an RV park under common control.',
    utilities: 'Yes — 150 gpd/space, connected as an RV space, on a system sized as a park not a dwelling.',
    keepsWheels: true,
    isBuilding: false,
    catch: 'Needs common ownership or control. Ten spaces is the ceiling for local-only review.',
  },
  {
    id: 'traditional-rv-park',
    what: 'Travel trailers and motorhomes on traditional RV spaces.',
    utilities: 'Yes — 100 gpd/space, or 70 gpd as campsites with a bathhouse and no hookups.',
    keepsWheels: true,
    isBuilding: false,
    catch: 'Fifteen spaces on local review, but these are smaller units with holding tanks — a different product.',
  },
  {
    id: 'dual-labelled-permanent',
    what: 'Park model built through RVIA AND the NC Modular or HUD programme.',
    utilities: 'Yes, permanently — it is a dwelling.',
    keepsWheels: false,
    isBuilding: true,
    catch: 'A manufacturer capability that cannot be added later, and it ends the vehicle argument.',
  },
  {
    id: 'tiny-home',
    what: 'Tiny home under the NCDOI tiny-home guidelines.',
    utilities: 'Yes, permanently — it is a dwelling.',
    keepsWheels: false,
    isBuilding: true,
    catch: 'Full NC Residential Code. Not a movable asset in any useful sense.',
  },
] as const;

export function routesThatStayMovable() {
  return MOVABLE_HOUSING_ROUTES.filter((r) => r.isBuilding === false);
}

// ---------------------------------------------------------------------------
// CONNECTED TO TOWN WATER AND SEWER — A DIFFERENT RULEBOOK ENTIRELY
// ---------------------------------------------------------------------------

/**
 * Everything above about design daily flow, septic tanks, LTAR and dispersal
 * fields is 15A NCAC 18E — ON-SITE wastewater. Connecting to municipal sewer
 * moves the project out from under almost all of it and under 15A NCAC 02T,
 * which governs waste not discharged to surface waters, including sewer
 * extensions. The limits are real but they are different limits, and the
 * ten-space septic ceiling is not one of them.
 */

/**
 * 15A NCAC 02T .0114(c) — the table that sets the sewer allocation you must buy
 * from the town. THE CLASSIFICATION IS WORTH MORE THAN THE ENGINEERING HERE.
 *
 * There is no park-model line in this table. A site is priced as a campsite, a
 * cabin or a dwelling, and the three answers differ by a factor of nearly two
 * and a half on identical hardware.
 */
export const SEWER_DESIGN_FLOW_02T = {
  rule: '15A NCAC 02T .0114(c)',
  campsiteWithHookupsGpd: 100,
  campsiteComfortStationNoHookupsGpd: 75,
  dumpStationGpd: 50,
  cottageOrCabinGpd: 200,
  hotelWithInRoomCookingGpd: 175,
  /** Dwelling units: 120/bedroom, floor of 240 per unit. */
  dwellingPerBedroomGpd: 120,
  dwellingMinimumGpd: 240,
  /**
   * ⚠️ THE AMBIGUITY THAT DECIDES THE BILL. 02T has no "park model" entry. The
   * on-site rules (18E) created one at 150 gpd, above a traditional RV's 100 —
   * so the state does already treat park models as heavier than tents. Under
   * 02T you would argue "campgrounds with water and sewer hookups" at 100
   * gal/campsite; a reviewer could as easily reach for "cottages, cabins" at
   * 200. Settle it with the DWR regional office in writing BEFORE sizing the
   * connection, because it doubles the allocation on identical hardware.
   */
  parkModelNotListed: true,
  theQuestion:
    'Does DWR price a park-model site as a campsite with hookups (100 gpd) or as a cottage/cabin '
    + '(200 gpd)? There is no park-model line in 02T. Get the answer in writing before sizing.',
} as const;

export type SiteFlowBasis = 'campsite-hookups' | 'cottage-cabin' | 'dwelling';

/** Allocation to buy, by how the reviewer classifies a site. */
export function sewerAllocationGpd(sites: number, basis: SiteFlowBasis): number {
  const rate = basis === 'campsite-hookups' ? SEWER_DESIGN_FLOW_02T.campsiteWithHookupsGpd
    : basis === 'cottage-cabin' ? SEWER_DESIGN_FLOW_02T.cottageOrCabinGpd
      : SEWER_DESIGN_FLOW_02T.dwellingMinimumGpd;
  return sites * rate;
}

/** What the classification argument is worth, in gallons per day. */
export function classificationSpreadGpd(sites: number): number {
  return sewerAllocationGpd(sites, 'dwelling') - sewerAllocationGpd(sites, 'campsite-hookups');
}

/**
 * 02T .0114(f) — a reduced rate can be granted, but only on evidence, and the
 * evidence is twelve months of it. This is a second-park lever, not a first-park
 * one: you need documented representative data from this or a comparable
 * facility, flow-meter calibration dates, a connection-type breakdown, collection
 * system ownership and age, and an inflow-and-infiltration analysis, submitted by
 * an authorised signing official. Worth knowing exists; not worth planning on.
 */
export const FLOW_REDUCTION_02T = {
  rule: '15A NCAC 02T .0114(f)',
  availableFromDayOne: false,
  monthsOfDataRequired: 12,
  requires: [
    'Documented representative data from this or a comparable facility',
    'Flow meter calibration dates and any adjustments',
    'Breakdown of connection types and customer counts by month',
    'Owner and age of the collection system',
    'Inflow and infiltration analysis',
    'Submission by an authorised signing official under .0106',
  ],
  method:
    'The estimated minimum design daily flow is the numerical average of the top three daily readings '
    + 'for the highest average flow month, accounting for seasonal variation and I&I.',
  warning:
    'It cuts both ways — .0114(f)(3) requires flow INCREASES where the data yields a higher number than '
    + 'the table. Do not open this door without knowing what the meter will say.',
} as const;

/** Sewer extension permitting. A permit and a PE, not a barrier. */
export const SEWER_EXTENSION_PERMIT = {
  rule: '15A NCAC 02T .0300',
  route: 'Fast Track',
  requiresSealedByPE: true,
  reviewDays: 30,
  issuedBy: 'NC Division of Water Resources regional office',
  note:
    'Available for gravity sewers, pump stations and force mains that need no Environmental Assessment '
    + 'and are not Construction Grants funded. Design documents must exist before applying even though '
    + 'they are not submitted up front.',
} as const;

/**
 * ⚠️ THE THRESHOLD MOST LIKELY TO ARRIVE UNANNOUNCED.
 *
 * A public water system is one serving 15+ service connections OR regularly
 * serving 25+ individuals at least 60 days a year. At the state's own planning
 * figure of four occupants per RV, SEVEN OCCUPIED SITES IS TWENTY-EIGHT PEOPLE.
 * A five-star park clears both tests almost immediately.
 *
 * Buying the water from the town does not automatically settle it. What settles
 * it is who owns the pipe past the meter:
 *
 *   Individual town meters at each site — the town stays the water system and
 *   the park carries no PWS obligation. Higher connection fees, more town
 *   infrastructure, less control.
 *
 *   One master meter, park-owned distribution — the park is redistributing to
 *   its own connections and becomes a transient non-community water system in
 *   its own right, with sampling, reporting and an operating permit.
 *
 * That is a cost and compliance fork disguised as a plumbing detail, and it is
 * decided at the point the service is designed. Put it to the town and to the
 * DEQ Public Water Supply Section before the site plan is fixed.
 */
export const PUBLIC_WATER_SYSTEM = {
  rule: '15A NCAC 18C / Safe Drinking Water Act',
  serviceConnectionThreshold: 15,
  individualsThreshold: 25,
  daysPerYearThreshold: 60,
  likelyCategory: 'transient non-community water system (guests are not year-round residents)',
  occupantsPerSitePlanning: 4,
  theFork:
    'Individual town meters keep the town as the water system. A master meter with park-owned '
    + 'distribution makes the park its own public water system. Decide it with the town and the DEQ '
    + 'Public Water Supply Section before the site plan is fixed.',
} as const;

/**
 * Sites at which the 25-person test is reached, at the planning occupancy.
 *
 * Arguments default to the rule's own figures but stay open so the arithmetic
 * can be exercised on numbers it has never seen. Pinning only the real answer
 * cannot tell a calculation from a hardcoded 7 — a mutation proving exactly
 * that survived the first version of this gate.
 */
export function sitesReachingPwsPeopleTest(
  peopleThreshold: number = PUBLIC_WATER_SYSTEM.individualsThreshold,
  occupantsPerSite: number = PUBLIC_WATER_SYSTEM.occupantsPerSitePlanning,
): number {
  if (occupantsPerSite <= 0) return Infinity;
  return Math.ceil((peopleThreshold + 1) / occupantsPerSite);
}

/**
 * 02T .0115 — and the ownership structure that protects the RV classification
 * has a cost here too. Where the applicant is a legally formed owners'
 * association, DWR requires an executed Operational Agreement plus the Articles
 * of Incorporation, Declarations and By-laws with the permit application.
 *
 * So the association that keeps the park under common control for the health
 * rules is the same association DWR will want incorporated and documented before
 * it issues the sewer permit. One decision, two agencies, and the corporate
 * documents need to exist before the utility work is permitted rather than after
 * the units are ordered.
 */
export const OPERATIONAL_AGREEMENT = {
  rule: '15A NCAC 02T .0115',
  triggeredBy: 'applicant is a legally formed Homeowners\' or Property Owner\'s Association',
  requires: [
    'Executed Operational Agreement',
    'Articles of Incorporation',
    'Declarations',
    'By-laws',
  ],
  alsoRequiredFor: 'donation of the system to a public utility or municipality',
  connectsTo:
    'This is the same association that keeps separately owned spaces under common control for the RV '
    + 'park health rules. The entity has to exist and be documented before the sewer permit, not after '
    + 'the units are ordered.',
} as const;

export interface Threshold {
  atSites: number | null;
  trigger: string;
  consequence: string;
  rule: string;
}

/** When the limits actually bite, for a town-connected park. */
export const TOWN_CONNECTED_THRESHOLDS: readonly Threshold[] = [
  {
    atSites: null,
    trigger: 'Any sewer extension to the town main',
    consequence: 'Fast Track permit, PE-sealed plans, 30-day DWR review.',
    rule: '15A NCAC 02T .0300',
  },
  {
    atSites: 7,
    trigger: '25 individuals served 60+ days/year, at 4 occupants per site',
    consequence:
      'Public water system territory on the people test. Whether it lands on the park or stays with '
      + 'the town depends on master meter versus individual town meters.',
    rule: '15A NCAC 18C',
  },
  {
    atSites: 15,
    trigger: '15 service connections',
    consequence: 'Public water system on the connection test as well, if the park owns the distribution.',
    rule: '15A NCAC 18C',
  },
  {
    atSites: null,
    trigger: 'Whenever a reviewer prices the sites',
    consequence:
      'Campsite with hookups is 100 gpd; cottage/cabin is 200; dwelling is 240 minimum. The same '
      + 'hardware, priced up to 2.4x apart. This is the single largest lever on the utility bill.',
    rule: '15A NCAC 02T .0114(c)',
  },
  {
    atSites: null,
    trigger: 'An owners\' association is the permit applicant',
    consequence: 'Operational Agreement plus Articles, Declarations and By-laws, before permit issue.',
    rule: '15A NCAC 02T .0115',
  },
  {
    atSites: null,
    trigger: '12 months of operating flow data exists',
    consequence:
      'A flow reduction can be requested — and a flow INCREASE can be imposed if the meter reads high.',
    rule: '15A NCAC 02T .0114(f)',
  },
];

/** Thresholds that bite at or below a given park size. */
export function thresholdsAt(sites: number): Threshold[] {
  return TOWN_CONNECTED_THRESHOLDS.filter((t) => t.atSites === null || sites >= t.atSites);
}
