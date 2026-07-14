import type { NextConfig } from 'next'
import { withEve } from 'eve/next'

const nextConfig: NextConfig = {
  experimental: {
    // Eve streams can remain silent while subagents work, so keep the rewrite
    // proxy alive longer than Next.js' 30-second default idle timeout.
    proxyTimeout: 30 * 60_000,
  },
  images: { formats: ['image/avif', 'image/webp'] },
}

export default withEve(nextConfig)
