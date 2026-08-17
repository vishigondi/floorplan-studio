// Battery for REAL IFC export (lib/bim/write-ifc.ts).
//
// The previous export wrote an ISO-10303-21 envelope with an EMPTY DATA section:
// a file that opens as nothing. So the invariant here is not "an .ifc was
// produced" — it is that the bytes PARSE BACK through web-ifc's own reader,
// carry the spatial hierarchy a BIM tool needs, tessellate to real geometry, and
// measure the same building the plan describes.
//
// Usage: node scripts/check-ifc.mjs (npm run check:ifc)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));
const { writeIfc, ifcPlanFromArtifact } = await import(join(root, 'lib/bim/write-ifc.ts'));
const wi = await import('web-ifc');

const FT_TO_M = 0.3048;
let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
  }
}

function compiled(brief) {
  const result = compileIntent(mockIntentFromBrief(parseBrief(brief)), 'ifc-battery', brief);
  if (!result.ok) throw new Error(`compile failed: ${result.errors.join('; ')}`);
  return result.artifact;
}

/** Overall bounding box of everything web-ifc actually tessellates, in metres. */
function loadedBoundsM(api, model) {
  const flat = api.LoadAllGeometry(model);
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  let meshes = 0;
  for (let i = 0; i < flat.size(); i += 1) {
    const mesh = flat.get(i);
    meshes += 1;
    for (let g = 0; g < mesh.geometries.size(); g += 1) {
      const placed = mesh.geometries.get(g);
      const geometry = api.GetGeometry(model, placed.geometryExpressID);
      const verts = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
      const m = placed.flatTransformation;
      for (let v = 0; v < verts.length; v += 6) {
        const [x, y, z] = [verts[v], verts[v + 1], verts[v + 2]];
        const t = [
          m[0] * x + m[4] * y + m[8] * z + m[12],
          m[1] * x + m[5] * y + m[9] * z + m[13],
          m[2] * x + m[6] * y + m[10] * z + m[14],
        ];
        for (let axis = 0; axis < 3; axis += 1) {
          lo[axis] = Math.min(lo[axis], t[axis]);
          hi[axis] = Math.max(hi[axis], t[axis]);
        }
      }
    }
  }
  return { meshes, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

const api = new wi.IfcAPI();
await api.Init();

for (const brief of [
  '2 bed gable, 60x90 lot, 10 ft setbacks',
  '2 bed a-frame, 40x60 lot, 5 ft setbacks',
  '3 bed hip roof, 80x100 lot, 10 ft setbacks',
]) {
  console.log(`plan: ${brief}`);
  const artifact = compiled(brief);
  const wallHeightFt = artifact.roof?.eaveHeightFt ?? 8;
  const { bytes, coverage } = await writeIfc(ifcPlanFromArtifact(artifact));

  check('produces bytes', bytes.length > 2000, `${bytes.length} bytes`);
  const text = Buffer.from(bytes).toString('utf8');
  check('is an ISO-10303-21 STEP file', text.startsWith('ISO-10303-21'));
  check('DATA section is not empty', /DATA;[\s\S]*#\d+=/.test(text));

  // THE REAL TEST: web-ifc's own parser reads it back.
  const model = api.OpenModel(bytes);
  check('reopens as IFC4', api.GetModelSchema(model) === 'IFC4', api.GetModelSchema(model));

  const walls = api.GetLineIDsWithType(model, wi.IFCWALL).size();
  const slabs = api.GetLineIDsWithType(model, wi.IFCSLAB).size();
  const projects = api.GetLineIDsWithType(model, wi.IFCPROJECT).size();
  const sites = api.GetLineIDsWithType(model, wi.IFCSITE).size();
  const buildings = api.GetLineIDsWithType(model, wi.IFCBUILDING).size();
  const storeys = api.GetLineIDsWithType(model, wi.IFCBUILDINGSTOREY).size();

  check(`every wall survives the round trip (${coverage.walls})`, walls === coverage.walls, `read back ${walls}`);
  check('the floor slab survives', slabs === coverage.slabs, `read back ${slabs}`);
  // A BIM tool needs the whole spatial chain; any missing link and the products
  // are orphans that many viewers silently drop.
  check('spatial hierarchy is complete (project/site/building/storey)',
    projects === 1 && sites === 1 && buildings === 1 && storeys === 1,
    `project ${projects} site ${sites} building ${buildings} storey ${storeys}`);
  // Not "a containment relationship exists" — that passes with an EMPTY relation
  // and every wall orphaned, which many viewers silently drop. Count what it
  // actually relates.
  const containIds = api.GetLineIDsWithType(model, wi.IFCRELCONTAINEDINSPATIALSTRUCTURE);
  check('exactly one containment relationship', containIds.size() === 1, `${containIds.size()}`);
  let containedCount = 0;
  let containedStorey = false;
  if (containIds.size() === 1) {
    const rel = api.GetLine(model, containIds.get(0));
    containedCount = (rel.RelatedElements ?? []).length;
    const structure = api.GetLine(model, rel.RelatingStructure.value);
    containedStorey = structure?.constructor?.name?.includes('BuildingStorey')
      || api.GetLineType(model, rel.RelatingStructure.value) === wi.IFCBUILDINGSTOREY;
  }
  check('every wall and slab is contained in the storey',
    containedCount === walls + slabs, `${containedCount} related, expected ${walls + slabs}`);
  check('containment points at the building storey', containedStorey);
  check('spatial structure is aggregated', api.GetLineIDsWithType(model, wi.IFCRELAGGREGATES).size() === 3);

  // Geometry must tessellate — entities alone can still open as an empty view.
  const { meshes, size } = loadedBoundsM(api, model);
  check('geometry tessellates', meshes >= coverage.walls, `${meshes} meshes`);

  // ...and it must be a model of THIS house, not merely a valid file.
  const widthFt = size[0] / FT_TO_M;
  const heightFt = size[1] / FT_TO_M;
  const depthFt = size[2] / FT_TO_M;
  const wallThicknessFt = 0.5;
  check(`footprint matches the plan (${artifact.footprint.widthFt}x${artifact.footprint.depthFt} ft)`,
    Math.abs(widthFt - (artifact.footprint.widthFt + wallThicknessFt)) < 1.0
    && Math.abs(depthFt - (artifact.footprint.depthFt + wallThicknessFt)) < 1.0,
    `${widthFt.toFixed(1)} x ${depthFt.toFixed(1)} ft`);
  check(`wall height matches the plan (${wallHeightFt} ft)`,
    Math.abs(heightFt - wallHeightFt) < 0.6, `${heightFt.toFixed(1)} ft`);

  // UNITS. Entity counts and geometry extents are unitless, so a mis-declared
  // unit sails past every other check here — this file shipped
  // IFCSIUNIT(*,$,.LENGTHUNIT.,$), a length unit with no name, and nothing
  // noticed. A model whose coordinates mean nothing is not an export.
  const unitIds = api.GetLineIDsWithType(model, wi.IFCSIUNIT);
  const units = [];
  for (let i = 0; i < unitIds.size(); i += 1) {
    const unit = api.GetLine(model, unitIds.get(i));
    units.push({ type: unit.UnitType?.value ?? unit.UnitType, name: unit.Name?.value ?? unit.Name });
  }
  const lengthUnit = units.find((unit) => String(unit.type).includes('LENGTHUNIT'));
  check('declares a length unit', Boolean(lengthUnit), JSON.stringify(units));
  check('the length unit is METRE (coordinates are converted from feet)',
    Boolean(lengthUnit) && String(lengthUnit.name).includes('METRE'),
    JSON.stringify(lengthUnit));
  check('every declared unit has a name', units.every((unit) => unit.name && String(unit.name) !== 'null'),
    JSON.stringify(units));
  check('units are assigned to the project',
    api.GetLineIDsWithType(model, wi.IFCUNITASSIGNMENT).size() === 1);

  // Honesty: the export must SAY what it left out rather than imply completeness.
  check('coverage names what was omitted', coverage.omitted.length > 0, JSON.stringify(coverage.omitted));
  api.CloseModel(model);
}

console.log('');
if (failures) {
  console.error(`${failures} ifc check(s) failed`);
  process.exit(1);
}
console.log('ifc battery clean (real entities, round-tripped)');
