import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Addon native (rasterisasi gambar OG) tidak dibundel, dimuat langsung oleh Node.
  serverExternalPackages: ["@resvg/resvg-js"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
