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
      { protocol: 'https', hostname: 'wsrv.nl' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' wsrv.nl weserv.nl image.tmdb.org images.unsplash.com data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' wsrv.nl;",
          },
        ],
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
