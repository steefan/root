import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — there's an unrelated lockfile in a parent dir.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
