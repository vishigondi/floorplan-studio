import { join } from 'node:path';
const root = process.cwd();
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));
const { writeIfc } = await import(join(root, 'lib/bim/write-ifc.ts'));
const wi = await import('web-ifc');

const r = compileIntent(mockIntentFromBrief(parseBrief('2 bed gable, 60x90 lot, 10 ft setbacks')), 'ifc-rt', 'x');
const a = r.artifact;
const { bytes, coverage } = await writeIfc({
  planId: a.planId, footprint: a.footprint,
  exteriorWalls: (a.exteriorWalls ?? []).map((w) => ({ id: w.id, span: w.span, thicknessFt: w.thicknessFt })),
  interiorWalls: (a.interiorWalls ?? []).map((w) => ({ id: w.id, span: w.span, thicknessFt: w.thicknessFt })),
  wallHeightFt: 8,
});

// ROUND TRIP: parse it back with web-ifc itself.
const api = new wi.IfcAPI();
await api.Init();
const model = api.OpenModel(bytes);
console.log('reopened model:', model, '| schema:', api.GetModelSchema(model));
const wallIds = api.GetLineIDsWithType(model, wi.IFCWALL);
const slabIds = api.GetLineIDsWithType(model, wi.IFCSLAB);
const projIds = api.GetLineIDsWithType(model, wi.IFCPROJECT);
const storeyIds = api.GetLineIDsWithType(model, wi.IFCBUILDINGSTOREY);
console.log(`parsed back -> walls ${wallIds.size()}  slabs ${slabIds.size()}  projects ${projIds.size()}  storeys ${storeyIds.size()}`);
console.log('written     -> walls', coverage.walls, ' slabs', coverage.slabs, ' storeys', coverage.storeys);
// Geometry actually loads?
const flat = api.LoadAllGeometry(model);
console.log('geometry meshes:', flat.size());
const first = api.GetLine(model, wallIds.get(0));
console.log('first wall Name:', first.Name?.value, '| has placement:', Boolean(first.ObjectPlacement), '| has shape:', Boolean(first.Representation));
api.CloseModel(model);
