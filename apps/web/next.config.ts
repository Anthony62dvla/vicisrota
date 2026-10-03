import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The compliance engine ships as TypeScript source inside the monorepo.
  transpilePackages: ["@vicisrota/compliance"],
};

export default nextConfig;
