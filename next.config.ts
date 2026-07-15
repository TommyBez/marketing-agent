import type { NextConfig } from 'next'
import { withEve } from 'eve/next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Next.js has no per-rewrite timeout. withEve provides this app's only
    // rewrite, whose streams can remain silent while subagents work.
    proxyTimeout: 30 * 60_000,
  },
  images: { formats: ['image/avif', 'image/webp'] },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://eu-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ]
  },
  skipTrailingSlashRedirect: true,
}

export default withEve(nextConfig)
