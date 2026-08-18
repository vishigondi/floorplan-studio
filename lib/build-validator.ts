import type {
  BuildBomItem,
  BuildValidationReport,
  BuildValidationRule,
  ComponentCategory,
  DenHome,
  SourceWallSegment,
} from './types';
// Relative WITH extension: the offline gate batteries load this through raw
// Node, which cannot resolve extensionless value imports (`./types` above is
// erased at compile time, so it is exempt).
import { roofPitchDeg as sharedRoofPitchDeg } from './roof-geometry.ts';

const FT_PER_M = 3.280839895;
// The planner's structural module is a 4 ft grid (≈ 1.22 m) — every room, wall,
// and opening is authored and gated to it (WH-GRID-4FT). Buildability is measured
// against that real module, not a separate 1.2 m sheet dimension the system never
// uses; a 4 ft panel is the WikiHouse 1.2 m sheet trimmed to the imperial grid.
const PANEL_WIDTH_FT = 4;
const PANEL_TOLERANCE_FT = 0.16;
const WALL_HEIGHT_SKUS_FT = [2.4 * FT_PER_M, 3.0 * FT_PER_M];
const WALL_HEIGHT_TOLERANCE_FT = 0.18;
const MAX_JOIST_SPAN_FT = 16;
const ROOF_PITCH_SKUS_DEG = [0, 12, 25, 45, 60, 72];
const ROOF_PITCH_TOLERANCE_DEG = 2.5;

type RuleDraft = {
  id: string;
  label: string;
  blockers: string[];
  warnings: string[];
  passes: string[];
};

function createRule(id: string, label: string): RuleDraft {
  return { id, label, blockers: [], warnings: [], passes: [] };
}

function finalizeRule(rule: RuleDraft): BuildValidationRule {
  return {
    id: rule.id,
    label: rule.label,
    status: rule.blockers.length ? 'blocked' : rule.warnings.length ? 'warning' : 'pass',
    details: [...rule.blockers, ...rule.warnings, ...rule.passes],
  };
}

function wallLengthFt(wall: SourceWallSegment): number {
  return Math.hypot((wall.x2 - wall.x1) * 4, (wall.z2 - wall.z1) * 4);
}

/**
 * The real floor-joist span: the largest gap between bearing lines, minimized
 * over the two joist orientations. Bearing lines are the exterior walls plus any
 * interior wall line that spans most of the perpendicular dimension (a full-width
 * partition carries the floor and splits the span — door openings are headered).
 * Falls back to the full footprint dimension when there is no source wall graph
 * (a genuine simple span), so this only ever REDUCES the span when real bearing
 * walls justify it — it never inflates a plan's buildability.
 */
function joistSpanFt(home: DenHome): number {
  const W = home.footprint.width;
  const D = home.footprint.depth;
  const walls = home.sourceWalls ?? [];
  const TOL = 0.1;
  const COVER = 0.7;
  const maxGap = (constAxis: 'x' | 'z'): number => {
    const ext = constAxis === 'z' ? D : W; // span direction these lines bear
    const perp = constAxis === 'z' ? W : D; // dimension a bearing line must cover
    const coverage = new Map<number, number>();
    for (const wall of walls) {
      const horizontal = Math.abs(wall.z1 - wall.z2) < TOL; // constant z
      const vertical = Math.abs(wall.x1 - wall.x2) < TOL; // constant x
      if (constAxis === 'z' && horizontal) {
        const pos = Math.round(wall.z1 * 4 * 2) / 2;
        coverage.set(pos, (coverage.get(pos) ?? 0) + Math.abs(wall.x2 - wall.x1) * 4);
      } else if (constAxis === 'x' && vertical) {
        const pos = Math.round(wall.x1 * 4 * 2) / 2;
        coverage.set(pos, (coverage.get(pos) ?? 0) + Math.abs(wall.z2 - wall.z1) * 4);
      }
    }
    const lines = [0, ext, ...[...coverage.entries()].filter(([, c]) => c >= COVER * perp).map(([p]) => p)]
      .sort((a, b) => a - b);
    let gap = 0;
    for (let i = 1; i < lines.length; i += 1) gap = Math.max(gap, lines[i] - lines[i - 1]);
    return gap || ext;
  };
  return Math.min(maxGap('z'), maxGap('x'));
}

function nearestMultipleDelta(value: number, module: number): { count: number; delta: number } {
  const count = Math.max(1, Math.round(value / module));
  return { count, delta: Math.abs(value - count * module) };
}

function isOnModule(value: number, module = PANEL_WIDTH_FT, tolerance = PANEL_TOLERANCE_FT): boolean {
  return nearestMultipleDelta(Math.abs(value), module).delta <= tolerance;
}

function nearestSku(value: number, skus: number[]): { sku: number; delta: number } {
  return skus.reduce((best, sku) => {
    const delta = Math.abs(value - sku);
    return delta < best.delta ? { sku, delta } : best;
  }, { sku: skus[0], delta: Math.abs(value - skus[0]) });
}

function inferredWallHeight(home: DenHome, wall: SourceWallSegment): { height: number; source: string } {
  if (wall.exterior) {
    const eave = home.roofSemantics?.eaveHeightFt;
    if (Number.isFinite(eave) && (eave ?? 0) > 1) return { height: eave!, source: 'roof eave' };
    if (home.roofStyle === 'a-frame') return { height: WALL_HEIGHT_SKUS_FT[1], source: 'a-frame default wall module' };
    return { height: WALL_HEIGHT_SKUS_FT[1], source: 'default exterior wall module' };
  }
  return { height: WALL_HEIGHT_SKUS_FT[0], source: 'default interior wall module' };
}

function wallAxis(wall: SourceWallSegment): 'x' | 'z' {
  if (wall.bounds) {
    if (wall.bounds.w > wall.bounds.d * 1.25) return 'x';
    if (wall.bounds.d > wall.bounds.w * 1.25) return 'z';
  }
  return Math.abs(wall.x2 - wall.x1) >= Math.abs(wall.z2 - wall.z1) ? 'x' : 'z';
}

function openingOffsetAlongWall(wall: SourceWallSegment, point: { x: number; z: number }): number {
  if (wallAxis(wall) === 'x') return Math.abs(point.x - wall.x1) * 4;
  return Math.abs(point.z - wall.z1) * 4;
}

function matchingWall(home: DenHome, opening: NonNullable<DenHome['sourceOpenings']>[number]): SourceWallSegment | undefined {
  const walls = home.sourceWalls ?? [];
  if (opening.wallId) {
    const byId = walls.find((wall) => wall.id === opening.wallId);
    if (byId) return byId;
    const hostSegments = walls.filter((wall) => {
      if ((wall.floor ?? 0) !== (opening.floor ?? 0)) return false;
      const ids = [wall.id, wall.sourceAnchorId].filter(Boolean);
      return ids.some((id) => id === opening.wallId || String(id).startsWith(`${opening.wallId}:seg-`));
    });
    if (hostSegments.length) {
      const vertical = hostSegments.every((wall) => wallAxis(wall) === 'z');
      const horizontal = hostSegments.every((wall) => wallAxis(wall) === 'x');
      if (vertical || horizontal) {
        return {
          ...hostSegments[0],
          id: opening.wallId,
          x1: vertical
            ? hostSegments.reduce((sum, wall) => sum + (wall.bounds ? wall.bounds.x + wall.bounds.w / 2 : (wall.x1 + wall.x2) / 2), 0) / hostSegments.length
            : Math.min(...hostSegments.map((wall) => wall.bounds ? wall.bounds.x : Math.min(wall.x1, wall.x2))),
          x2: vertical
            ? hostSegments.reduce((sum, wall) => sum + (wall.bounds ? wall.bounds.x + wall.bounds.w / 2 : (wall.x1 + wall.x2) / 2), 0) / hostSegments.length
            : Math.max(...hostSegments.map((wall) => wall.bounds ? wall.bounds.x + wall.bounds.w : Math.max(wall.x1, wall.x2))),
          z1: horizontal
            ? hostSegments.reduce((sum, wall) => sum + (wall.bounds ? wall.bounds.z + wall.bounds.d / 2 : (wall.z1 + wall.z2) / 2), 0) / hostSegments.length
            : Math.min(...hostSegments.map((wall) => wall.bounds ? wall.bounds.z : Math.min(wall.z1, wall.z2))),
          z2: horizontal
            ? hostSegments.reduce((sum, wall) => sum + (wall.bounds ? wall.bounds.z + wall.bounds.d / 2 : (wall.z1 + wall.z2) / 2), 0) / hostSegments.length
            : Math.max(...hostSegments.map((wall) => wall.bounds ? wall.bounds.z + wall.bounds.d : Math.max(wall.z1, wall.z2))),
        };
      }
    }
  }
  const ox1 = opening.x1;
  const oz1 = opening.z1;
  const ox2 = opening.x2;
  const oz2 = opening.z2;
  const openingHorizontal = Math.abs(oz1 - oz2) < 0.02;
  return walls.find((wall) => {
    if ((wall.floor ?? 0) !== (opening.floor ?? 0)) return false;
    const wallHorizontal = wallAxis(wall) === 'x';
    if (wallHorizontal !== openingHorizontal) return false;
    const centerX = wall.bounds ? wall.bounds.x + wall.bounds.w / 2 : wall.x1;
    const centerZ = wall.bounds ? wall.bounds.z + wall.bounds.d / 2 : wall.z1;
    if (wallHorizontal) {
      if (Math.abs(centerZ - oz1) > 0.08) return false;
      const minX = wall.bounds ? wall.bounds.x : Math.min(wall.x1, wall.x2);
      const maxX = wall.bounds ? wall.bounds.x + wall.bounds.w : Math.max(wall.x1, wall.x2);
      return Math.max(Math.min(ox1, ox2), Math.min(wall.x1, wall.x2)) <=
        Math.min(Math.max(ox1, ox2), maxX) + 0.02 &&
        Math.max(Math.min(ox1, ox2), minX) <= Math.min(Math.max(ox1, ox2), maxX) + 0.02;
    }
    if (Math.abs(centerX - ox1) > 0.08) return false;
    const minZ = wall.bounds ? wall.bounds.z : Math.min(wall.z1, wall.z2);
    const maxZ = wall.bounds ? wall.bounds.z + wall.bounds.d : Math.max(wall.z1, wall.z2);
    return Math.max(Math.min(oz1, oz2), minZ) <=
      Math.min(Math.max(oz1, oz2), maxZ) + 0.02;
  });
}

function addBom(map: Map<string, BuildBomItem>, item: BuildBomItem) {
  const existing = map.get(item.componentId);
  if (existing) {
    existing.quantity += item.quantity;
    existing.notes = [...new Set([...(existing.notes ?? []), ...(item.notes ?? [])])];
    return;
  }
  map.set(item.componentId, { ...item, notes: item.notes ? [...item.notes] : undefined });
}

function componentForRoof(home: DenHome, pitchDeg: number): string {
  if (home.roofStyle === 'flat' || pitchDeg < 4) return 'roof-flat';
  if (home.roofStyle === 'shed') return 'roof-shed';
  if (home.roofStyle === 'steep-gable' || pitchDeg >= 38) return 'roof-steep';
  return 'roof-gable';
}

function roofPitchDeg(home: DenHome): number {
  // Resolve this home's roof, then hand the geometry to the ONE definition of
  // pitch (lib/roof-geometry.ts) — a local copy is how a shed came to be
  // reported at twice its real angle.
  return sharedRoofPitchDeg(
    {
      style: home.roofStyle ?? 'gable',
      ridgeAxis: home.roofSemantics?.ridgeAxis ?? 'x',
      ridgeHeightFt: home.roofSemantics?.ridgeHeightFt ?? home.height,
      eaveHeightFt: home.roofSemantics?.eaveHeightFt ?? Math.max(7, home.height * 0.45),
    },
    { widthFt: home.footprint.width, depthFt: home.footprint.depth },
  );
}

function statusFrom(blockers: string[], warnings: string[]): BuildValidationReport['status'] {
  if (blockers.length) return 'blocked';
  if (warnings.length) return 'warning';
  return 'pass';
}

export function validateBuildability(home: DenHome): BuildValidationReport {
  const assumptions = [
    `panel module: ${PANEL_WIDTH_FT.toFixed(2)}ft (4 ft structural grid = the 1220 mm Skylark sheet, 4.003 ft)`,
    `wall height SKUs: ${WALL_HEIGHT_SKUS_FT.map((sku) => `${sku.toFixed(2)}ft`).join(', ')}`,
    `maximum simple floor joist span: ${MAX_JOIST_SPAN_FT}ft`,
  ];
  const bom = new Map<string, BuildBomItem>();
  const rules = {
    wallModule: createRule('wall-module', 'Wall length follows the 4 ft panel module'),
    wallHeight: createRule('wall-height', 'Wall heights use 2.4m or 3.0m SKU'),
    openings: createRule('openings', 'Openings fit panels or align to joints'),
    floorSpan: createRule('floor-span', 'Floor span is within joist limit'),
    roofPitch: createRule('roof-pitch', 'Roof pitch is a stock or CNC-cut rafter'),
    bom: createRule('bom', 'BOM and componentsUsed are generated'),
  };

  const walls = home.sourceWalls ?? [];
  if (!walls.length) {
    rules.wallModule.blockers.push('No source wall graph is available for modular wall validation.');
  }

  // Wall HEIGHT is per wall; wall MODULE is per RUN, and the module check moved
  // below where the runs are reconstructed. Grading the raw entries here was
  // wrong: `sourceWalls` are the SOLID STRETCHES BETWEEN OPENINGS, so a 2.50 ft
  // stretch between two windows was being asked to be a 4 ft multiple. It is not
  // a panel — it is part of one. The run it belongs to (4.00 + 2.50 + 14.50 plus
  // 7 ft of openings = 28 ft = 7 panels) is exactly on module.
  //
  // Nothing caught it because check-buildable fed the validator whole walls from
  // a hand-rolled adapter, so no segment was ever graded.
  for (const wall of walls) {
    const length = wallLengthFt(wall);
    if (length < 0.05) continue;
    const label = wall.id ?? `${wall.exterior ? 'exterior' : 'interior'} wall`;
    const inferred = inferredWallHeight(home, wall);
    const sku = nearestSku(inferred.height, WALL_HEIGHT_SKUS_FT);
    if (sku.delta > WALL_HEIGHT_TOLERANCE_FT) {
      rules.wallHeight.blockers.push(`${label} ${inferred.source} height ${inferred.height.toFixed(2)}ft is not a 2.4m/3.0m wall SKU.`);
    }
  }
  // (moved below the run reconstruction, so the message can count runs)
  if (walls.length && !rules.wallHeight.blockers.length) rules.wallHeight.passes.push(`${walls.length} source walls map to known wall height SKUs or explicit assumptions.`);

  // PANELS ARE COUNTED PER WALL RUN, NOT PER SEGMENT.
  //
  // `sourceWalls` are the SOLID stretches BETWEEN openings, so the loop above
  // billed no panel at all for the wall a door or window sits in: a 28x28 plan
  // billed 24 exterior panels for a 112 ft perimeter, silently 19 ft — its
  // 1 door + 4 windows — short, leaving a builder 4-5 panels down. Rounding each
  // short segment up to a whole panel then inflated the interior count in the
  // other direction. Neither number described the building.
  //
  // An opening does not remove wall, it needs a DIFFERENT panel — which is why
  // the WikiHouse kit ships dedicated opening blocks (W-O-*). So: rebuild each
  // wall RUN (its solid segments plus the openings punched through it), take
  // ceil(run / 4) panels for it, and report how many of those carry an opening.
  const baseWallId = (id: string | undefined) => String(id ?? '').split(':')[0];
  const runs = new Map<string, { lengthFt: number; openings: number; exterior: boolean }>();
  const runFor = (id: string | undefined, exterior: boolean) => {
    const key = baseWallId(id);
    if (!runs.has(key)) runs.set(key, { lengthFt: 0, openings: 0, exterior });
    const run = runs.get(key) as { lengthFt: number; openings: number; exterior: boolean };
    if (exterior) run.exterior = true;
    return run;
  };
  // A LOW GUARD RAIL IS NOT A WALL PANEL. The loft's fall-protection guards are
  // walls in the semantic graph (that is how IRC R312.1 finds them), and this
  // loop billed them as full-height interior panels: loft-showcase's two 28 ft
  // guards contributed 14 of its 32 `wall-int` panels — a builder ordering
  // 14 sheets of interior wall for a hip-height rail. They are counted below on
  // their own line instead.
  const isGuardRail = (wall: { wallKind?: string; id?: string }) =>
    /guard|rail/i.test(`${wall.wallKind ?? ''} ${wall.id ?? ''}`);
  let guardRailFt = 0;
  for (const wall of walls) {
    const length = wallLengthFt(wall);
    if (length < 0.05) continue;
    if (isGuardRail(wall)) { guardRailFt += length; continue; }
    runFor(wall.id, Boolean(wall.exterior)).lengthFt += length;
  }
  for (const opening of home.sourceOpenings ?? []) {
    const run = runs.get(baseWallId(opening.wallId));
    if (!run) continue;
    run.lengthFt += Number(opening.widthFt ?? 0);
    run.openings += 1;
  }

  // THE MODULE CHECK, on the unit that is actually panelized.
  for (const [runId, run] of runs.entries()) {
    if (run.lengthFt < 0.05) continue;
    const moduleDelta = nearestMultipleDelta(run.lengthFt, PANEL_WIDTH_FT);
    if (moduleDelta.delta > PANEL_TOLERANCE_FT) {
      rules.wallModule.blockers.push(`${runId} run is ${run.lengthFt.toFixed(2)}ft, not N x ${PANEL_WIDTH_FT}ft (nearest ${moduleDelta.count} panels is ${(moduleDelta.count * PANEL_WIDTH_FT).toFixed(2)}ft).`);
    }
  }

  if (runs.size && !rules.wallModule.blockers.length) {
    rules.wallModule.passes.push(`${runs.size} wall run(s) align with panel multiples.`);
  }

  let exteriorWallPanels = 0;
  let interiorWallPanels = 0;
  let exteriorOpeningPanels = 0;
  let interiorOpeningPanels = 0;
  for (const run of runs.values()) {
    const panels = Math.max(1, Math.ceil(run.lengthFt / PANEL_WIDTH_FT));
    // An opening panel is one of the run's panels, not an extra one.
    const openingPanels = Math.min(run.openings, panels);
    if (run.exterior) {
      exteriorWallPanels += panels - openingPanels;
      exteriorOpeningPanels += openingPanels;
    } else {
      interiorWallPanels += panels - openingPanels;
      interiorOpeningPanels += openingPanels;
    }
  }

  if (exteriorOpeningPanels) {
    addBom(bom, {
      componentId: 'wall-ext-opening',
      description: 'Exterior wall panel with opening (door/window), 4 ft module',
      category: 'wall',
      quantity: exteriorOpeningPanels,
      unit: 'each',
      notes: ['One per exterior opening; counted within the wall run, not in addition to it.'],
    });
  }
  if (interiorOpeningPanels) {
    addBom(bom, {
      componentId: 'wall-int-opening',
      description: 'Interior wall panel with opening (door), 4 ft module',
      category: 'wall',
      quantity: interiorOpeningPanels,
      unit: 'each',
      notes: ['One per interior opening; counted within the wall run, not in addition to it.'],
    });
  }

  if (guardRailFt > 0) {
    addBom(bom, {
      componentId: 'guard-rail',
      description: 'Loft guard rail, 4 ft module',
      category: 'structural',
      quantity: Math.ceil(guardRailFt / PANEL_WIDTH_FT),
      unit: 'each',
      notes: [`${guardRailFt.toFixed(1)} ft of fall-protection guard (IRC R312.1); not billed as wall panels.`],
    });
  }

  addBom(bom, {
    componentId: 'wall-ext',
    description: 'Exterior wall panel, 4 ft module',
    category: 'wall',
    quantity: exteriorWallPanels,
    unit: 'each',
    notes: exteriorWallPanels ? ['Derived from source exterior wall graph.'] : ['No exterior wall panels found.'],
  });
  if (interiorWallPanels) {
    addBom(bom, {
      componentId: 'wall-int',
      description: 'Interior wall panel, 4 ft module',
      category: 'wall',
      quantity: interiorWallPanels,
      unit: 'each',
      notes: ['Derived from source interior wall graph.'],
    });
  }

  const openings = home.sourceOpenings ?? [];
  for (const opening of openings) {
    const length = Math.hypot((opening.x2 - opening.x1) * 4, (opening.z2 - opening.z1) * 4);
    const label = opening.id ?? `${opening.kind} opening`;
    const wall = matchingWall(home, opening);
    if (!wall) {
      rules.openings.blockers.push(`${label} is not tied to a source wall.`);
      continue;
    }
    const startOffset = openingOffsetAlongWall(wall, { x: opening.x1, z: opening.z1 });
    const endOffset = openingOffsetAlongWall(wall, { x: opening.x2, z: opening.z2 });
    const alignsToJoints = isOnModule(startOffset) && isOnModule(endOffset);
    const fitsOnePanel = length <= PANEL_WIDTH_FT + PANEL_TOLERANCE_FT;
    if (!alignsToJoints && !fitsOnePanel) {
      rules.openings.blockers.push(`${label} is ${length.toFixed(2)}ft and does not fit one panel or align to module joints.`);
    }
    if (opening.kind === 'door') {
      addBom(bom, {
        componentId: opening.roomIds?.includes('exterior') ? 'door-ext' : 'door-int',
        description: opening.roomIds?.includes('exterior') ? 'Exterior door unit' : 'Interior door unit',
        category: 'opening',
        quantity: 1,
        unit: 'each',
      });
    }
    if (opening.kind === 'window') {
      addBom(bom, {
        componentId: 'window-std',
        description: 'Window unit',
        category: 'opening',
        quantity: 1,
        unit: 'each',
      });
    }
  }
  if (openings.length && !rules.openings.blockers.length) rules.openings.passes.push(`${openings.length} openings fit panel/opening constraints.`);
  if (!openings.length) rules.openings.warnings.push('No source openings were available for opening-module validation.');

  const structuralSpan = joistSpanFt(home);
  if (structuralSpan > MAX_JOIST_SPAN_FT) {
    rules.floorSpan.blockers.push(`Floor joist span ${structuralSpan.toFixed(1)}ft (largest gap between bearing lines) exceeds ${MAX_JOIST_SPAN_FT}ft; add a beam or bearing wall to split the floor.`);
  } else {
    rules.floorSpan.passes.push(`Floor joist span ${structuralSpan.toFixed(1)}ft (between bearing lines) is within the ${MAX_JOIST_SPAN_FT}ft joist limit.`);
  }
  // Floor cassettes for EVERY level, not just the ground floor. A loft IS a
  // structural floor deck — the artifact models it as its own floor panel
  // (`floor-1`, "LOFT LEVEL") — but this counted the footprint once, so a
  // single-storey 28x28 and the same plan with an 8x28 loft both billed 49
  // cassettes. Two different buildings, one number, and the loft deck simply
  // absent from the bill.
  const cassettesFor = (w: number, d: number) =>
    Math.ceil(w / PANEL_WIDTH_FT) * Math.ceil(d / PANEL_WIDTH_FT);
  const floorPanels = (home.pairedArtifactJson as {
    floorPanels?: Array<{
      floor?: number; levelIndex?: number;
      footprint?: { widthFt?: number; depthFt?: number; width?: number; depth?: number };
    }>;
  } | undefined)?.floorPanels;
  // DEDUPLICATE BY LEVEL. Traced plans describe the same two storeys twice —
  // a-frame-22 carries `floor-0`/`floor-1` AND `level-main`/`level-loft` — so
  // summing array entries billed it four decks for a two-storey house. One
  // entry per distinct level, largest footprint wins where they disagree.
  const byLevel = new Map<number, { w: number; d: number }>();
  for (const panel of floorPanels ?? []) {
    const w = panel.footprint?.widthFt ?? panel.footprint?.width ?? 0;
    const d = panel.footprint?.depthFt ?? panel.footprint?.depth ?? 0;
    if (!(w > 0 && d > 0)) continue;
    const level = panel.floor ?? panel.levelIndex ?? 0;
    const seen = byLevel.get(level);
    if (!seen || cassettesFor(w, d) > cassettesFor(seen.w, seen.d)) byLevel.set(level, { w, d });
  }
  const floorLevels = [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([, level]) => level);
  const floorCassettes = floorLevels.length
    ? floorLevels.reduce((sum, level) => sum + cassettesFor(level.w, level.d), 0)
    : cassettesFor(home.footprint.width, home.footprint.depth);
  addBom(bom, {
    componentId: 'floor-std',
    description: 'Floor cassette, 4 ft grid',
    category: 'floor',
    quantity: floorCassettes,
    unit: 'each',
    notes: [floorLevels.length > 1
      ? `${floorLevels.length} floor levels: ${floorLevels.map((l) => `${l.w}x${l.d}ft`).join(', ')}.`
      : 'Single floor level.'],
  });
  addBom(bom, {
    componentId: 'foundation',
    description: 'Foundation sill module',
    category: 'structural',
    quantity: Math.ceil((home.footprint.width * 2 + home.footprint.depth * 2) / PANEL_WIDTH_FT),
    unit: 'each',
  });

  const deckPanels = home.rooms
    .filter((room) => /deck|porch|patio/i.test(`${room.type} ${room.label}`))
    .reduce((count, room) => count + Math.ceil((room.gw * 4) / PANEL_WIDTH_FT) * Math.ceil((room.gd * 4) / PANEL_WIDTH_FT), 0);
  if (deckPanels) {
    addBom(bom, {
      componentId: 'floor-deck',
      description: 'Exterior deck panel, 4 ft grid',
      category: 'floor',
      quantity: deckPanels,
      unit: 'each',
    });
  }

  const pitch = roofPitchDeg(home);
  const pitchSku = nearestSku(pitch, ROOF_PITCH_SKUS_DEG);
  if (pitchSku.delta > ROOF_PITCH_TOLERANCE_DEG) {
    // WikiHouse rafters/roof cassettes are CNC-cut to the design, so any pitch is
    // manufacturable — an off-stock pitch is an advisory (custom rafter cut), not
    // a blocker. Distorting the architecture to a stock SKU would be the bug.
    rules.roofPitch.warnings.push(`Roof pitch ${pitch.toFixed(1)}deg is CNC-cut to the design (not a stock ${ROOF_PITCH_SKUS_DEG.join('/')}deg rafter SKU).`);
  } else {
    rules.roofPitch.passes.push(`Roof pitch ${pitch.toFixed(1)}deg matches the ${pitchSku.sku}deg stock rafter SKU.`);
  }
  const roofComponent = componentForRoof(home, pitch);
  // Pitched-roof modules repeat ALONG THE RIDGE; the span picks which block
  // class (Skylark ships R-L / R-S / R-XXS, plus -42 variants), it does not set
  // the count. This counted `ceil(width/4)` regardless of ridge axis, which is
  // the dimension the roof SPANS whenever the ridge runs along z — right only
  // for a square plan by coincidence. A 48x28 gable billed 24 modules where the
  // 28 ft ridge takes 7 per plane, 14 in total: a 71% over-count that grew with
  // how un-square the house was.
  const ridgeParallelFt = home.roofSemantics?.ridgeAxis === 'x'
    ? home.footprint.width
    : home.footprint.depth;
  const roofModulesPerPlane = Math.ceil(ridgeParallelFt / PANEL_WIDTH_FT);
  const roofModules = home.roofStyle === 'flat'
    ? Math.ceil(home.footprint.width / PANEL_WIDTH_FT) * Math.ceil(home.footprint.depth / PANEL_WIDTH_FT)
    : roofModulesPerPlane * 2;

  addBom(bom, {
    componentId: roofComponent,
    description: 'Roof panel/rafter module',
    category: 'roof',
    quantity: Math.max(1, roofModules),
    unit: 'each',
    notes: [
      home.roofStyle === 'flat'
        ? `Flat deck tiled over ${home.footprint.width}x${home.footprint.depth}ft.`
        : `${roofModulesPerPlane} module(s) per plane along the ${ridgeParallelFt}ft ridge, 2 planes. `
          + 'Span sets the block class (Skylark R-L/R-S/R-XXS), not the count; slope length is not subdivided.',
      home.roofSemantics?.status === 'validated' ? 'Uses paired roof/elevation semantics.' : 'Roof quantity is provisional until roof/elevation JSON is validated.',
    ],
  });

  const bomItems = [...bom.values()].filter((item) => item.quantity > 0);
  if (!bomItems.length) rules.bom.blockers.push('No BOM items were generated.');
  else rules.bom.passes.push(`${bomItems.length} BOM line items generated.`);

  const finalized = Object.values(rules).map(finalizeRule);
  const blockers = [...new Set(Object.values(rules).flatMap((rule) => rule.blockers))];
  const warnings = [...new Set(Object.values(rules).flatMap((rule) => rule.warnings))];
  const componentsUsed = [...new Set(bomItems.map((item) => item.componentId))].sort();
  return {
    status: statusFrom(blockers, warnings),
    blockers,
    warnings,
    rules: finalized,
    bom: bomItems.sort((a, b) => a.componentId.localeCompare(b.componentId)),
    componentsUsed,
    assumptions,
  };
}
