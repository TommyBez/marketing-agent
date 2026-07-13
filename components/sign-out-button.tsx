'use client'
import { authClient } from '@/lib/auth-client'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
export function SignOutButton() { const router = useRouter(); return <button aria-label="Sign out" onClick={async () => { await authClient.signOut(); router.push('/sign-in'); router.refresh() }} className="pressable-motion flex size-9 items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground"><LogOut className="size-4"/></button> }
