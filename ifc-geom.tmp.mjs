import { join } from 'node:path';
const root = process.cwd();
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));
const { writeIfc } = await import(join(root, 'lib/bim/write-ifc.ts'));
const wi = await import('web-ifc');
const FT = 0.3048;

const r = compileIntent(mockIntentFromBrief(parseBrief('2 bed gable, 60x90 lot, 10 ft setbacks')), 'ifc-geom', 'x');
const a = r.artifact;
const { bytes } = await writeIfc({
  planId: a.planId, footprint: a.footprint,
  exteriorWalls: (a.exteriorWalls ?? []).map((w) => ({ id: w.id, span: w.span, thicknessFt: w.thicknessFt })),
  interiorWalls: (a.interiorWalls ?? []).map((w) => ({ id: w.id, span: w.span, thicknessFt: w.thicknessFt })),
  wallHeightFt: 8,
});
const api = new wi.IfcAPI();
await api.Init();
const model = api.OpenModel(bytes);
const flat = api.LoadAllGeometry(model);
let lo = [1e18,1e18,1e18], hi = [-1e18,-1e18,-1e18];
for (let i = 0; i < flat.size(); i += 1) {
  const mesh = flat.get(i);
  for (let g = 0; g < mesh.geometries.size(); g += 1) {
    const pg = mesh.geometries.get(g);
    const geom = api.GetGeometry(model, pg.geometryExpressID);
    const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
    const m = pg.flatTransformation;
    for (let v = 0; v < verts.length; v += 6) {
      const x = verts[v], y = verts[v+1], z = verts[v+2];
      const tx = m[0]*x + m[4]*y + m[8]*z + m[12];
      const ty = m[1]*x + m[5]*y + m[9]*z + m[13];
      const tz = m[2]*x + m[6]*y + m[10]*z + m[14];
      lo = [Math.min(lo[0],tx), Math.min(lo[1],ty), Math.min(lo[2],tz)];
      hi = [Math.max(hi[0],tx), Math.max(hi[1],ty), Math.max(hi[2],tz)];
    }
  }
}
const dim = [hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]];
console.log('plan footprint (ft):', a.footprint.widthFt, 'x', a.footprint.depthFt, '| wall height 8');
console.log('IFC bbox (m):  ', dim.map(d=>d.toFixed(2)).join(' x '));
console.log('IFC bbox (ft): ', dim.map(d=>(d/FT).toFixed(1)).join(' x '));
api.CloseModel(model);
