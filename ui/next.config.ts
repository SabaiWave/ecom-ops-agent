import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly opt in to Turbopack (default in Next.js 16) so the dev server
  // doesn't warn about a webpack config being present with no turbopack config.
  turbopack: {},
};

export default nextConfig;
