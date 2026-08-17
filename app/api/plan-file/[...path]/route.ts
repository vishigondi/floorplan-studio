// GET /api/plan-file/<...> — the plan store, served from disk at request time.
//
// WHY THIS EXISTS. The store lives under `public/`, and Next enumerates
// `public/` at BUILD time: a file written after the build 404s forever in
// production, while an existing file that is modified serves fresh content.
// Generation writes both kinds — it appends to `proposal-manifest.json` (which
// existed at build time, so the app sees the new entry) and writes a new
// `<plan>.paired.json` (which it cannot serve). So a production build
// advertised every generated plan in the feed and then failed to load a single
// one of them, and the deterministic-render capture timed out on a page whose
// data never arrived.
//
// Reading through a route handler removes the dev/prod divergence entirely:
// the bytes come off disk on every request, in both modes.
//
// The store is a SYMLINK to a sibling checkout, so containment is checked
// against its REAL path — a cwd-prefix test would reject every legitimate read.

import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const STORE = path.join(process.cwd(), 'public', 'data', 'den-image-loop');

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain; charset=utf-8',
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const segments = (await context.params).path ?? [];
  if (!segments.length) {
    return NextResponse.json({ error: 'no path' }, { status: 400 });
  }
  // Reject traversal before touching the filesystem. Segments come straight
  // from the URL, so nothing here may contain a separator or a parent ref.
  if (!segments.every((segment) => /^[a-z0-9][a-z0-9._-]*$/i.test(segment) && segment !== '..')) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }

  const extension = path.extname(segments[segments.length - 1]).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return NextResponse.json({ error: `unsupported file type: ${extension || 'none'}` }, { status: 400 });
  }

  const target = path.join(STORE, ...segments);
  let real: string;
  let storeReal: string;
  try {
    storeReal = await realpath(STORE);
    real = await realpath(target);
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  // Belt and braces: even with the segment check above, confirm the resolved
  // file is inside the store before reading it.
  if (real !== storeReal && !real.startsWith(storeReal + path.sep)) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }

  try {
    const info = await stat(real);
    if (!info.isFile()) return NextResponse.json({ error: 'not a file' }, { status: 404 });
    const bytes = await readFile(real);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentType,
        // The store changes underneath a running server (generation writes into
        // it), so a cached response is a stale plan.
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
