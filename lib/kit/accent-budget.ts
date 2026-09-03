/**
 * ACCENT BUDGET — making a cheap shell read as architecture.
 *
 * The programme is not "build a nicer unit". It is: push everything possible
 * into the factory, keep the shell the cheapest thing that passes code, and
 * spend a small, deliberate accent budget exactly where a camera points.
 *
 * WHY THIS IS WORTH DOING AT ALL — the observed tariff below is the anchor.
 * A 398 sq ft, one-bed, two-guest unit in Highlands NC lets for $870/night.
 * Revenue is not a function of floor area. It is a function of accents and of
 * the wellness circuit, and 398 sq ft sits INSIDE the ANSI A119.5 park-model
 * cap, so the whole effect is reachable without leaving the unit class the
 * deal position depends on.
 *
 * The costs here are ordinal TIERS, not dollars. Dollar figures for these
 * moves would be invented; the tiers are defensible and they are all the
 * ranking needs. The only dollars in this module are observed and sourced.
 */

export type Tier = 'low' | 'moderate' | 'high';
const TIER_WEIGHT: Record<Tier, number> = { low: 1, moderate: 2, high: 3 };

/** Where the work happens. The user's stated innovation is maximising the first. */
export type BuildLocus = 'factory' | 'site' | 'either';

/**
 * OBSERVED — Hide Inn Seek "Bird Nest", Highlands NC (Macon County), opened
 * March 2025. Recorded because it sets the revenue ceiling this design is
 * aiming at, not because it is a model to copy.
 *
 * Sources: hideinnseek.com; treehouserentals.com listing HA-3214511568.
 */
export const OBSERVED_TARIFF = {
  name: 'Hide Inn Seek — Bird Nest',
  where: 'Highlands, NC (Macon County)',
  siteElevationFt: 4118,
  openedIso: '2025-03',
  floorAreaSqFt: 398,
  beds: '1 king',
  maxGuests: 2,
  /** Listed nightly rate. Aggregators showed $774 and $870; the higher is the listing's own. */
  nightlyRateUsd: 870,
  lowestSeenRateUsd: 774,
  /** The wet programme is a SEPARATE structure downhill — see DETACHED_WELLNESS. */
  wellnessIsDetached: true,
  observedFeatures: [
    '12 ft steel-and-glass window wall',
    'elevated boardwalk approach to the entry',
    'skylight over the bed',
    'detached spa 30 stone steps downhill: inset hot tub, hot-stone sauna, open-air cold plunge',
  ],
  unresolved: [
    'construction method not published — no evidence either way of prefabrication',
    'build cost not published, so the margin behind the tariff is unknown',
  ],
} as const;

/**
 * $/sq ft/night — derived, never stored, because the point is the ratio.
 *
 * The arguments default to the observed figures but are open so the derivation
 * itself can be exercised. Pinning only the observed answer cannot tell a
 * calculation from a hardcoded constant; feeding it a second pair can.
 */
export function ratePerSqFtNight(
  rateUsd: number = OBSERVED_TARIFF.nightlyRateUsd,
  areaSqFt: number = OBSERVED_TARIFF.floorAreaSqFt,
): number {
  if (areaSqFt <= 0) return 0;
  return Math.round((rateUsd / areaSqFt) * 100) / 100;
}

/** ANSI A119.5 living-area cap. The observed unit is inside it — that is the point. */
export const ANSI_LIVING_AREA_CAP_SQFT = 400;

export function observedFitsParkModelClass(): boolean {
  return OBSERVED_TARIFF.floorAreaSqFt < ANSI_LIVING_AREA_CAP_SQFT;
}

export interface AccentMove {
  id: string;
  what: string;
  /** Why a guest reads it as expensive. */
  readsAs: string;
  /** Why it is not, in fact, expensive. */
  actuallyCheapBecause: string;
  perceivedGain: Tier;
  buildCost: Tier;
  maintenanceCost: Tier;
  locus: BuildLocus;
  /** Does it appear in the hero frame? Spend outside the frame is waste. */
  visibleInHeroFrame: boolean;
  /** Code or practical consequence that comes attached. Null when there is none. */
  consequence: string | null;
}

/**
 * The moves, in the order they were observed to matter. Ranking is computed by
 * leverage(), not by this array's order — the order here is documentary.
 */
export const ACCENT_MOVES: readonly AccentMove[] = [
  {
    id: 'glazed-gable',
    what: 'One large glazed gable end: a triangular light above a full-width fixed pane.',
    readsAs: 'A bespoke window wall. It is the single image the listing sells on.',
    actuallyCheapBecause:
      'Fixed glass is the cheapest glazing per square foot there is — no hardware, no operable seals. '
      + 'A gable end is inboard of the towing width, and it is framed anyway. One big unit costs less '
      + 'than the several small punched openings it replaces, and leaks in fewer places.',
    perceivedGain: 'high', buildCost: 'moderate', maintenanceCost: 'low',
    locus: 'factory',
    visibleInHeroFrame: true,
    consequence:
      'Fixed glass is not egress. The sleeping level still needs a complying escape opening elsewhere '
      + '(IRC R310), and a large south or west pane needs low-e or shading or the unit cooks.',
  },
  {
    id: 'dark-monolithic-cladding',
    what: 'Black or near-black vertical board-and-batten, roof in the same dark tone, tight eaves.',
    readsAs: 'A deliberate monolithic object. Reads Scandinavian rather than mobile.',
    actuallyCheapBecause:
      'Dark opaque stain over rough-sawn softwood is the cheapest cladding upgrade available, and the '
      + 'darkness hides the substrate — board quality stops mattering. Running the roof in the same '
      + 'tone removes the trim line that makes a cheap building look cheap.',
    perceivedGain: 'high', buildCost: 'low', maintenanceCost: 'low',
    locus: 'factory',
    visibleInHeroFrame: true,
    consequence:
      'Stain, never paint. Stain fades and is recoated; paint peels and must be stripped. Dark surfaces '
      + 'in full sun move more, so detail the batten laps to allow it.',
  },
  {
    id: 'cantilevered-deck-edge',
    what: 'The deck runs past its last support and ends in mid-air over falling ground.',
    readsAs: 'Engineering. It is the move that makes a photograph look like architecture.',
    actuallyCheapBecause:
      'The cheapest structure is the one that is not there. Every foot of cantilever is a foot of '
      + 'beam, posts and footings deleted, and on a slope it deletes the tallest, most expensive posts '
      + 'in the whole deck.',
    perceivedGain: 'high', buildCost: 'low', maintenanceCost: 'low',
    locus: 'either',
    visibleInHeroFrame: true,
    consequence:
      'Hard-capped by IRC R507: the lesser of a quarter of the backspan and the absolute cap for the '
      + 'joist size. Use maxWoodOverhangFt() in deck-pergola.ts — do not eyeball it.',
  },
  {
    id: 'exposed-timber-undercroft',
    what: 'The elevating structure is left visible: heavy posts, diagonal knee braces, open beneath.',
    readsAs: 'A treehouse. Craft. The braces in particular read as hand-built.',
    actuallyCheapBecause:
      'Posts on footings are far cheaper than any foundation wall or crawlspace, and the space they '
      + 'create is covered outdoor room whose roof is the floor above — the most valuable square '
      + 'footage on the site, at the cost of the gravel under it.',
    perceivedGain: 'high', buildCost: 'low', maintenanceCost: 'low',
    locus: 'site',
    visibleInHeroFrame: true,
    consequence:
      'Appendix M sizes the posts: 4x4 only to 8 ft, 6x6 to 20 ft. Past 30 in of drop the ≤30 in '
      + 'lateral-bracing exemption is gone and guards become mandatory — see ELEVATION_STRATEGY, '
      + 'because lifting the UNIT this way has a cost that has nothing to do with structure.',
  },
  {
    id: 'slim-dark-guard',
    what: 'Thin dark metal balusters or cable, dark top rail, set against the raw timber.',
    readsAs: 'A detail someone chose. The contrast is the whole effect.',
    actuallyCheapBecause:
      'It is the standard guard the code already forces you to build, in a different finish. The '
      + 'upgrade is a colour decision, not a structural one.',
    perceivedGain: 'moderate', buildCost: 'low', maintenanceCost: 'low',
    locus: 'either',
    visibleInHeroFrame: true,
    consequence: 'IRC R312: 36 in minimum, no 4 in sphere may pass. Dark finish must be corrosion-resistant.',
  },
  {
    id: 'skylight-over-bed',
    what: 'A single fixed skylight directly above the pillow.',
    readsAs: 'Stargazing from bed. It is a listing headline out of all proportion to its cost.',
    actuallyCheapBecause: 'One fixed factory-flashed unit in a roof plane that is being built regardless.',
    perceivedGain: 'high', buildCost: 'low', maintenanceCost: 'moderate',
    locus: 'factory',
    visibleInHeroFrame: false,
    consequence:
      'The one accent here that genuinely costs something later: a roof penetration is the likeliest '
      + 'leak on the building. Factory-fit it or do not fit it. Never a site cut-in.',
  },
  {
    id: 'boardwalk-approach',
    what: 'A level raised walkway to the door instead of a flight of steps.',
    readsAs: 'Arrival. It is the observed unit\'s own described entrance.',
    actuallyCheapBecause:
      'Deck framing at grade, the cheapest assembly on the project, replacing stairs — which are the '
      + 'most labour-expensive linear foot of carpentry there is.',
    perceivedGain: 'moderate', buildCost: 'low', maintenanceCost: 'low',
    locus: 'site',
    visibleInHeroFrame: false,
    consequence: 'Under 30 in it needs no guard, which is exactly why it is cheaper than stairs.',
  },
  {
    id: 'interior-hard-finishes',
    what: 'Plaster shower, stone or marble vanity top, oak joinery.',
    readsAs: 'Hotel-grade. Carries the whole interior on two surfaces.',
    actuallyCheapBecause:
      'The wet room in a sub-400 sq ft unit is tiny. Premium material over a very small area is a '
      + 'rounding error, and it is the surface a guest touches most.',
    perceivedGain: 'moderate', buildCost: 'moderate', maintenanceCost: 'low',
    locus: 'factory',
    visibleInHeroFrame: false,
    consequence: null,
  },
];

/**
 * Leverage = perceived gain per unit of build cost, discounted by what it costs
 * to keep. Higher is better. Deliberately crude: it only has to sort.
 */
export function leverage(m: AccentMove): number {
  const gain = TIER_WEIGHT[m.perceivedGain];
  const cost = TIER_WEIGHT[m.buildCost] + (TIER_WEIGHT[m.maintenanceCost] - 1) * 0.5;
  return Math.round((gain / cost) * 100) / 100;
}

export function rankedAccents(): AccentMove[] {
  return [...ACCENT_MOVES].sort((a, b) => leverage(b) - leverage(a) || a.id.localeCompare(b.id));
}

/** Share of the selected accents that can be built in the factory. The metric that matters. */
export function factoryFraction(moves: readonly AccentMove[] = ACCENT_MOVES): number {
  if (moves.length === 0) return 0;
  const n = moves.filter((m) => m.locus === 'factory' || m.locus === 'either').length;
  return Math.round((n / moves.length) * 100) / 100;
}

/**
 * Spend that the hero frame never shows, weighted by what it costs. Not
 * automatically waste — a skylight sells the listing from inside — but it is
 * the spend that has to justify itself in words rather than in the photograph.
 */
export function offCameraSpend(moves: readonly AccentMove[] = ACCENT_MOVES): AccentMove[] {
  return moves.filter((m) => !m.visibleInHeroFrame && TIER_WEIGHT[m.buildCost] >= 2);
}

/**
 * THE TENSION AT THE CENTRE OF THIS AESTHETIC.
 *
 * The reference photograph shows the dwelling itself sitting on a timber post
 * frame. That is the most photogenic version and it is the one that quietly
 * destroys the position the rest of this kit protects: a unit set down on posts
 * has its wheels carrying nothing, is permanently affixed, and reads as a
 * building to anyone who looks under it. deck-pergola.ts refuses to specify
 * skirting for exactly this reason; lifting the unit is that mistake, larger.
 *
 * The resolution is that the DRAMA DOES NOT HAVE TO COME FROM THE UNIT. On
 * falling ground the unit can stay on its own chassis on a cut pad at the high
 * side while the DECK flies out over the fall. The photograph is the same — the
 * camera sits below and looks up at a dark box behind a deck edge in mid-air —
 * and the vehicle reading survives intact. Sloping ground stops being the
 * site's problem and becomes the thing that makes the picture.
 */
export type ElevationStrategy = 'lift-the-unit' | 'lift-the-deck';

export interface ElevationAssessment {
  strategy: ElevationStrategy;
  /** Does the unit still read, and function, as a vehicle on its own chassis? */
  preservesVehicleReading: boolean;
  recommended: boolean;
  /** True once guards and lateral design are mandatory rather than optional. */
  triggersGuardsAndLateral: boolean;
  mechanism: string;
}

export function assessElevation(strategy: ElevationStrategy): ElevationAssessment {
  if (strategy === 'lift-the-unit') {
    return {
      strategy,
      preservesVehicleReading: false,
      recommended: false,
      triggersGuardsAndLateral: true,
      mechanism:
        '🔴 Maximum drama, and it forfeits the unit class. Set on posts, the chassis carries nothing, '
        + 'the unit is permanently affixed, and nobody looking underneath reads a vehicle. It also '
        + 'demands full lateral design for a heavy box on tall posts, which is real engineering on a '
        + 'unit that was never framed to be lifted. Use only where the unit was never going to be a '
        + 'park model in the first place.',
    };
  }
  return {
    strategy,
    preservesVehicleReading: true,
    recommended: true,
    triggersGuardsAndLateral: true,
    mechanism:
      '✅ Same photograph, unit class intact. The unit stays on its chassis on a cut pad at the high '
      + 'side of the fall; the deck is framed off that level and cantilevers out over the drop. The '
      + 'camera sits below and still sees a dark box above a deck edge in mid-air. Guards and lateral '
      + 'bracing apply to the DECK, where they are ordinary Appendix M work, instead of to a dwelling '
      + 'on stilts. Cut the pad, do not lift the box.',
  };
}

/**
 * The observed property put its entire wet programme in a separate structure
 * downhill. That is the same composition-not-attachment rule the link work
 * arrived at, reached independently by someone selling nights at $870.
 */
export const DETACHED_WELLNESS = {
  observedAt: OBSERVED_TARIFF.name,
  what: 'Inset hot tub, hot-stone sauna, open-air cold-plunge shower, 30 stone steps downhill in a grove.',
  whyItWorks: [
    'Keeps the sleeping unit under the ANSI living-area cap by moving programme out of it, not by shrinking it.',
    'Keeps the heaviest plumbing and the wettest air out of a towable box.',
    'Is a second destination on the same site, so the guest experience grows without the unit growing.',
    'Uses the fall of the ground as the journey rather than fighting it — the steps are the amenity.',
  ],
  /** Same caution as any second structure: it is its own improvement. */
  caution:
    'A detached spa is a 39-year improvement in its own right and carries that on its own. It does not '
    + 'threaten the units, which is the entire reason to detach it — but the covered fraction and the '
    + 'depreciation treatment are the tax workstream\'s call, not this module\'s.',
} as const;

/** The frame the accents are aimed at. Written down because it decides which corner gets the money. */
export const HERO_FRAME = {
  position: 'Low and off the fall, three-quarter view onto the glazed gable and the cantilevered deck edge.',
  light: 'Dusk, interior lit warm behind the glass, exterior in near-silhouette.',
  why:
    'This frame shows the glazed gable, the dark cladding, the deck edge in mid-air and the timber '
    + 'beneath, in one image. Every high-cost accent should appear in it or justify itself another way.',
  consequence:
    'It also decides orientation: the glass and the cantilever go on the view side, together, on the '
    + 'downhill corner. Splitting them across two elevations halves the photograph and doubles the cost.',
} as const;
