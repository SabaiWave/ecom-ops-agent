import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't bundle these at build time — resolve them as Node.js modules at runtime.
  // Both SDKs use ESM subpath exports that Turbopack can't resolve during the build.
  serverExternalPackages: ["@anthropic-ai/sdk", "@modelcontextprotocol/sdk"],

  // Include mock data JSON files in the /api/chat function bundle on Vercel.
  // These are read at runtime via fs.readFile — Vercel won't trace them automatically.
  outputFileTracingIncludes: {
    "/api/chat": ["./data/*.json"],
  },
};

export default nextConfig;
