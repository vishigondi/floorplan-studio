import type { NextConfig } from "next";

// Static export is opt-in (NEXT_STATIC_EXPORT=1) for static hosting builds.
// The default server build is required for API routes (/api/generate-plan).
const nextConfig: NextConfig = {
  output: process.env.NEXT_STATIC_EXPORT ? "export" : undefined,
  // web-ifc loads its own ~3 MB .wasm by a path relative to its module. Bundling
  // it into the server chunk breaks that resolution (ENOENT on
  // vendor-chunks/web-ifc-node.wasm), so /api/export-ifc requires it externally.
  serverExternalPackages: ["web-ifc"],
};

export default nextConfig;
