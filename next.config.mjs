// next.config.mjs
const isProd = process.env.NODE_ENV === 'production'
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? (isProd ? '/family-tree-0.2' : '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  basePath: base,
  assetPrefix: base ? `${base}/` : '',
  images: { unoptimized: true, remotePatterns: [ { protocol: 'https', hostname: '**' }, { protocol: 'http', hostname: '**' } ] },
}

export default nextConfig

