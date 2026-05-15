import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@growth/shared"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config) => {
    // packages/shared and mcp-server use NodeNext-style ".js" extensions on
    // relative TS imports. Tell webpack to also try ".ts"/".tsx" when it sees ".js".
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
