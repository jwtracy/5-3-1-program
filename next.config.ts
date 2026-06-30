import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone/server.js) for `node`-based deploy.
  output: "standalone",
  // Keep the native better-sqlite3 binding out of the server bundle.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
