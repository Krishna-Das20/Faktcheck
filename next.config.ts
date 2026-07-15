import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            // Allow camera/mic/screen capture on our own origin for proctoring;
            // geolocation stays disabled.
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
          },
        ],
      },
    ];
  },
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
