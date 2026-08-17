// GET /api/export-ifc?planId=<id> — the plan as a real IFC4 STEP file.
//
// Generated SERVER-side on purpose. web-ifc is a ~3 MB WASM module that already
// sits in node_modules here; shipping it to the browser would bloat the bundle
// and need the binary served as a public asset, for a file the user downloads
// once. The client just follows a link.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { ifcPlanFromArtifact, writeIfc } from '@/lib/bim/write-ifc';

export async function GET(request: Request) {
  const planId = new URL(request.url).searchParams.get('planId')?.trim() ?? '';
  // Path segment straight off the query string: allow only the id shape the
  // gallery uses, so this can never walk out of the data directory.
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(planId)) {
    return NextResponse.json({ error: 'invalid planId' }, { status: 400 });
  }

  const pairedDir = path.join(process.cwd(), 'public', 'data', 'den-image-loop', planId, 'paired');
  let file: string | undefined;
  try {
    file = (await readdir(pairedDir)).find((name) => name.endsWith('.paired.json'));
  } catch {
    return NextResponse.json({ error: `no artifact for ${planId}` }, { status: 404 });
  }
  if (!file) return NextResponse.json({ error: `no paired artifact for ${planId}` }, { status: 404 });

  let artifact: Parameters<typeof ifcPlanFromArtifact>[0];
  try {
    artifact = JSON.parse(await readFile(path.join(pairedDir, file), 'utf8'));
  } catch {
    return NextResponse.json({ error: `unreadable artifact for ${planId}` }, { status: 500 });
  }
  if (!artifact?.footprint) {
    return NextResponse.json({ error: `artifact for ${planId} has no footprint` }, { status: 422 });
  }

  const { bytes, coverage } = await writeIfc(ifcPlanFromArtifact({ ...artifact, planId }));

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/x-step',
      'Content-Disposition': `attachment; filename="${planId}.ifc"`,
      // The export is a subset; say so in a header the caller can read rather
      // than letting a partial model imply a complete one.
      'X-Ifc-Coverage': JSON.stringify(coverage),
      'Cache-Control': 'no-store',
    },
  });
}
