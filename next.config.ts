import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native argon2 bindings must not be bundled.
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
  // Pin the workspace root (a stray lockfile in a parent folder confuses detection).
  turbopack: { root: process.cwd() },
};

export default nextConfig;
