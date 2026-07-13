'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface AuthFormProps {
  mode: 'sign-in' | 'sign-up'
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError('')

    const email = String(formData.get('email'))
    const password = String(formData.get('password'))
    const result = mode === 'sign-up'
      ? await authClient.signUp.email({ email, password, name: String(formData.get('name')) })
      : await authClient.signIn.email({ email, password })

    if (result.error) {
      setError(result.error.message ?? 'Authentication failed')
      setIsLoading(false)
      return
    }

    router.push('/workspace')
    router.refresh()
  }

  return (
    <form action={handleSubmit}>
      <FieldGroup>
        {mode === 'sign-up' && (
          <Field data-disabled={isLoading}>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" name="name" autoComplete="name" required disabled={isLoading} size={undefined} />
          </Field>
        )}
        <Field data-disabled={isLoading}>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required disabled={isLoading} />
        </Field>
        <Field data-disabled={isLoading}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" name="password" type="password" minLength={8} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} required disabled={isLoading} />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <Button type="submit" size="lg" disabled={isLoading} aria-busy={isLoading} className="w-full">
            {isLoading && <Spinner data-icon="inline-start" />}
            {isLoading ? 'Checking your details…' : mode === 'sign-up' ? 'Create workspace' : 'Continue'}
          </Button>
          <FieldError className="sr-only">{error}</FieldError>
        </Field>
      </FieldGroup>
    </form>
  )
}
