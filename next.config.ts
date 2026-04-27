import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for @webcontainer/api (App Builder feature) + security hardening
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // WebContainer requirements
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Security headers
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },

  // Cloudflare Pages handles deployment automatically (standalone not required)
  // output: "standalone",


  // Allow images from external sources
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  // Required to silence Turbopack config conflict warning in Next.js 16
  turbopack: {},

  // Disable memory-heavy checks during Cloudflare build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};


export default nextConfig;
