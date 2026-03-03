import type { NextConfig } from "next";
import { execSync } from "child_process";

let commitId = '';
try {
  commitId = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('Failed to get commit id:', e);
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_ID: commitId,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  productionBrowserSourceMaps: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Accept-Encoding',
            value: 'br, gzip, deflate',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/vod/:path*',
        destination: '/api/vod/:path*',
      },
    ];
  },
};

import withPWA from '@ducanh2912/next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  sw: 'service-worker.js',
});

export default pwaConfig(nextConfig);
