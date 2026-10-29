import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // A package lock exists above the repository on this workstation; pinning the root keeps
  // Turbopack from treating the user profile as part of this application.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
