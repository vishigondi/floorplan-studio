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
