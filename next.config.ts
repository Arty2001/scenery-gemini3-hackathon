import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker deployment
  serverExternalPackages: ["esbuild"],
};

export default nextConfig;
