'use client'

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface AuthFormProps { mode: 'sign-in' | 'sign-up' }

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(formData: FormData) {
    setIsLoading(true); setError('')
    const email = String(formData.get('email')); const password = String(formData.get('password'))
    const result = mode === 'sign-up'
      ? await authClient.signUp.email({ email, password, name: String(formData.get('name')) })
      : await authClient.signIn.email({ email, password })
    if (result.error) { setError(result.error.message ?? 'Authentication failed'); setIsLoading(false); return }
    router.push('/workspace'); router.refresh()
  }

  return (
    <form action={handleSubmit} className="flex w-full flex-col gap-5">
      {mode === 'sign-up' && <label className="flex flex-col gap-2 text-sm font-medium">Name<input required name="name" autoComplete="name" className="h-12 rounded-lg border bg-background px-4 font-normal outline-none focus:ring-2" /></label>}
      <label className="flex flex-col gap-2 text-sm font-medium">Work email<input required type="email" name="email" autoComplete="email" className="h-12 rounded-lg border bg-background px-4 font-normal outline-none focus:ring-2" /></label>
      <label className="flex flex-col gap-2 text-sm font-medium">Password<input required minLength={8} type="password" name="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} className="h-12 rounded-lg border bg-background px-4 font-normal outline-none focus:ring-2" /></label>
      {error && <p role="alert" className="ui-state-enter text-sm text-destructive">{error}</p>}
      <button disabled={isLoading} aria-busy={isLoading} className="pressable-motion flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"><span key={isLoading ? 'loading' : 'idle'} className="ui-state-enter">{isLoading ? 'Checking your details…' : mode === 'sign-up' ? 'Create workspace' : 'Continue'}</span></button>
    </form>
  )
}
