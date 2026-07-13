import { LandingPage } from '@/components/landing-page'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })

  return <LandingPage isSignedIn={Boolean(session?.user)} />
}
