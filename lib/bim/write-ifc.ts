/**
 * Real IFC4 STEP export.
 *
 * The previous export wrote a file with a HEADER and an EMPTY DATA section — a
 * valid ISO-10303-21 envelope containing no building. It was honest about that
 * in its blockers, but "IFC export" that opens as nothing is not an export.
 *
 * This writes the actual spatial hierarchy every BIM tool expects
 * (Project → Site → Building → Storey) plus walls and a floor slab as extruded
 * solids, related to the storey by IfcRelContainedInSpatialStructure. It is
 * deliberately a SUBSET — no openings, no roof, no fixtures — and the returned
 * `coverage` reports exactly what was and was not written, so the product can
 * say what the file contains instead of implying completeness.
 *
 * Units: the planner works in feet; IFC declares metres, so every length is
 * converted once, here, at the boundary.
 */

import { IfcAPI, IFC4, Handle } from 'web-ifc';

const FT_TO_M = 0.3048;

export interface IfcWallInput {
  id: string;
  span: { x1: number; z1: number; x2: number; z2: number };
  thicknessFt?: number;
  heightFt?: number;
}

export interface IfcPlanInput {
  planId: string;
  footprint: { widthFt: number; depthFt: number };
  exteriorWalls?: IfcWallInput[];
  interiorWalls?: IfcWallInput[];
  wallHeightFt?: number;
}

export interface IfcExportResult {
  bytes: Uint8Array;
  /** What actually went into the file — never a claim of completeness. */
  coverage: {
    walls: number;
    slabs: number;
    storeys: number;
    omitted: string[];
  };
}

/** IFC GlobalId: 22 chars of base64-ish, deterministic from the source id. */
function ifcGuid(seed: string): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let hash = 0x811c9dc5;
  const out: string[] = [];
  for (let i = 0; i < 22; i += 1) {
    for (const ch of `${seed}#${i}`) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    out.push(alphabet[hash % 64]);
  }
  return out.join('');
}

/**
 * Write a compiled plan as IFC4 STEP bytes.
 *
 * `IfcAPI` needs its WASM, which resolves from the installed `web-ifc` package
 * in Node and must be served in the browser; the caller supplies the path.
 */
export async function writeIfc(plan: IfcPlanInput, wasmPath?: string): Promise<IfcExportResult> {
  const api = new IfcAPI();
  if (wasmPath) api.SetWasmPath(wasmPath, true);
  await api.Init();

  const model = api.CreateModel({ schema: 'IFC4' as never });
  const lines: number[] = [];
  const write = (entity: unknown): Handle<never> => {
    api.WriteLine(model, entity as never);
    const id = (entity as { expressID: number }).expressID;
    lines.push(id);
    return new Handle(id) as Handle<never>;
  };

  const label = (value: string) => new IFC4.IfcLabel(value);
  const guid = (seed: string) => new IFC4.IfcGloballyUniqueId(ifcGuid(seed));
  const len = (ft: number) => new IFC4.IfcLengthMeasure(ft * FT_TO_M);
  const posLen = (ft: number) => new IFC4.IfcPositiveLengthMeasure(Math.max(1e-6, ft * FT_TO_M));

  const point3 = (x: number, y: number, z: number) =>
    write(new IFC4.IfcCartesianPoint([len(x), len(y), len(z)]));
  const dir3 = (x: number, y: number, z: number) =>
    write(new IFC4.IfcDirection([new IFC4.IfcReal(x), new IFC4.IfcReal(y), new IFC4.IfcReal(z)]));
  const placement3 = (x = 0, y = 0, z = 0) =>
    write(new IFC4.IfcAxis2Placement3D(point3(x, y, z), null, null));

  // --- Units and the geometric context every representation hangs off --------
  // (UnitType, Prefix, Name) — three arguments. Passing IFC4's optional
  // Dimensions first shifts every slot and emits IFCSIUNIT(*,$,.LENGTHUNIT.,$):
  // a length unit with NO NAME, so nothing downstream knows the model is in
  // metres. The battery below asserts the name, because entity counts and
  // geometry extents are unitless and sail straight past this.
  const metre = write(new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.LENGTHUNIT, null, IFC4.IfcSIUnitName.METRE));
  const squareMetre = write(new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.AREAUNIT, null, IFC4.IfcSIUnitName.SQUARE_METRE));
  const cubicMetre = write(new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.VOLUMEUNIT, null, IFC4.IfcSIUnitName.CUBIC_METRE));
  const units = write(new IFC4.IfcUnitAssignment([metre, squareMetre, cubicMetre]));

  const worldPlacement = placement3(0, 0, 0);
  const context = write(new IFC4.IfcGeometricRepresentationContext(
    null,
    label('Model'),
    new IFC4.IfcDimensionCount(3),
    new IFC4.IfcReal(1e-5),
    worldPlacement,
    null,
  ));

  // --- Spatial hierarchy: Project -> Site -> Building -> Storey --------------
  const project = write(new IFC4.IfcProject(
    guid(`${plan.planId}:project`), null, label(plan.planId), null, null, null, null, [context], units,
  ));

  const sitePlacement = write(new IFC4.IfcLocalPlacement(null, placement3()));
  const site = write(new IFC4.IfcSite(
    guid(`${plan.planId}:site`), null, label('Site'), null, null, sitePlacement, null, null,
    IFC4.IfcElementCompositionEnum.ELEMENT, null, null, null, null, null,
  ));

  const buildingPlacement = write(new IFC4.IfcLocalPlacement(sitePlacement, placement3()));
  const building = write(new IFC4.IfcBuilding(
    guid(`${plan.planId}:building`), null, label('Building'), null, null, buildingPlacement, null, null,
    IFC4.IfcElementCompositionEnum.ELEMENT, null, null, null,
  ));

  const storeyPlacement = write(new IFC4.IfcLocalPlacement(buildingPlacement, placement3()));
  const storey = write(new IFC4.IfcBuildingStorey(
    guid(`${plan.planId}:storey`), null, label('Level 0'), null, null, storeyPlacement, null, null,
    IFC4.IfcElementCompositionEnum.ELEMENT, len(0),
  ));

  write(new IFC4.IfcRelAggregates(guid(`${plan.planId}:agg-project`), null, null, null, project, [site]));
  write(new IFC4.IfcRelAggregates(guid(`${plan.planId}:agg-site`), null, null, null, site, [building]));
  write(new IFC4.IfcRelAggregates(guid(`${plan.planId}:agg-building`), null, null, null, building, [storey]));

  /** A box solid: rectangle profile extruded up Z, placed at (x, z) in plan. */
  const boxProduct = (
    seed: string,
    centreXFt: number,
    centreZFt: number,
    lengthFt: number,
    widthFt: number,
    heightFt: number,
    rotated: boolean,
  ) => {
    const profile = write(new IFC4.IfcRectangleProfileDef(
      IFC4.IfcProfileTypeEnum.AREA,
      label(`${seed}-profile`),
      write(new IFC4.IfcAxis2Placement2D(
        write(new IFC4.IfcCartesianPoint([len(0), len(0)])),
        rotated
          ? write(new IFC4.IfcDirection([new IFC4.IfcReal(0), new IFC4.IfcReal(1)]))
          : null,
      )),
      posLen(lengthFt),
      posLen(widthFt),
    ));
    const solid = write(new IFC4.IfcExtrudedAreaSolid(
      profile,
      placement3(0, 0, 0),
      dir3(0, 0, 1),
      posLen(heightFt),
    ));
    const shape = write(new IFC4.IfcShapeRepresentation(context, label('Body'), label('SweptSolid'), [solid]));
    const product = write(new IFC4.IfcProductDefinitionShape(null, null, [shape]));
    // IFC is Z-up: the plan's z becomes IFC y.
    const placement = write(new IFC4.IfcLocalPlacement(storeyPlacement, placement3(centreXFt, centreZFt, 0)));
    return { product, placement };
  };

  // --- Walls -----------------------------------------------------------------
  const wallHeightFt = plan.wallHeightFt ?? 8;
  const allWalls = [...(plan.exteriorWalls ?? []), ...(plan.interiorWalls ?? [])].filter((wall) => wall.span);
  let wallCount = 0;
  const contained: Array<Handle<never>> = [];
  for (const wall of allWalls) {
    const { x1, z1, x2, z2 } = wall.span;
    const lengthFt = Math.hypot(x2 - x1, z2 - z1);
    if (lengthFt < 1e-6) continue;
    const thickness = wall.thicknessFt ?? 0.5;
    const vertical = Math.abs(x2 - x1) < Math.abs(z2 - z1);
    const { product, placement } = boxProduct(
      `${plan.planId}:${wall.id}`,
      (x1 + x2) / 2,
      (z1 + z2) / 2,
      lengthFt,
      thickness,
      wall.heightFt ?? wallHeightFt,
      vertical,
    );
    contained.push(write(new IFC4.IfcWall(
      guid(`${plan.planId}:${wall.id}`), null, label(wall.id), null, null, placement, product, null,
      IFC4.IfcWallTypeEnum.STANDARD,
    )));
    wallCount += 1;
  }

  // --- Floor slab ------------------------------------------------------------
  const slabThicknessFt = 0.5;
  const slab = boxProduct(
    `${plan.planId}:slab`,
    plan.footprint.widthFt / 2,
    plan.footprint.depthFt / 2,
    plan.footprint.widthFt,
    plan.footprint.depthFt,
    slabThicknessFt,
    false,
  );
  contained.push(write(new IFC4.IfcSlab(
    guid(`${plan.planId}:slab`), null, label('Floor slab'), null, null, slab.placement, slab.product, null,
    IFC4.IfcSlabTypeEnum.FLOOR,
  )));

  write(new IFC4.IfcRelContainedInSpatialStructure(
    guid(`${plan.planId}:contained`), null, null, null, contained, storey,
  ));

  const bytes = api.SaveModel(model);
  api.CloseModel(model);

  return {
    bytes,
    coverage: {
      walls: wallCount,
      slabs: 1,
      storeys: 1,
      // Say what is NOT in the file. An export that quietly omits the roof is
      // worse than one that says it did.
      omitted: ['roof planes', 'window and door openings', 'fixtures', 'spaces (IfcSpace)'],
    },
  };
}

/**
 * Adapter from a compiled artifact to the writer's input. One place, so the
 * export route, the batteries and any future caller feed IFC the same geometry.
 */
export function ifcPlanFromArtifact(artifact: {
  planId?: string;
  footprint: { widthFt: number; depthFt: number };
  exteriorWalls?: Array<{ id?: string; span?: IfcWallInput['span']; thicknessFt?: number }>;
  interiorWalls?: Array<{ id?: string; span?: IfcWallInput['span']; thicknessFt?: number }>;
  roof?: { eaveHeightFt?: number };
}): IfcPlanInput {
  const walls = (list: typeof artifact.exteriorWalls) => (list ?? [])
    .filter((wall) => wall.span)
    .map((wall, index) => ({
      id: wall.id ?? `wall-${index}`,
      span: wall.span as IfcWallInput['span'],
      thicknessFt: wall.thicknessFt,
    }));
  return {
    planId: artifact.planId ?? 'plan',
    footprint: artifact.footprint,
    exteriorWalls: walls(artifact.exteriorWalls),
    interiorWalls: walls(artifact.interiorWalls),
    wallHeightFt: artifact.roof?.eaveHeightFt ?? 8,
  };
}
