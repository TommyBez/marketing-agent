'use client'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
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
