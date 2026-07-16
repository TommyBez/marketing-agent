'use client'

import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    posthog.capture('user_signed_out')
    posthog.reset()
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <Button variant="outline" size="icon" aria-label="Sign out" onClick={handleSignOut}>
      <LogOut />
    </Button>
  )
}
