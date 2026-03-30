import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Explicitly opt in to Turbopack (default in Next.js 16).
  turbopack: {},

  // Tell Next.js to trace files from the monorepo root, not just /ui.
  // This ensures server/, data/, config/, and node_modules/ are included
  // in the Vercel deployment bundle alongside the compiled API route.
  outputFileTracingRoot: path.join(__dirname, ".."),

  // Force-include the backend files that the API route spawns at runtime.
  // Without this, Vercel would only bundle statically-imported files.
  outputFileTracingIncludes: {
    "/api/chat": [
      "../server/**/*",
      "../data/**/*",
      "../config/**/*",
      "../agent/**/*",
      "../node_modules/.bin/tsx",
      "../node_modules/tsx/**/*",
    ],
  },
};

export default nextConfig;
