/** @type {import('next').NextConfig} */
// Use static export only for GitHub Pages (where NEXT_PUBLIC_BASE_PATH is set).
// Vercel handles Next.js natively — no static export needed there.
const isGitHubPages = !!process.env.NEXT_PUBLIC_BASE_PATH;

const nextConfig = {
  ...(isGitHubPages && { output: 'export' }),
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
};

module.exports = nextConfig;
