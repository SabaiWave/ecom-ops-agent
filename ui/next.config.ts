import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Explicitly opt in to Turbopack (default in Next.js 16).
  turbopack: {},

  // Don't bundle these at build time — resolve them as Node.js modules at runtime.
  // Both SDKs use ESM subpath exports with .js extensions that Turbopack
  // can't resolve during the build, but work fine when required() at runtime.
  serverExternalPackages: ["@anthropic-ai/sdk", "@modelcontextprotocol/sdk"],

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
