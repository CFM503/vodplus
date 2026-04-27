import type { NextConfig } from "next";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import withPWA from '@ducanh2912/next-pwa';

// ---- Build info ----

let commitId = '';
let buildNumber = '0';
let version = '0.0.0';

// Cloudflare Pages provides CF_PAGES_COMMIT_SHA; use it in production build
if (process.env.CF_PAGES_COMMIT_SHA) {
  commitId = process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
  // CF shallow clones can't count commits; leave buildNumber as '0'
} else {
  try {
    commitId = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    console.warn('Failed to get commit id:', e);
  }
  try {
    buildNumber = execSync('git rev-list --count HEAD').toString().trim();
  } catch (e) {
    console.warn('Failed to get build number:', e);
  }
}

try {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
  version = pkg.version || '0.0.0';
} catch (e) {
  console.warn('Failed to read package.json version:', e);
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_ID: commitId,
    NEXT_PUBLIC_VERSION: version,
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber,
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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' wsrv.nl weserv.nl image.tmdb.org images.unsplash.com data: blob:; media-src 'self' blob: https: http:; font-src 'self' data:; connect-src 'self' wsrv.nl https: http:;",
          },
        ],
      },
    ];
  },
};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  sw: 'service-worker.js',
});

export default pwaConfig(nextConfig);
