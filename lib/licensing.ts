/**
 * What may be served from a PUBLIC deployment.
 *
 * Repo visibility does not settle this. A public deployment that SERVES
 * Den-derived plans is redistributing them regardless of whether the repo
 * holding the bytes is private — visibility and content licensing are separate
 * boundaries, and only the serving layer enforces the second one.
 *
 * The split is provenance, recorded per proposal as `sourceKind`:
 *
 *   constrained_json  compiled deterministically from a one-line brief by our
 *                     own compiler. Our output. Clear to serve.
 *   gpt_proposal      generated from, and graded against, Den Outdoors brochure
 *                     floorplans. Derived work whose redistribution licence is
 *                     NOT established.
 *
 * Default is permissive so local development and the gate ladder see every
 * plan. Set PUBLIC_DEPLOYMENT=1 for a deployment reachable by the public.
 */

/** Provenance values that may be served publicly. */
export const PUBLICLY_SERVABLE_SOURCE_KINDS = new Set(['constrained_json']);

export function isPublicDeployment(): boolean {
  return process.env.PUBLIC_DEPLOYMENT === '1';
}

/**
 * A missing sourceKind is treated as NOT cleared. Unknown provenance is the
 * case where guessing is most expensive, so it fails closed.
 */
export function sourceKindIsPubliclyServable(sourceKind: unknown): boolean {
  return typeof sourceKind === 'string' && PUBLICLY_SERVABLE_SOURCE_KINDS.has(sourceKind);
}

type ManifestOption = { sourceKind?: unknown };
type Manifest = { plans?: Record<string, ManifestOption[]>; summary?: Record<string, unknown> };

/** Plan ids this deployment may serve, from a proposal manifest. */
export function servablePlanIds(manifest: Manifest, publicDeployment = isPublicDeployment()): Set<string> {
  const ids = new Set<string>();
  for (const [planId, options] of Object.entries(manifest.plans ?? {})) {
    if (!publicDeployment || (options ?? []).some((o) => sourceKindIsPubliclyServable(o?.sourceKind))) {
      ids.add(planId);
    }
  }
  return ids;
}

/**
 * The manifest as this deployment may publish it. Drops non-servable plans and
 * the non-servable options of the rest, so the feed never advertises a plan the
 * file route will then refuse — a listing that 404s is its own kind of leak,
 * since it still discloses the plan ids.
 */
export function filterManifestForDeployment(manifest: Manifest, publicDeployment = isPublicDeployment()): Manifest {
  if (!publicDeployment) return manifest;
  const plans: Record<string, ManifestOption[]> = {};
  for (const [planId, options] of Object.entries(manifest.plans ?? {})) {
    const kept = (options ?? []).filter((o) => sourceKindIsPubliclyServable(o?.sourceKind));
    if (kept.length) plans[planId] = kept;
  }
  return {
    ...manifest,
    plans,
    summary: {
      ...(manifest.summary ?? {}),
      planCount: Object.keys(plans).length,
      proposalCount: Object.values(plans).reduce((n, o) => n + o.length, 0),
      publicDeploymentFiltered: true,
    },
  };
}
