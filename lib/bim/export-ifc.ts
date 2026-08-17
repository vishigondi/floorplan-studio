import type { DenHome } from '@/lib/types';
import { semanticBimFromHome, type SemanticBimModel } from './semantic-bim.ts';

export interface ExperimentalIfcExport {
  status: 'experimental';
  semanticBim: SemanticBimModel;
  ifcText: string;
  blockers: string[];
}

export function exportExperimentalIfc(home: DenHome): ExperimentalIfcExport {
  const semanticBim = semanticBimFromHome(home);
  // IFC STEP is now REAL — /api/export-ifc writes IfcProject/Site/Building/
  // Storey plus walls and a slab as extruded solids, round-tripped through
  // web-ifc's own parser by check:ifc. What remains is coverage, not existence,
  // and the warning names it instead of implying a complete model.
  const blockers = [
    'IFC STEP export covers the spatial hierarchy, walls and the floor slab. Roof planes, window/door openings, fixtures and IfcSpace are NOT written yet.',
    'This JSON payload is the complete semantic_bim_v1 model; the IFC file is a structural subset of it.',
  ];
  const ifcText = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('semantic_bim_v1 experimental handoff'),'2;1');",
    `FILE_NAME('${home.id}-${home.pairedProposalId ?? 'draft'}.ifc','${new Date().toISOString()}',('OpenClaw'),('Den Outdoors Planner'),'web-ifc experimental','semantic_bim_v1','');`,
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    'DATA;',
    `/* semantic_bim_v1 element count: ${semanticBim.elements.length} */`,
    `/* This is the JSON-handoff envelope. For a real IFC model use /api/export-ifc?planId=... */`,
    'ENDSEC;',
    'END-ISO-10303-21;',
  ].join('\n');

  return {
    status: 'experimental',
    semanticBim,
    ifcText,
    blockers,
  };
}
