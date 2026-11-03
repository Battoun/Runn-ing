/** @type {import('next').NextConfig} */
const nextConfig = {
  // permet de lancer une 2e instance sans écraser .next (ex : tests)
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;
