/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // Base path for GitHub Pages: /Trading-Trip
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};

module.exports = nextConfig;
