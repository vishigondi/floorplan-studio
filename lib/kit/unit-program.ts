/**
 * THE UNIT PROGRAM — one classification, three fit-outs.
 *
 * The brief is a family of units: a host unit with a big kitchen and a big
 * bedroom; a sleeper with two beds and a small kitchen that can come out; some
 * of them usable as workspace. And every one of them depreciable, which means
 * every one of them has to stay MOVABLE PROPERTY.
 *
 * ⛔ THAT LAST REQUIREMENT KILLS THE OBVIOUS DESIGN, so it goes first.
 *
 * There is no such thing as an "office unit" here. ANSI A119.5 defines a park
 * model as a single LIVING unit providing temporary living quarters. A box with
 * a desk and no sleeping is not living quarters, so it is not a park model — it
 * has no seal, no VIN, no NCDMV title, and it lands as a building on a
 * foundation. Real property, 39 years, and the depreciation the whole exercise
 * exists for is gone.
 *
 * ✅ THE RULE THAT MAKES ALL OF IT WORK: VARY THE FIT-OUT, NEVER THE
 * CLASSIFICATION. Every unit is the same legal object — A119.5, titled, wheels
 * on, cord-and-plug, inside the 400 sq ft counted area. What changes between
 * them is FURNITURE AND REMOVABLE EQUIPMENT, which is not a classification fact,
 * not a permit, and not an inspection.
 *
 * So a workspace is a park model furnished as a study. It keeps its bed and its
 * bath because those are what make it a park model, and it earns its keep as an
 * office because that is how it is furnished and let.
 */

/** Every fit-out is the same legal object. This is the invariant. */
export const CLASSIFICATION_INVARIANT = {
  everyUnitIs: 'ANSI A119.5 park model — sealed, VIN, NCDMV title, wheels and axles on, cord-and-plug.',
  whatMayVary: 'Furniture, joinery, removable equipment, and how the unit is let.',
  whatMayNot:
    'Sleeping facilities and a bath. Remove them and it stops being a living unit, stops being a park '
    + 'model, and becomes a building — 39-year real property instead of movable.',
  whyItMatters: 'Depreciation needs movable property. The classification IS the product.',
} as const;

export type KitchenState = 'full-fixed' | 'compact-removable' | 'none';

export interface UnitFitOut {
  id: string;
  name: string;
  role: string;
  sleeps: number;
  /** Beds at floor level, in the counted area. */
  bedrooms: number;
  /** A loft under 5 ft of ceiling is EXCLUDED from NC gross trailer area. */
  subFiveFootLoftSleeps: number;
  kitchen: KitchenState;
  bath: 'full' | 'half';
  /** How a wastewater reviewer is likely to read it — the 02T .0114(c) row. */
  likelyFlowRow: 'campsite (100 gpd)' | 'cottage/cabin (200 gpd)';
  notes: string;
}

/**
 * THE KITCHEN IS THE MOST EXPENSIVE PIECE OF JOINERY ON THE SITE, and not
 * because of what it costs to build.
 *
 * A furnished unit with a kitchen reads to a reviewer as a COTTAGE OR CABIN at
 * 200 gal/unit rather than a campsite with hookups at 100 — the deal workstream
 * has that as the live characterisation risk. Across 38 short-stay lots that is
 * 3,800 gpd against 7,600.
 *
 * Which is exactly why "a small kitchen that can optionally be removed" is a
 * better idea than it looks. Removable equipment is not construction. It keeps
 * the argument available on the units that do not need to cook, and it is
 * reversible if the answer comes back the other way.
 *
 * ⚠️ Two things to confirm before relying on it. A kitchenette with a sink still
 * needs a drain, so "removable" has to mean the fixture and the joinery come out
 * and the connection caps — get the detail drawn, not assumed. And the archive
 * records camping units as sprinkler-exempt under NCFC 903.2.8 exception 3
 * WITHOUT conditions, while this session's earlier reading had the exception
 * conditioned on one story, under 400 sq ft AND NO KITCHEN. The two records
 * disagree. Read the code text before letting a kitchen decide a sprinkler.
 */
export const KITCHEN_IS_THE_LEVER = {
  costsIfPresent: [
    'Reads as cottage/cabin at 200 gpd rather than campsite at 100 — double the allocation per lot.',
    '⚠️ May cost the camping-unit sprinkler exemption. Records disagree; read NCFC 903.2.8 exc 3.',
  ],
  whyRemovableHelps:
    'Removable equipment is not construction. It keeps the lighter characterisation available on units '
    + 'that do not need to cook, and it is reversible either way.',
  detailToDraw:
    'A kitchenette with a sink still needs a drain. "Removable" must mean fixture and joinery out and '
    + 'the connection capped — drawn, not assumed.',
} as const;

/**
 * The sub-5 ft loft is free floor area in North Carolina — NCDOI counts a
 * habitable loft at 5 ft or more of ceiling inside the 400, and expressly
 * excludes anything under. So five foot one costs its whole footprint and four
 * foot eleven costs nothing.
 *
 * That is how a unit sleeps four inside a 400 sq ft cap: two at floor level and
 * two in a loft that does not count.
 */
export const SUB_FIVE_LOFT_IS_FREE = {
  rule: 'Habitable loft (>=5 ft ceiling) counts inside the 400 sq ft. Under 5 ft is expressly excluded.',
  consequence: 'Five foot one costs its whole footprint; four foot eleven costs nothing.',
  use: 'It is how a unit sleeps four inside the cap — two at floor level, two in free area.',
  caution: 'Design it as a sleeping loft, not a room. The ceiling height is the whole argument.',
} as const;

export const FIT_OUTS: readonly UnitFitOut[] = [
  {
    id: 'hearth',
    name: 'The Hearth',
    role: 'The host unit. Where the party cooks, eats and gathers.',
    sleeps: 2,
    bedrooms: 1,
    subFiveFootLoftSleeps: 0,
    kitchen: 'full-fixed',
    bath: 'full',
    likelyFlowRow: 'cottage/cabin (200 gpd)',
    notes: 'Big kitchen, king bedroom, the glazed gable on the view. Accept the cottage reading on this '
      + 'one — it is the unit that genuinely IS one, and arguing otherwise weakens the units where the '
      + 'campsite case is strong.',
  },
  {
    id: 'bunk',
    name: 'The Bunk',
    role: 'The sleeper. Where the rest of the party stays.',
    sleeps: 4,
    bedrooms: 1,
    subFiveFootLoftSleeps: 2,
    kitchen: 'compact-removable',
    bath: 'full',
    likelyFlowRow: 'campsite (100 gpd)',
    notes: 'One bedroom at floor level plus a SUB-5-FOOT sleeping loft, which is free area — that is how '
      + 'it reaches four beds inside the cap. The kitchenette comes out, which keeps the campsite '
      + 'argument available and matches NC\'s own four-occupants-per-RV planning figure exactly.',
  },
  {
    id: 'study',
    name: 'The Study',
    role: 'Workspace, meeting room, the Field Office — let as a room, not a bedroom.',
    sleeps: 2,
    bedrooms: 0,
    subFiveFootLoftSleeps: 0,
    kitchen: 'none',
    bath: 'half',
    likelyFlowRow: 'campsite (100 gpd)',
    notes: 'STILL A PARK MODEL. It keeps a daybed and a bath because those are what make it a living '
      + 'unit and therefore movable property — strip them and it becomes a building. No kitchen gives it '
      + 'the strongest campsite read on the site, and it is the Field Office product in a box that '
      + 'depreciates.',
  },
];

export function fitOut(id: string): UnitFitOut | undefined {
  return FIT_OUTS.find((f) => f.id === id);
}

/** Beds that do not count against the 400 sq ft, across a mix. */
export function freeAreaBeds(mix: readonly UnitFitOut[]): number {
  return mix.reduce((n, f) => n + f.subFiveFootLoftSleeps, 0);
}

export function sleeps(mix: readonly UnitFitOut[]): number {
  return mix.reduce((n, f) => n + f.sleeps, 0);
}

/** Design daily flow the mix is likely to be assessed at, per 02T .0114(c). */
export function likelyFlowGpd(mix: readonly UnitFitOut[]): number {
  return mix.reduce((n, f) => n + (f.likelyFlowRow.startsWith('cottage') ? 200 : 100), 0);
}

export interface Compound {
  party: string;
  heads: number;
  mix: UnitFitOut[];
  sleeps: number;
  flowGpd: number;
  note: string;
}

/**
 * Compounds, composed for the parties actually being sold to. Each is a HEARTH
 * plus sleepers on one open deck — never roofed between, never bearing on a
 * unit, so it stays several vehicles parked near each other rather than one
 * building.
 */
export function compoundFor(party: 'family-of-four' | 'two-families' | 'corporate'): Compound {
  const hearth = fitOut('hearth')!, bunk = fitOut('bunk')!, study = fitOut('study')!;
  if (party === 'family-of-four') {
    const mix = [bunk];
    return { party, heads: 4, mix, sleeps: sleeps(mix), flowGpd: likelyFlowGpd(mix),
      note: 'One Bunk does it — two at floor level, two in the free loft. One lot, one pedestal, the '
        + 'lightest flow row on the site, and the kitchenette stays in for a family that self-caters.' };
  }
  if (party === 'two-families') {
    const mix = [hearth, bunk, bunk];
    return { party, heads: 8, mix, sleeps: sleeps(mix), flowGpd: likelyFlowGpd(mix),
      note: 'Two Bunks sleep the eight; the Hearth is where both families eat. Ten beds against eight '
        + 'heads gives the two groups somewhere to spread out, which is what stops shared accommodation '
        + 'feeling like a compromise.' };
  }
  const mix = [hearth, bunk, bunk, study];
  return { party, heads: 10, mix, sleeps: sleeps(mix), flowGpd: likelyFlowGpd(mix),
    note: 'The Study is what makes this a corporate product rather than a large holiday let — a room to '
      + 'meet in that is not somebody\'s bedroom. It is also the only unit here with no kitchen, so it '
      + 'carries the lightest characterisation on the compound.' };
}

/**
 * ⚠️ THE RISK IN COMPOSING COMPOUNDS, AND IT IS NOT STRUCTURAL.
 *
 * If guests sleep in the Bunks and cook in the Hearth, the compound is
 * FUNCTIONALLY one dwelling distributed across three boxes — even though each is
 * separately titled, on its own pad, with its own hookups, and the deck between
 * them is open.
 *
 * The composition argument still holds on the facts that matter: nothing is
 * roofed between units, nothing bears on a unit, each tows out on its own. But a
 * wastewater reviewer pricing "one kitchen serving three units" may reasonably
 * ask whether it is one dwelling, and that is the same question the campsite
 * characterisation turns on.
 *
 * Raise it deliberately with McGill rather than waiting to be asked. The answer
 * probably helps: three units at 100/100/200 is 400 gpd against 600 if all three
 * are read as cabins.
 */
export const FUNCTIONAL_ONE_DWELLING_RISK = {
  theRisk: 'One kitchen serving three units may read as one dwelling distributed across three boxes.',
  whatStillHolds:
    'Separately titled, separately padded, separately connected, open deck between, each tows out alone. '
    + 'Nothing roofed between and nothing bearing on a unit.',
  whyRaiseItFirst:
    'It is the same question the campsite characterisation turns on, and the arithmetic favours asking: '
    + 'a Hearth-plus-two-Bunks compound is 400 gpd if the rows apply as designed and 600 if every unit '
    + 'reads as a cabin.',
  owner: 'McGill, with the characterisation work — not a design decision',
} as const;
