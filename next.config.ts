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
}

export default withEve(nextConfig)
