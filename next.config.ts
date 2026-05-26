import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "lucide-react": path.resolve(process.cwd(), "src/lib/doodleIconsAdapter.tsx"),
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      "lucide-react": "./src/lib/doodleIconsAdapter.tsx",
    },
  },
};

export default nextConfig;
