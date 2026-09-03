/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow verification builds without overwriting a running server's .next output.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
