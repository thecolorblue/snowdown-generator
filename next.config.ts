import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['fengari'],
  },
  /* config options here */
};

export default nextConfig;
