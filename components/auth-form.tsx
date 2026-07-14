'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type AuthStep = 'email' | 'otp'

interface AuthFormProps {
  localAuthBypassEnabled: boolean
}

function authErrorMessage(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case 'INVALID_OTP':
      return 'That code is not valid. Check the email and try again.'
    case 'OTP_EXPIRED':
      return 'That code has expired. Request a new one to continue.'
    case 'TOO_MANY_ATTEMPTS':
      return 'Too many incorrect attempts. Request a new code to continue.'
    case 'TOO_MANY_REQUESTS':
      return 'Too many requests. Wait a minute before asking for another code.'
    default:
      return error.message ?? 'We could not complete sign-in. Please try again.'
  }
}

function displayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? ''
  return localPart.replaceAll(/[._+-]+/g, ' ').trim() || 'Branderize user'
}

export function AuthForm({ localAuthBypassEnabled }: AuthFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(targetEmail: string) {
    setIsLoading(true)
    setError('')

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: targetEmail,
        type: 'sign-in',
      })

      if (result.error) {
        setError(authErrorMessage(result.error))
        return
      }

      setEmail(targetEmail)
      setStep('otp')
    } catch {
      setError(
        localAuthBypassEnabled
          ? 'We could not start local sign-in. Check your connection and try again.'
          : 'We could not send the code. Check your connection and try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    if (step === 'email') {
      await sendCode(String(formData.get('email')).trim().toLowerCase())
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const submittedOtp = String(formData.get('otp'))
      const otp = localAuthBypassEnabled
        ? submittedOtp
        : submittedOtp.replaceAll(/\D/g, '')
      const result = await authClient.signIn.emailOtp({
        email,
        name: displayNameFromEmail(email),
        otp,
      })

      if (result.error) {
        setError(authErrorMessage(result.error))
        return
      }

      router.push('/workspace')
      router.refresh()
    } catch {
      setError('We could not verify the code. Check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function useDifferentEmail() {
    setError('')
    setStep('email')
  }

  return (
    <form action={handleSubmit}>
      <FieldGroup>
        {step === 'email' ? (
          <Field data-disabled={isLoading}>
            <FieldLabel htmlFor="email">Work email</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" defaultValue={email} required disabled={isLoading} autoFocus />
            <FieldDescription>
              {localAuthBypassEnabled
                ? 'Use your email to start a local development session. No email will be sent.'
                : 'We will email you a secure, one-time sign-in code.'}
            </FieldDescription>
          </Field>
        ) : (
          <>
            <Field data-disabled={isLoading}>
              <FieldLabel htmlFor="otp">
                {localAuthBypassEnabled ? 'Development code' : 'Six-digit code'}
              </FieldLabel>
              <Input
                id="otp"
                name="otp"
                type="text"
                inputMode={localAuthBypassEnabled ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                pattern={localAuthBypassEnabled ? undefined : '[0-9]{6}'}
                maxLength={localAuthBypassEnabled ? undefined : 6}
                required
                disabled={isLoading}
                autoFocus
                aria-describedby="otp-description"
                className="h-12 text-center font-mono text-xl tracking-[0.45em]"
              />
              <FieldDescription id="otp-description">
                {localAuthBypassEnabled ? (
                  <>Local development: no email was sent. Enter any code to continue.</>
                ) : (
                  <>
                    Sent to <span className="font-medium text-foreground">{email}</span>. The code expires in five minutes.
                  </>
                )}
              </FieldDescription>
            </Field>
            <div className="flex flex-wrap items-center gap-1">
              {!localAuthBypassEnabled && (
                <>
                  <Button type="button" variant="link" size="sm" disabled={isLoading} onClick={() => sendCode(email)}>
                    Send a new code
                  </Button>
                  <span aria-hidden="true" className="text-muted-foreground">·</span>
                </>
              )}
              <Button type="button" variant="link" size="sm" disabled={isLoading} onClick={useDifferentEmail}>
                Use another email
              </Button>
            </div>
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <Button type="submit" size="lg" disabled={isLoading} aria-busy={isLoading} className="w-full">
            {isLoading && <Spinner data-icon="inline-start" />}
            {isLoading
              ? step === 'email'
                ? localAuthBypassEnabled ? 'Preparing local sign-in…' : 'Sending code…'
                : localAuthBypassEnabled ? 'Opening workspace…' : 'Checking code…'
              : step === 'email'
                ? localAuthBypassEnabled ? 'Continue locally' : 'Email me a code'
                : 'Open workspace'}
          </Button>
          <FieldError className="sr-only">{error}</FieldError>
        </Field>
      </FieldGroup>
    </form>
  )
}
