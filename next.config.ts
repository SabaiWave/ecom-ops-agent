import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't bundle these at build time — resolve them as Node.js modules at runtime.
  // Both SDKs use ESM subpath exports that Turbopack can't resolve during the build.
  serverExternalPackages: ["@anthropic-ai/sdk", "@modelcontextprotocol/sdk"],
};

export default nextConfig;
