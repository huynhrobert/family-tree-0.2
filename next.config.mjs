// next.config.mjs
const isProd = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  basePath: isProd ? '/family-tree-0.2' : '',
  assetPrefix: isProd ? '/family-tree-0.2/' : '',
  images: { unoptimized: true, remotePatterns: [ { protocol: 'https', hostname: '**' }, { protocol: 'http', hostname: '**' } ] },
}

export default nextConfig

