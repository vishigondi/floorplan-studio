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
