import { join } from 'node:path';
const root = process.cwd();
const { parseBrief } = await import(join(root, 'lib/brief.ts'));
const { mockIntentFromBrief, compileIntent } = await import(join(root, 'lib/generate/compile-plan.ts'));
const { writeIfc } = await import(join(root, 'lib/bim/write-ifc.ts'));
const r = compileIntent(mockIntentFromBrief(parseBrief('2 bed gable, 60x90 lot, 10 ft setbacks')), 'ifc-test', 'x');
const a = r.artifact;
const out = await writeIfc({
  planId: a.planId,
  footprint: a.footprint,
  exteriorWalls: (a.exteriorWalls ?? []).map((w) => ({ id: w.id, span: w.span, thicknessFt: w.thicknessFt })),
  interiorWalls: (a.interiorWalls ?? []).map((w) => ({ id: w.id, span: w.span, thicknessFt: w.thicknessFt })),
  wallHeightFt: a.roof?.eaveHeightFt ?? 8,
});
console.log('bytes:', out.bytes.length, '| coverage:', JSON.stringify(out.coverage));
const text = Buffer.from(out.bytes).toString('utf8');
console.log('header ok:', text.startsWith('ISO-10303-21'), '| lines:', text.split('\n').length);
console.log('IFCWALL count:', (text.match(/IFCWALL\(/g) || []).length);
console.log('IFCSLAB count:', (text.match(/IFCSLAB\(/g) || []).length);
console.log('IFCPROJECT:', (text.match(/IFCPROJECT\(/g) || []).length, '| IFCBUILDINGSTOREY:', (text.match(/IFCBUILDINGSTOREY\(/g) || []).length);
