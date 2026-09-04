/**
 * THE PAD IS THE PRODUCT.
 *
 * In a land-lease community the units are the buyers'. What the QOZB builds,
 * owns and leases is the serviced lot — so the pad is the only thing on this
 * site that is genuinely ours to specify, and it is the thing that has to
 * outlive three generations of unit on top of it.
 *
 * ⛔ FIRST, A CORRECTION TO THE OBVIOUS ASSUMPTION: THERE IS NO PIER GRID UNDER
 * THE UNIT.
 *
 * Zook's own site-prep page rules out "foundations such as pier and beam, crawl
 * space, or pit foundations", and NC requires the wheels and axles to stay on
 * the unit at all times. A park model sits on a CRUSHED-STONE PAD, on BLOCKING,
 * held by TIE-DOWNS. Nothing is founded under it.
 *
 * Piers belong to the DECK — which must be free-standing anyway, because the
 * state tells inspectors that "accessory structures may not be supported by
 * these units". So the lot has two independent foundation systems and they must
 * never be drawn as one:
 *
 *   THE UNIT   crushed stone pad + blocking + tie-downs. No piers, no footings.
 *   THE DECK   its own piers or helicals, 12 in min depth, bearing on nothing
 *              but the ground.
 *
 * Conflating them produces precisely the foundation the maker forbids and the
 * state refuses.
 */

import { NEC_551_77, UNIT_SERVICE_POINTS, SETUP_STANDARD } from './lot-positioning.ts';
import { PAD_SPEC as MAKER_PAD } from './site-composition.ts';

export type SpecStatus = 'specified' | 'partial' | 'gap';

export interface PadElement {
  element: string;
  status: SpecStatus;
  spec: string;
  source: string;
  /** What is still needed before a civil contractor could price it. */
  toClose?: string;
}

/**
 * The pad, assembled. Everything here was scattered across five modules and the
 * deal archive; this is the first place it stands as one document, which is what
 * "the pad is the product" actually demands.
 */
export const PAD_ELEMENTS: readonly PadElement[] = [
  {
    element: 'Pad — the unit bearing surface',
    status: 'specified',
    spec: `${MAKER_PAD.stoneDepthIn[0]}-${MAKER_PAD.stoneDepthIn[1]} in crushed stone, or `
      + `${MAKER_PAD.concreteDepthIn[0]}-${MAKER_PAD.concreteDepthIn[1]} in concrete, running `
      + `${MAKER_PAD.marginPastUnitFt} ft past the unit on every side. Firm, undisturbed ground; `
      + 'not recently excavated; graded to drain.',
    source: 'Zook site prep, filed in the deal archive',
  },
  {
    element: 'Blocking',
    status: 'specified',
    spec: MAKER_PAD.blocking + ' The unit must never sit directly on the ground, and must never rest '
      + 'ON its wheels — it is blocked beside them.',
    source: 'Zook set-up guidance; NCDOI/OSFM memo',
  },
  {
    element: 'Anchoring / tie-downs',
    status: 'partial',
    spec: SETUP_STANDARD.tieDowns + ' Against sliding and overturning.',
    source: 'Zook set-up guidance',
    toClose:
      'This is a maker rule of thumb, not engineering. No wind speed, exposure category, anchor type, '
      + 'embedment or soil capacity is specified anywhere. On a ridge at elevation that is the gap most '
      + 'likely to be found by a wind event rather than an inspector. Get the anchoring designed by the '
      + 'PE against the site wind load, and get the soil capacity from the same evaluation that sizes '
      + 'the deck footings.',
  },
  {
    element: 'Electrical pedestal — position',
    status: 'specified',
    spec: `On the ${NEC_551_77.side} (road) side of the parked unit, `
      + `${NEC_551_77.offsetFromLeftEdgeFt[0]}-${NEC_551_77.offsetFromLeftEdgeFt[1]} ft off the stand's `
      + `left edge, anywhere from the rear of the stand to ${NEC_551_77.actualFt} ft forward of it.`,
    source: 'NEC 551.77, adopted through the NC Electrical Code',
  },
  {
    element: 'Electrical pedestal — capacity',
    status: 'specified',
    spec: '200 A conductor and pedestal on the short-stay lots, 100 A on the resident lots, oversized '
      + 'conduit on every lot so an upgrade is a pull and never a trench, plus a capped permanent-service '
      + 'stub. ⚠️ The UNIT connects at 50 A MAXIMUM by cord-and-plug — above that it needs a wired feeder, '
      + 'which fails the mobility test. The pedestal is lot equipment; the unit is not.',
    source: 'Deal archive dock standard 0D.48, tiered 3 Sep; unit ceiling from 0D.59',
  },
  {
    element: 'Water and sewer risers',
    status: 'partial',
    spec: UNIT_SERVICE_POINTS.water + '; ' + UNIT_SERVICE_POINTS.sewer
      + '. Quick-disconnect only — hose to the riser, never hard-piped.',
    source: 'Maker set-up guidance; NCDOI/OSFM memo on permanent connections',
    toClose:
      'Positional only. "Under the wet core" tells a designer which END, not where to put the riser. '
      + 'A civil contractor needs a dimensioned offset from the pad datum, and it differs by model — the '
      + 'A-frames put the bath at the hitch end, so the risers land at the LANE end while the pedestal '
      + 'band sits in the deep half. Dimension it per model on the Kintsugi specification sheet.',
  },
  {
    element: 'DATA / broadband to the lot',
    status: 'gap',
    spec: 'NOTHING SPECIFIED AT LOT LEVEL. The deal archive tracks broadband only as an external '
      + 'question — whether the frontage sits inside Frontier\'s BEAD footprint and in which year.',
    source: '—',
    toClose:
      '🔴 THE REAL HOLE, and it is the one a five-star guest notices first. Needed: a separate '
      + 'communications conduit in the same trench as the power (separated per NEC), a demarc position '
      + 'fixed relative to the pedestal, and a decision on whether service lands at the lot or at a '
      + 'building. It also bears on the Field Office product, which sells remote work and therefore '
      + 'sells the connection. Specify it before the B1 civil bid — retrofitting a data path into a '
      + 'finished lot is a trench, which is exactly what the oversized-conduit rule exists to avoid.',
  },
  {
    element: 'Deck foundation — SEPARATE from the pad',
    status: 'specified',
    spec: 'The deck stands on its own piers or helicals at 12 in minimum depth, bearing on nothing but '
      + 'the ground. It never bears on the unit, and a 2 in reveal with loose flashing keeps it that way.',
    source: 'IRC Appendix M; NCDOI/OSFM "accessory structures may not be supported by these units"',
  },
  {
    element: 'Drainage',
    status: 'partial',
    spec: 'Grade to drain; a dry creek of river cobble on the uphill side takes sheet flow and keeps the '
      + 'blocking dry, which the maker requires.',
    source: 'Maker site prep; kit landscape work',
    toClose: 'No sizing, no outfall, and no relationship to the site E&SC plan. It is a landscape idea '
      + 'rather than a drainage design until the civil engineer sizes it.',
  },
];

export function elementsByStatus(status: SpecStatus): PadElement[] {
  return PAD_ELEMENTS.filter((e) => e.status === status);
}

/** Anything a civil contractor could not price from what we have. */
export function openItems(): PadElement[] {
  return PAD_ELEMENTS.filter((e) => e.status !== 'specified');
}

/**
 * The honest completeness answer. Five of nine elements are specified well
 * enough to build from; three are directional and one does not exist.
 */
export function padCompleteness(): { specified: number; partial: number; gap: number; total: number } {
  return {
    specified: elementsByStatus('specified').length,
    partial: elementsByStatus('partial').length,
    gap: elementsByStatus('gap').length,
    total: PAD_ELEMENTS.length,
  };
}

/**
 * The pad has to survive three generations of unit — that is the whole point of
 * the dock standard, and it is what makes the pad an asset rather than a
 * consumable. These are the properties that let it.
 */
export const PAD_OUTLIVES_THE_UNIT = [
  'Oversized conduit on every lot, so a capacity upgrade is a pull and never a trench.',
  'Lots laid out at FINAL geometry from day one, operated as RV sites in the interim.',
  'A capped permanent-service stub, so the lot can host an RV, a park model or a site-built kit.',
  'No foundation under the unit at all — which is what lets the unit change without touching the pad.',
  'The deck on its own piers, so it survives a unit swap and so does its warranty.',
] as const;
