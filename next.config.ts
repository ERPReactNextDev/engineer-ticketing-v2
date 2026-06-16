import type { NextConfig } from "next";

const nextConfig = {
  // 2. Remote Image Whitelisting (Fixes the Cloudinary Error)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },

  // 3. Security Headers (Managed via Middleware for Dynamic IT Control)
  async headers() {
    return [];
  },
};

export default nextConfig;
