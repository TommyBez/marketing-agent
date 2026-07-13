import type { NextConfig } from 'next'
import { withEve } from 'eve/next'

const nextConfig: NextConfig = {
  images: { formats: ['image/avif', 'image/webp'] },
}

export default withEve(nextConfig)
