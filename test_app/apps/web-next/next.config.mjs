/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@payload-universal/admin-schema'],
  experimental: {
    externalDir: true,
  },
}

export default nextConfig
