import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components and partial prefetching left the app on a splash screen and
  // dropped layout during local navigation. Keep the App Router UI stable.
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
